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
  private static fallbackRuns: any[] = [];
  private static fallbackDecisions: ProcurementDecision[] = [];
  private static fallbackRequirements: RequirementGroup[] = [];
  private static fallbackLines: PurchaseRequestLine[] = [];

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

    if (rawRecords.length === 0) {
      throw new Error('CSV is empty or contains no data rows');
    }
    const requiredColumns = ['pr_no', 'pr_line', 'plant', 'description', 'quantity', 'need_by_date'];
    const missingColumns = requiredColumns.filter((column) => !(column in rawRecords[0]));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required CSV columns: ${missingColumns.join(', ')}`);
    }
    const invalidLineKeys = new Set<string>();
    for (const row of rawRecords) {
      const quantity = parseFloat(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        invalidLineKeys.add(`${row.pr_no}/${row.pr_line || '1'}`);
      }
    }

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
      if (invalidLineKeys.has(`${line.pr_no}/${line.pr_line}`)) {
        csvRows.push({
          pr_no: line.pr_no,
          pr_line: line.pr_line,
          resolved_item_code: d.resolved_item_code,
          group_id: d.group_id,
          po_id: '',
          decision: 'NOT_PROCESSED',
          route: 'NOT_PROCESSED',
          supplier_id: '',
          unit_price: '',
          group_value_inr: 0,
          suggested_supplier_ids: '',
          policy_version: d.policy_version,
          reason: 'Invalid quantity: quantity must be a positive number.'
        });
        continue;
      }
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
        await BatchRunModel.findOneAndUpdate(
          { batch_id: batchId },
          {
            batch_id: batchId,
            filename,
            total_lines: prLines.length,
            total_requirements: groups.length,
            total_pos: totalPOs,
            total_sourcing_requests: totalSRs,
            total_value_inr: Math.round(totalBatchValue * 100) / 100,
            policy_version: policy.version,
            status: 'COMPLETED'
          },
          { upsert: true }
        );

        if (decisions.length > 0) {
          const decisionOps = decisions.map((d) => ({
            updateOne: {
              filter: { group_id: d.group_id },
              update: {
                $set: {
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
                }
              },
              upsert: true
            }
          }));
          await ProcurementDecisionModel.bulkWrite(decisionOps as any);
        }

        if (groups.length > 0) {
          const groupOps = groups.map((g) => ({
            updateOne: {
              filter: { group_id: g.group_id },
              update: {
                $set: {
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
                }
              },
              upsert: true
            }
          }));
          await RequirementGroupModel.bulkWrite(groupOps as any);
        }

        if (assignedLines.length > 0) {
          const lineOps = assignedLines.map((l) => ({
            updateOne: {
              filter: { pr_no: l.pr_no, pr_line: l.pr_line },
              update: {
                $set: {
                  pr_no: l.pr_no,
                  pr_line: l.pr_line,
                  batch_id: batchId,
                  group_id: l.group_id,
                  created_at: new Date(l.created_at),
                  need_by_date: new Date(l.need_by_date),
                  requester: l.requester,
                  department: l.department,
                  plant: l.plant,
                  item_code: l.item_code,
                  resolved_item_code: l.item_code,
                  description: l.description,
                  quantity: l.quantity,
                  uom: l.uom,
                  estimated_unit_price: l.estimated_unit_price,
                  urgency: l.urgency || 'Normal'
                }
              },
              upsert: true
            }
          }));
          await PurchaseRequestLineModel.bulkWrite(lineOps as any);
        }
      } catch (err: any) {
        console.warn(`[BatchService] DB persistence warning: ${err.message}`);
      }
    } else {
      BatchService.fallbackRuns.unshift({
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
      BatchService.fallbackRuns = BatchService.fallbackRuns.slice(0, 20);
      BatchService.fallbackDecisions = decisions;
      BatchService.fallbackRequirements = groups;
      BatchService.fallbackLines = assignedLines;
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
        return BatchService.fallbackDecisions;
      }
    }
    return BatchService.fallbackDecisions;
  }

  public static getFallbackRuns(): any[] {
    return BatchService.fallbackRuns;
  }

  public static getFallbackRequirements(): RequirementGroup[] {
    return BatchService.fallbackRequirements;
  }

  public static getFallbackLines(): PurchaseRequestLine[] {
    return BatchService.fallbackLines;
  }
}
