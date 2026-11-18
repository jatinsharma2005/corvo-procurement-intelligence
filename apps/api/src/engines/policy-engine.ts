import {
  PolicyDocument,
  PolicyRule,
  EvaluationContext,
  evaluateCondition
} from '@corvo/policy-schema';
import {
  RequirementGroup,
  ProcurementDecision,
  Item,
  Supplier,
  PurchaseHistoryRecord
} from '@corvo/shared-types';
import { ContractEvaluationEngine, ContractEvaluationResult } from './contract-evaluation';
import { valueRequirement } from './valuation';
import { SupplierRankingEngine } from './supplier-ranking';
import { POConsolidationEngine } from './po-consolidation';

export interface PolicyEvaluationOutput {
  decision: ProcurementDecision;
  matchedRule: PolicyRule;
  context: EvaluationContext;
}

export class DynamicPolicyEngine {
  private policy: PolicyDocument;
  private contractEngine: ContractEvaluationEngine;
  private rankingEngine: SupplierRankingEngine;
  private poConsolidationEngine: POConsolidationEngine;
  private itemCatalog: Map<string, Item> = new Map();
  private suppliers: Map<string, Supplier> = new Map();
  private poHistory: PurchaseHistoryRecord[] = [];

  constructor(
    policy: PolicyDocument,
    contractEngine: ContractEvaluationEngine,
    rankingEngine: SupplierRankingEngine,
    items: Item[] = [],
    suppliers: Supplier[] = [],
    poHistory: PurchaseHistoryRecord[] = []
  ) {
    this.policy = policy;
    this.contractEngine = contractEngine;
    this.rankingEngine = rankingEngine;
    this.poConsolidationEngine = new POConsolidationEngine(
      policy.parameters?.po_consolidation_window_hours || 24
    );
    this.setData(items, suppliers, poHistory);
  }

  public setPolicy(policy: PolicyDocument): void {
    this.policy = policy;
    this.poConsolidationEngine = new POConsolidationEngine(
      policy.parameters?.po_consolidation_window_hours || 24
    );
  }

  public setData(items: Item[], suppliers: Supplier[], poHistory: PurchaseHistoryRecord[]): void {
    this.itemCatalog.clear();
    for (const it of items) {
      this.itemCatalog.set(it.item_code, it);
    }
    this.suppliers.clear();
    for (const s of suppliers) {
      this.suppliers.set(s.supplier_id, s);
    }
    this.poHistory = poHistory;
  }

  public resetState(): void {
    this.contractEngine.resetConsumption();
    this.poConsolidationEngine.reset();
  }

