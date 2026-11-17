import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import {
  PurchaseRequestLine,
  RequirementGroup,
  ProcurementDecision,
  DecisionCSVRow
} from '@corvo/shared-types';
import { PolicyDocument, DEFAULT_POLICY_V5 } from '@corvo/policy-schema';
import { ItemMatchingEngine } from '../engines/item-matching';
import { clubPRLines } from '../engines/requirement-clubbing';
import { ContractEvaluationEngine } from '../engines/contract-evaluation';
import { SupplierRankingEngine } from '../engines/supplier-ranking';
import { DynamicPolicyEngine } from '../engines/policy-engine';
import { DataStore } from './data-store.service';
import { ContractService } from './contract.service';
import { PolicyService } from './policy.service';
import { BatchRunModel } from '../models/BatchRun';
import { PurchaseRequestLineModel } from '../models/PurchaseRequest';
import { RequirementGroupModel } from '../models/RequirementGroup';
import { ProcurementDecisionModel } from '../models/ProcurementDecision';

export interface BatchProcessingResult {
  batch_id: string;
  policy_version: string;
  total_lines: number;
  total_requirements: number;
  total_pos: number;
  total_sourcing_requests: number;
  total_value_inr: number;
  decisions: ProcurementDecision[];
  requirements: RequirementGroup[];
  assigned_lines: PurchaseRequestLine[];
  csv_rows: DecisionCSVRow[];
}

export class BatchService {
  private itemMatchingEngine: ItemMatchingEngine;
  private contractService: ContractService;
  private policyService: PolicyService;

  constructor() {
    this.itemMatchingEngine = new ItemMatchingEngine();
    this.contractService = new ContractService();
    this.policyService = new PolicyService();
  }

