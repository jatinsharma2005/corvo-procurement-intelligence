import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POLICY_V5,
  PolicyDocument,
  EvaluationContext,
  evaluateCondition
} from '@corvo/policy-schema';
import { DynamicPolicyEngine } from '../../apps/api/src/engines/policy-engine';
import { ContractEvaluationEngine } from '../../apps/api/src/engines/contract-evaluation';
import { SupplierRankingEngine } from '../../apps/api/src/engines/supplier-ranking';
import { RequirementGroup, Item, Supplier, PurchaseHistoryRecord, Contract } from '@corvo/shared-types';

describe('Policy Threshold Boundaries & Edge Cases (Cantill Final Audit)', () => {
  const dummyItem: Item = {
    item_code: 'ITM-9001',
    description: 'Precision Test Widget',
    uom: 'NOS',
    category: 'Mechanical',
    item_type: 'Material',
    standard_price: 1
  };

  const activeSupplier: Supplier = {
    supplier_id: 'S901',
    name: 'Precision Instruments Ltd',
    status: 'Active',
    tier: 'Tier 1',
    categories: ['Mechanical'],
    on_time_pct: 95,
    quality_rating: 4.5
  };

  const blockedSupplier: Supplier = {
    supplier_id: 'S902',
    name: 'Disqualified Vendor Corp',
    status: 'Blocked',
    tier: 'Tier 3',
    categories: ['Mechanical'],
    on_time_pct: 50,
    quality_rating: 2.0
  };

  const dummyPOHistory: PurchaseHistoryRecord = {
    po_number: 'PO-HIST-01',
    po_date: '2026-06-01',
    supplier_id: 'S901',
    item_code: 'ITM-9001',
    quantity: 100,
    uom: 'NOS',
    unit_price: 1,
    plant: 'PUN1',
    delivered_on_time: true
  };

  function createRequirementGroup(valueInr: number, isEmergency: boolean = false): RequirementGroup {
    return {
      group_id: `REQ-${valueInr}-${isEmergency ? 'EMERG' : 'NORM'}`,
      resolved_item_code: 'ITM-9001',
      plant: 'PUN1',
      total_quantity: valueInr,
      is_emergency: isEmergency,
      first_created_at: '2026-11-01 10:00:00',
      first_need_by: '2026-11-15',
      lines: [
        {
          pr_no: 'PR-TEST-01',
          pr_line: 1,
          created_at: '2026-11-01 10:00:00',
          requester: 'J. Doe',
          department: 'Maintenance',
          plant: 'PUN1',
          item_code: 'ITM-9001',
          description: 'Precision Test Widget',
          quantity: valueInr,
          uom: 'NOS',
          estimated_unit_price: 1,
          need_by_date: '2026-11-15',
          urgency: isEmergency ? 'Emergency' : 'Normal',
          resolved_item_code: 'ITM-9001',
          is_new_item: false
        }
      ]
    };
  }

  function setupEngine(contracts: Contract[] = [], poHistory: PurchaseHistoryRecord[] = [dummyPOHistory]) {
    const suppliersList = [activeSupplier, blockedSupplier];
    const contractEngine = new ContractEvaluationEngine(contracts, suppliersList);
    const rankingEngine = new SupplierRankingEngine(
      suppliersList,
      poHistory,
      contracts
    );
    const engine = new DynamicPolicyEngine(
      DEFAULT_POLICY_V5,
      contractEngine,
      rankingEngine,
      [dummyItem],
      suppliersList,
      poHistory
    );
    return { engine, contractEngine };
  }

  describe('Spot PO vs RFQ Threshold Boundaries (Clause 5.4: < ₹2,00,000)', () => {
    it('evaluates ₹49,999, ₹50,000, and ₹50,001 as SPOT_PO when active 365d history exists', () => {
      const { engine } = setupEngine();

      const out49k = engine.evaluateRequirementGroup(createRequirementGroup(49999));
      expect(out49k.matchedRule.rule_id).toBe('RULE_5_4_SPOT_PO');
      expect(out49k.decision.route).toBe('SPOT_PO');
      expect(out49k.decision.decision).toBe('PO');

      const out50k = engine.evaluateRequirementGroup(createRequirementGroup(50000));
      expect(out50k.matchedRule.rule_id).toBe('RULE_5_4_SPOT_PO');
      expect(out50k.decision.route).toBe('SPOT_PO');
      expect(out50k.decision.decision).toBe('PO');

      const out50k1 = engine.evaluateRequirementGroup(createRequirementGroup(50001));
      expect(out50k1.matchedRule.rule_id).toBe('RULE_5_4_SPOT_PO');
      expect(out50k1.decision.route).toBe('SPOT_PO');
      expect(out50k1.decision.decision).toBe('PO');
    });

    it('evaluates ₹1,99,999 as SPOT_PO (strictly below ₹2,00,000)', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(199999));
      expect(out.matchedRule.rule_id).toBe('RULE_5_4_SPOT_PO');
      expect(out.decision.route).toBe('SPOT_PO');
      expect(out.decision.decision).toBe('PO');
    });

    it('evaluates ₹2,00,000 as RFQ (boundary condition: NOT < 2,00,000, falls to Clause 5.5)', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(200000));
      expect(out.matchedRule.rule_id).toBe('RULE_5_5_RFQ');
      expect(out.decision.route).toBe('RFQ');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
    });

    it('routes ₹49,999 to RFQ if no active purchase history exists in previous 365 days', () => {
      // Empty PO history -> hasActivePurchase365 is false
      const { engine } = setupEngine([], []);
      const out = engine.evaluateRequirementGroup(createRequirementGroup(49999));
      expect(out.matchedRule.rule_id).toBe('RULE_5_5_RFQ');
      expect(out.decision.route).toBe('RFQ');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
    });
  });

  describe('RFQ vs RFP Threshold Boundaries (Clause 5.5 & 5.6: ₹10,00,000)', () => {
    it('evaluates ₹9,99,999 as RFQ (strictly below ₹10,00,000 with 3 quotes suggested)', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(999999));
      expect(out.matchedRule.rule_id).toBe('RULE_5_5_RFQ');
      expect(out.decision.route).toBe('RFQ');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
      expect(out.matchedRule.outcome.supplier_selection.suggest_count).toBe(3);
    });

    it('evaluates ₹10,00,000 as RFP (boundary condition: >= ₹10,00,000 with 5 quotes suggested)', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(1000000));
      expect(out.matchedRule.rule_id).toBe('RULE_5_6_RFP');
      expect(out.decision.route).toBe('RFP');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
      expect(out.matchedRule.outcome.supplier_selection.suggest_count).toBe(5);
    });

    it('evaluates ₹10,00,001 as RFP (exceeds ₹10,00,000)', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(1000001));
      expect(out.matchedRule.rule_id).toBe('RULE_5_6_RFP');
      expect(out.decision.route).toBe('RFP');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
      expect(out.matchedRule.outcome.supplier_selection.suggest_count).toBe(5);
    });
  });

  describe('Emergency PO Boundaries (Clause 5.3: <= ₹5,00,000 and Active Supplier Purchase in 365d)', () => {
    it('routes emergency requirement at exactly ₹5,00,000 with active history to EMERGENCY_PO', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(500000, true));
      expect(out.matchedRule.rule_id).toBe('RULE_5_3_EMERGENCY_PO');
      expect(out.decision.route).toBe('EMERGENCY_PO');
      expect(out.decision.decision).toBe('PO');
    });

    it('routes emergency requirement at ₹5,00,001 (exceeding ₹5 lakh cap) to RFQ', () => {
      const { engine } = setupEngine();
      const out = engine.evaluateRequirementGroup(createRequirementGroup(500001, true));
      expect(out.matchedRule.rule_id).toBe('RULE_5_5_RFQ');
      expect(out.decision.route).toBe('RFQ');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
    });

    it('routes emergency requirement under ₹5 lakh WITHOUT 365d active purchase history to RFQ', () => {
      // No PO history
      const { engine } = setupEngine([], []);
      const out = engine.evaluateRequirementGroup(createRequirementGroup(150000, true));
      expect(out.matchedRule.rule_id).toBe('RULE_5_5_RFQ');
      expect(out.decision.route).toBe('RFQ');
      expect(out.decision.decision).toBe('SOURCING_REQUEST');
    });

    it('routes emergency requirement under ₹5 lakh with purchase history from BLOCKED supplier to RFQ', () => {
      const blockedPO: PurchaseHistoryRecord = {
        po_number: 'PO-HIST-BLOCKED',
        po_date: '2026-06-01',
        supplier_id: 'S902', // Blocked supplier
        item_code: 'ITM-9001',
        quantity: 100,
        uom: 'NOS',
        unit_price: 1,
        plant: 'PUN1',
        delivered_on_time: true
      };
      const { engine } = setupEngine([], [blockedPO]);
      const out = engine.evaluateRequirementGroup(createRequirementGroup(150000, true));
      expect(out.matchedRule.rule_id).toBe('RULE_5_5_RFQ');
      expect(out.decision.route).toBe('RFQ');
    });
  });

  describe('Contract Ceiling Exact Consumption vs Exhaustion (Clause 5.2)', () => {
    const dummyContract: Contract = {
      contract_id: 'RC-999',
      supplier_id: 'S901',
      supplier_name: 'Precision Instruments Ltd',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      value_cap: 100000,
      consumed_value: 0,
      lines: {
        'ITM-9001': {
          contract_id: 'RC-999',
          item_code: 'ITM-9001',
          description: 'Precision Test Widget',
          uom: 'NOS',
          rate: 1
        }
      }
    };

    it('handles exact contract ceiling consumption and subsequent exhaustion', () => {
      const { engine, contractEngine } = setupEngine([dummyContract]);

      // 1. First requirement uses exactly 100,000 INR (matches value_cap)
      const group1 = createRequirementGroup(100000);
      const out1 = engine.evaluateRequirementGroup(group1);
      expect(out1.matchedRule.rule_id).toBe('RULE_5_2_CONTRACT_PO');
      expect(out1.decision.route).toBe('CONTRACT_PO');
      expect(out1.decision.decision).toBe('PO');

      // Consumed ceiling is now 100000, remaining headroom is 0
      const consumed = contractEngine.getConsumedValue('RC-999');
      expect(consumed).toBe(100000);

      // 2. Second requirement for 1 NOS of the same item now finds contract exhausted
      const group2 = createRequirementGroup(1);
      const out2 = engine.evaluateRequirementGroup(group2);
      // Contract is exhausted -> falls through to Spot PO (value 1 INR < 2,00,000 with 365d history)
      expect(out2.matchedRule.rule_id).toBe('RULE_5_4_SPOT_PO');
      expect(out2.decision.route).toBe('SPOT_PO');
    });

    it('rejects contract if requirement value strictly exceeds remaining headroom', () => {
      const { engine } = setupEngine([dummyContract]);
      // Requirement value 100,001 INR exceeds ceiling 100,000 INR
      const groupExceed = createRequirementGroup(100001);
      const out = engine.evaluateRequirementGroup(groupExceed);
      // Cannot use contract -> falls through to Spot PO (< 200,000 with 365d history)
      expect(out.matchedRule.rule_id).toBe('RULE_5_4_SPOT_PO');
      expect(out.decision.route).toBe('SPOT_PO');
    });
  });
});