  public evaluateRequirementGroup(group: RequirementGroup): PolicyEvaluationOutput {
    const itemCode = group.resolved_item_code;
    const isNew = itemCode === 'NEW';
    const itemMaster = isNew ? undefined : this.itemCatalog.get(itemCode);
    const reqDateStr = group.first_created_at.split(' ')[0].split('T')[0];
    const reqDate = new Date(reqDateStr).getTime();

    // 1. Evaluate contracts
    const contractEval = this.contractEngine.evaluateRequirement(
      itemCode,
      group.total_quantity,
      reqDateStr
    );

    // 2. Evaluate requirement value
    const requesterEst = group.lines[0]?.estimated_unit_price;
    const valuation = valueRequirement(
      itemCode,
      group.total_quantity,
      reqDateStr,
      itemMaster,
      contractEval,
      this.poHistory,
      requesterEst
    );

    group.estimated_value_inr = valuation.requirement_value_inr;
    group.valuation_basis = valuation.valuation_basis;

    // 3. Purchase history in last 365 days from Active supplier
    const cutoff365 = reqDate - 365 * 24 * 60 * 60 * 1000;
    const recentActivePOs = isNew
      ? []
      : this.poHistory.filter((po) => {
          if (po.item_code !== itemCode) return false;
          const poTime = new Date(po.po_date).getTime();
          if (poTime < cutoff365 || poTime >= reqDate) return false;
          const sup = this.suppliers.get(po.supplier_id);
          return sup && sup.status === 'Active';
        });
    const hasActivePurchase365 = recentActivePOs.length > 0;

    // 4. Preferred supplier rankings
    const rankings = isNew ? [] : this.rankingEngine.rankSuppliers(itemCode, reqDateStr);
    const firstPreferred = rankings.length > 0 ? rankings[0] : undefined;

    // Build Evaluation Context
    const context: EvaluationContext = {
      item: {
        item_code: itemCode,
        description: itemMaster?.description || group.lines[0]?.description || '',
        category: itemMaster?.category || 'General',
        item_type: itemMaster?.item_type || 'Material',
        is_new: isNew,
        standard_price: itemMaster?.standard_price || 0
      },
      requirement: {
        group_id: group.group_id,
        plant: group.plant,
        quantity: group.total_quantity,
        value_inr: valuation.requirement_value_inr,
        is_emergency: group.is_emergency,
        requirement_date: reqDateStr,
        first_need_by: group.first_need_by,
        line_count: group.lines.length
      },
      contract: {
        has_usable_contract: contractEval.has_usable_contract,
        usable_contract_id: contractEval.selected_contract?.contract_id,
        usable_contract_rate: contractEval.selected_contract?.rate,
        usable_contract_supplier_id: contractEval.selected_contract?.supplier_id,
        has_any_applicable_contract: contractEval.has_any_applicable_contract,
        all_applicable_out_of_ceiling: contractEval.all_applicable_out_of_ceiling,
        lowest_applicable_contract_rate: contractEval.lowest_applicable_rate
      },
      history: {
        has_active_purchase_in_365d: hasActivePurchase365,
        most_recent_po_price: recentActivePOs.length > 0 ? recentActivePOs[0].unit_price : undefined,
        first_preferred_supplier_id: firstPreferred?.supplier_id,
        first_preferred_reference_price: firstPreferred?.reference_price
      }
    };

    // Sort rules strictly by priority ascending
    const sortedRules = [...this.policy.rules].sort((a, b) => a.priority - b.priority);

    let matchedRule: PolicyRule | null = null;
    for (const rule of sortedRules) {
      if (evaluateCondition(rule.conditions, context)) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      // Fallback rule if no rule matched
      matchedRule = {
        rule_id: 'RULE_DEFAULT_RFQ',
        clause: '5.5',
        name: 'Default RFQ',
        description: 'Fallback rule when no specific condition matched',
        priority: 999,
        conditions: { field: 'requirement.value_inr', operator: 'gte', value: 0 },
        outcome: {
          decision: 'SOURCING_REQUEST',
          route: 'RFQ',
          supplier_selection: { strategy: 'SUGGEST_RANKED', suggest_count: 3 },
          requires_approval: true
        }
      };
    }

    // Resolve outcome specifics
    let supplierId: string | undefined = undefined;
    let supplierName: string | undefined = undefined;
    let unitPrice: number | undefined = undefined;
    let poId: string | undefined = undefined;
    let suggestedSupplierIds: string[] = [];

    const { strategy, suggest_count, price_basis } = matchedRule.outcome.supplier_selection;

    if (matchedRule.outcome.decision === 'PO') {
      if (strategy === 'CONTRACT_SUPPLIER' && contractEval.selected_contract) {
        supplierId = contractEval.selected_contract.supplier_id;
        supplierName = this.suppliers.get(supplierId)?.name;
        unitPrice = contractEval.selected_contract.rate;
        // Consume ceiling
        this.contractEngine.consumeCeiling(
          contractEval.selected_contract.contract_id,
          group.total_quantity * contractEval.selected_contract.rate
        );
      } else if (strategy === 'FIRST_PREFERRED' && firstPreferred) {
        supplierId = firstPreferred.supplier_id;
        supplierName = firstPreferred.supplier_name;
        unitPrice = firstPreferred.reference_price || valuation.unit_price;
      }

      // Assign PO (consolidated if within 24h, same supplier, plant, route)
      if (supplierId) {
        poId = this.poConsolidationEngine.assignPO(
          group.group_id,
          supplierId,
          group.plant,
          matchedRule.outcome.route,
          group.first_created_at,
          valuation.requirement_value_inr
        );
      }
    } else {
      // Sourcing Request
      if (strategy === 'SUGGEST_RANKED' && suggest_count) {
        suggestedSupplierIds = this.rankingEngine.getSourcingSuggestions(
          itemCode,
          context.item.category,
          reqDateStr,
          suggest_count
        );
      }
    }

    // Construct human-readable reason
    let reasonText = '';
    if (matchedRule.outcome.route === 'CONTRACT_PO' && contractEval.selected_contract) {
      reasonText = `Covered by rate contract ${contractEval.selected_contract.contract_id} with ${supplierName}. Clause ${matchedRule.clause}`;
    } else if (matchedRule.outcome.route === 'EMERGENCY_PO') {
      reasonText = `Emergency requirement <= 5L with purchase history in last 365d. 1st preferred supplier ${supplierName}. Clause ${matchedRule.clause}`;
    } else if (matchedRule.outcome.route === 'SPOT_PO') {
      reasonText = `Value below 2L with purchase history in last 365d. 1st preferred supplier ${supplierName}. Clause ${matchedRule.clause}`;
    } else if (matchedRule.outcome.route === 'CAPEX_SOURCING') {
      reasonText = `Item type is Capex. Sourcing with ${suggest_count || 5} suggested suppliers. Clause ${matchedRule.clause}`;
    } else if (matchedRule.outcome.route === 'NEW_ITEM_SOURCING') {
      reasonText = `Item not in item master (New Item). Sourcing at requester estimated price. Clause ${matchedRule.clause}`;
    } else if (matchedRule.outcome.route === 'RFQ') {
      reasonText = `Value < 10L. RFQ with ${suggestedSupplierIds.length} suggested suppliers. Clause ${matchedRule.clause}`;
    } else if (matchedRule.outcome.route === 'RFP') {
      reasonText = `Value >= 10L. Formal RFP with ${suggestedSupplierIds.length} suggested suppliers. Clause ${matchedRule.clause}`;
    } else {
      reasonText = `Evaluated against policy clause ${matchedRule.clause}: ${matchedRule.description}`;
    }

    const decision: ProcurementDecision = {
      group_id: group.group_id,
      resolved_item_code: itemCode,
      plant: group.plant,
      total_quantity: group.total_quantity,
      group_value_inr: valuation.requirement_value_inr,
      decision: matchedRule.outcome.decision,
      route: matchedRule.outcome.route,
      supplier_id: supplierId,
      supplier_name: supplierName,
      unit_price: unitPrice,
      po_id: poId,
      suggested_supplier_ids: suggestedSupplierIds,
      policy_version: this.policy.version,
      clause: matchedRule.clause,
      reason: reasonText,
      rule_id: matchedRule.rule_id,
      calculation_breakdown: {
        total_quantity: group.total_quantity,
        unit_price: valuation.unit_price,
        valuation_basis: valuation.valuation_basis,
        applicable_contracts: contractEval.all_applicable.map((a) => ({
          contract_id: a.contract_id,
          rate: a.rate,
          remaining_ceiling: a.remaining_ceiling,
          usable: a.has_enough_ceiling
        })),
        preferred_suppliers_considered: rankings.slice(0, 5).map((r) => ({
          supplier_id: r.supplier_id,
          name: r.supplier_name,
          score: r.total_score,
          rank: r.rank
        }))
      },
      status: 'PENDING_APPROVAL'
    };

    group.decision = decision;
    return { decision, matchedRule, context };
  }
}