  public async processBatchCSV(
    csvContent: string | Buffer,
    filename: string = 'batch_upload.csv',
    customPolicy?: string | PolicyDocument
  ): Promise<BatchProcessingResult> {
    const rawCsv = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf-8');

    // 1. Parse CSV records
    const rawRecords = parse(rawCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // 2. Load context data from DataStore
    const dataStore = DataStore.getInstance();
    await dataStore.loadData();

    const items = dataStore.getItems();
    const suppliers = dataStore.getSuppliers();
    const poHistory = dataStore.getPOHistory();
    const contracts = dataStore.getContracts();

    // Initialize item matching engine
    this.itemMatchingEngine.setCatalog(items);

    // 3. Resolve each PR line
    const batchId = `BATCH-${Date.now()}`;
    const prLines: PurchaseRequestLine[] = [];

    for (const row of rawRecords) {
      const match = this.itemMatchingEngine.match(row.item_code, row.description);
      const estPrice = row.estimated_unit_price && !isNaN(parseFloat(row.estimated_unit_price))
        ? parseFloat(row.estimated_unit_price)
        : undefined;

      prLines.push({
        pr_no: row.pr_no,
        pr_line: parseInt(row.pr_line || '1', 10),
        created_at: row.created_at,
        requester: row.requester || 'Requester',
        department: row.department || 'Operations',
        plant: row.plant,
        item_code: row.item_code || undefined,
        description: row.description,
        quantity: parseFloat(row.quantity),
        uom: row.uom || 'NOS',
        estimated_unit_price: estPrice,
        need_by_date: row.need_by_date,
        urgency: row.urgency === 'Emergency' ? 'Emergency' : 'Normal',
        resolved_item_code: match.resolved_item_code
      });
    }

    // 4. Club requirements (Policy Section 2)
    let policy: PolicyDocument;
    if (typeof customPolicy === 'object' && customPolicy !== null) {
      policy = customPolicy;
    } else if (typeof customPolicy === 'string') {
      policy = (await this.policyService.getPolicyByVersion(customPolicy)) || (await this.policyService.getActivePolicy());
    } else {
      policy = await this.policyService.getActivePolicy();
    }

    const { groups, assignedLines } = clubPRLines(prLines, {
      clubbing_window_days: policy.parameters?.clubbing_window_days || 14,
      clubbing_need_by_window_days: policy.parameters?.clubbing_need_by_window_days || 7
    });

    // 5. Initialize evaluation engines
    const contractEngine = new ContractEvaluationEngine(contracts, suppliers);
    const rankingEngine = new SupplierRankingEngine(suppliers, poHistory, contracts);
    const policyEngine = new DynamicPolicyEngine(
      policy,
      contractEngine,
      rankingEngine,
      items,
      suppliers,
      poHistory
    );

    // 6. Evaluate each requirement group
    const decisions: ProcurementDecision[] = [];
    let totalBatchValue = 0;
    let totalPOs = 0;
    let totalSRs = 0;
    const poSet = new Set<string>();

    for (const group of groups) {
      const { decision } = policyEngine.evaluateRequirementGroup(group);
      decisions.push(decision);
      totalBatchValue += decision.group_value_inr;

      if (decision.decision === 'PO') {
        if (decision.po_id) poSet.add(decision.po_id);
      } else {
        totalSRs += 1;
      }
    }
    totalPOs = poSet.size;

    // 7. Build Decision CSV Rows (Exact Required Output Schema)
    const decisionsByGroup = new Map(decisions.map((d) => [d.group_id, d]));
    const csvRows: DecisionCSVRow[] = [];

    for (const line of assignedLines) {
      const d = decisionsByGroup.get(line.group_id || '')!;
      csvRows.push({
        pr_no: line.pr_no,
        pr_line: line.pr_line,
        resolved_item_code: d.resolved_item_code,
        group_id: d.group_id,
        po_id: d.po_id || '',
        decision: d.decision,
        route: d.route,
        supplier_id: d.decision === 'PO' ? d.supplier_id || '' : '',
        unit_price: d.decision === 'PO' && d.unit_price !== undefined ? d.unit_price : '',
        group_value_inr: d.group_value_inr,
        suggested_supplier_ids: d.suggested_supplier_ids.join(';'),
        policy_version: d.policy_version,
        reason: d.reason
      });
    }

    // 8. Persist batch run in DB if MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      try {
        await BatchRunModel.create({
          batch_id: batchId,
          filename,
          total_lines: prLines.length,
          total_requirements: groups.length,
          total_pos: totalPOs,
          total_sourcing_requests: totalSRs,
          total_value_inr: Math.round(totalBatchValue * 100) / 100,
          policy_version: policy.version,
          status: 'COMPLETED'
        });

        const decisionDocs = decisions.map((d) => ({
          group_id: d.group_id,
          batch_id: batchId,
          resolved_item_code: d.resolved_item_code,
          plant: d.plant,
          total_quantity: d.total_quantity,
          group_value_inr: d.group_value_inr,
          decision: d.decision,
          route: d.route,
          supplier_id: d.supplier_id,
          supplier_name: d.supplier_name,
          unit_price: d.unit_price,
          po_id: d.po_id,
          suggested_supplier_ids: d.suggested_supplier_ids,
          policy_version: d.policy_version,
          clause: d.clause,
          reason: d.reason,
          rule_id: d.rule_id,
          calculation_breakdown: d.calculation_breakdown,
          status: 'PENDING_APPROVAL'
        }));
        await ProcurementDecisionModel.insertMany(decisionDocs);

        const groupDocs = groups.map((g) => ({
          group_id: g.group_id,
          batch_id: batchId,
          resolved_item_code: g.resolved_item_code,
          plant: g.plant,
          first_created_at: new Date(g.first_created_at),
          first_need_by: new Date(g.first_need_by),
          is_emergency: g.is_emergency,
          total_quantity: g.total_quantity,
          line_ids: g.lines.map((l) => `${l.pr_no}/${l.pr_line}`),
          estimated_value_inr: g.estimated_value_inr,
          valuation_basis: g.valuation_basis,
          decision_id: g.group_id
        }));
        await RequirementGroupModel.insertMany(groupDocs);
      } catch (err: any) {
        console.warn(`[BatchService] DB persistence warning: ${err.message}`);
      }
    }

    return {
      batch_id: batchId,
      policy_version: policy.version,
      total_lines: prLines.length,
      total_requirements: groups.length,
      total_pos: totalPOs,
      total_sourcing_requests: totalSRs,
      total_value_inr: Math.round(totalBatchValue * 100) / 100,
      decisions,
      requirements: groups,
      assigned_lines: assignedLines,
      csv_rows: csvRows
    };
  }

  public async getBatchDecisions(batchId?: string): Promise<ProcurementDecision[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = batchId ? { batch_id: batchId } : {};
        const docs = await ProcurementDecisionModel.find(query).lean();
        return docs as any;
      } catch {
        return [];
      }
    }
    return [];
  }
}
