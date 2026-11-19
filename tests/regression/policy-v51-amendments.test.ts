import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { BatchService, BatchProcessingResult } from '../../apps/api/src/services/batch.service';
import { PolicyService } from '../../apps/api/src/services/policy.service';
import { AIService } from '../../apps/api/src/services/ai.service';
import { DEFAULT_POLICY_V5, DEFAULT_POLICY_V5_1 } from '@corvo/policy-schema';

describe('Corvo Policy v5.1 Amendments & Compliance Regression Suite', () => {
  let batchService: BatchService;
  let policyService: PolicyService;
  let samplePrCsv: string;
  let run1Result: BatchProcessingResult; // Policy v5.0
  let run2Result: BatchProcessingResult; // Policy v5.1

  beforeAll(async () => {
    batchService = new BatchService();
    policyService = new PolicyService();

    const taskKitDir = path.resolve(__dirname, '../../../');
    const batchCsvPath = path.join(taskKitDir, 'pr_batches/sample_pr_batch.csv');
    samplePrCsv = fs.readFileSync(batchCsvPath, 'utf-8');

    // Run 1 under Baseline v5.0
    run1Result = await batchService.processBatchCSV(samplePrCsv, 'sample_pr_batch.csv', DEFAULT_POLICY_V5);

    // Run 2 under Amended v5.1
    run2Result = await batchService.processBatchCSV(samplePrCsv, 'sample_pr_batch.csv', DEFAULT_POLICY_V5_1);
  });

  const getDecision = (batchResult: BatchProcessingResult, prNo: string) => {
    const line = batchResult.assigned_lines.find((l) => l.pr_no === prNo);
    expect(line).toBeDefined();
    const d = batchResult.decisions.find((dec) => dec.group_id === line?.group_id);
    expect(d).toBeDefined();
    return d!;
  };

  describe('Part 1: Baseline Policy v5.0 Verification', () => {
    it('Policy v5.0 allows Packaging Spot PO up to ₹2,00,000 (PR-26-00106)', () => {
      // PR-26-00106: Packaging item ITM-1044 with group value ~₹1,56,170
      const d1 = getDecision(run1Result, 'PR-26-00106');
      expect(d1.decision).toBe('PO');
      expect(d1.route).toBe('SPOT_PO');
      expect(d1.group_value_inr).toBeGreaterThan(100000);
      expect(d1.group_value_inr).toBeLessThan(200000);
    });

    it('Policy v5.0 routes sourcing between ₹8,00,000 and ₹10,00,000 to RFQ (PR-26-00124)', () => {
      // PR-26-00124: ITM-1004 with group value ₹9,50,950
      const d1 = getDecision(run1Result, 'PR-26-00124');
      expect(d1.decision).toBe('SOURCING_REQUEST');
      expect(d1.route).toBe('RFQ');
      expect(d1.group_value_inr).toBeGreaterThanOrEqual(800000);
      expect(d1.group_value_inr).toBeLessThan(1000000);
    });

    it('Policy v5.0 allows Chakan Electrical Spares under ₹2,00,000 as Spot PO (PR-26-00114)', () => {
      // PR-26-00114: CHK1, ITM-1034 (Electrical Spares), value ~₹1,22,789
      const d1 = getDecision(run1Result, 'PR-26-00114');
      expect(d1.decision).toBe('PO');
      expect(d1.route).toBe('SPOT_PO');
      expect(d1.supplier_id).toBe('S020');
    });
  });

  describe('Part 2: Amended Policy v5.1 Clauses (A1, A2, A3) Verification', () => {
    it('Clause A1: Packaging requirement >= ₹1,00,000 shifts from SPOT_PO to RFQ (PR-26-00106)', () => {
      // In Run 1 (v5.0): PO (SPOT_PO)
      // In Run 2 (v5.1): SOURCING_REQUEST (RFQ) because limit is reduced to ₹1,00,000
      const d1 = getDecision(run1Result, 'PR-26-00106');
      const d2 = getDecision(run2Result, 'PR-26-00106');

      expect(d1.route).toBe('SPOT_PO');
      expect(d2.decision).toBe('SOURCING_REQUEST');
      expect(d2.route).toBe('RFQ');
      expect(d2.policy_version).toMatch(/5\.1/);
    });

    it('Clause A1: Non-Packaging items maintain ₹2,00,000 Spot PO threshold in v5.1 (PR-26-00146)', () => {
      // PR-26-00146: ITM-1038 (PUN1, Mechanical Spares, value ~₹1,26,471 > 1L but < 2L)
      const d2 = getDecision(run2Result, 'PR-26-00146');
      expect(d2.decision).toBe('PO');
      expect(d2.route).toBe('SPOT_PO');
      expect(d2.group_value_inr).toBeGreaterThan(100000);
      expect(d2.group_value_inr).toBeLessThan(200000);
    });

    it('Clause A2: Sourcing requirement >= ₹8,00,000 shifts from RFQ to RFP (PR-26-00124)', () => {
      // In Run 1 (v5.0): RFQ (value ₹9,50,950 < 10L)
      // In Run 2 (v5.1): RFP (value >= 8L)
      const d1 = getDecision(run1Result, 'PR-26-00124');
      const d2 = getDecision(run2Result, 'PR-26-00124');

      expect(d1.route).toBe('RFQ');
      expect(d2.decision).toBe('SOURCING_REQUEST');
      expect(d2.route).toBe('RFP');
      expect(d2.suggested_supplier_ids.length).toBeGreaterThanOrEqual(4);
      expect(d2.reason).toContain('Value >= 8L');
    });

    it('Clause A3: Chakan plant Electrical Spares >= ₹50,000 shifts from SPOT_PO to RFQ (PR-26-00114)', () => {
      // In Run 1 (v5.0): PO (SPOT_PO)
      // In Run 2 (v5.1): SOURCING_REQUEST (RFQ) due to Clause 5.2A
      const d1 = getDecision(run1Result, 'PR-26-00114');
      const d2 = getDecision(run2Result, 'PR-26-00114');

      expect(d1.route).toBe('SPOT_PO');
      expect(d2.decision).toBe('SOURCING_REQUEST');
      expect(d2.route).toBe('RFQ');
      expect(d2.reason).toContain('Clause 5.2A');
    });

    it('Clause A3: Valid Rate Contract (Rule 5.2) takes precedence over Rule 5.2A (PR-26-00019)', () => {
      // Rate contract PO remains CONTRACT_PO in both runs
      const d1 = getDecision(run1Result, 'PR-26-00019');
      const d2 = getDecision(run2Result, 'PR-26-00019');

      expect(d1.route).toBe('CONTRACT_PO');
      expect(d2.route).toBe('CONTRACT_PO');
      expect(d2.decision).toBe('PO');
      expect(d2.supplier_id).toBe('S001');
    });
  });

  describe('Part 3: Policy Studio Parsing, Validation & Draft Safeguards', () => {
    it('Rejects non-procurement documents without saving draft', async () => {
      const nonPolicyText = `
        TAX INVOICE 99482
        Seller: XYZ Hardware Corp
        Buyer: Corvo Engineering
        Total Amount: INR 45,000
        Payment Terms: 30 Days
      `;

      await expect(policyService.proposeAmendment({ text: nonPolicyText })).rejects.toThrow(
        /not contain official Corvo Procurement Policy headers|authorized procurement amendment circulars/i
      );
    });

    it('Parses official Amendment No. 1 document text and extracts clauses A1, A2, A3 with metadata', async () => {
      const amendmentText = `
        Corvo Engineering Pvt Ltd: Procurement Policy Amendment
        No. 1
        Amends CORVO-PROC-POL-04 version 5.0 · New version 5.1 · Effective 1 December 2026 · Approved by the CFO on 20 November 2026
        Following the half-year review, the Procurement Committee has approved the changes below. All other clauses of version 5.0 remain unchanged.
        Changes
        A1
        Packaging spot limit. For items in the Packaging category, the limit in rule 5.4 (spot PO) is reduced from ₹2,00,000 to ₹1,00,000. Packaging requirements at or above ₹1,00,000 must be sourced.
        A2
        RFP threshold. The value at which a formal RFP is required (rules 5.5 and 5.6) is reduced from ₹10,00,000 to ₹8,00,000. Requirements below ₹8,00,000 that need sourcing go to RFQ; ₹8,00,000 or more go to RFP.
        A3
        New rule 5.2A, Chakan electrical safety. At the Chakan plant (CHK1), every requirement in the Electrical Spares category worth ₹50,000 or more must be sourced (RFQ, or RFP at or above the RFP threshold), even if it would otherwise qualify for an emergency or spot PO. A contract PO (rule 5.2) is still allowed. This rule is applied immediately after rule 5.2.
      `;

      const result = await policyService.proposeAmendment({ text: amendmentText });

      expect(result.draftPolicy.version).toBe('5.1');
      expect(result.draftPolicy.status).toBe('DRAFT');
      expect(result.draftPolicy.effective_date).toBe('2026-12-01');
      expect(result.validation.isValid).toBe(true);

      // Verify extracted clauses
      expect(result.proposal.clauses).toBeDefined();
      expect(result.proposal.clauses?.length).toBe(3);
      expect(result.proposal.clauses?.map((c) => c.id)).toEqual(['A1', 'A2', 'A3']);

      // Verify AST generated rules
      const ruleIds = result.draftPolicy.rules.map((r) => r.rule_id);
      expect(ruleIds).toContain('RULE_5_2A_CHK1_ELECTRICAL_RFQ');
      expect(ruleIds).toContain('RULE_5_2A_CHK1_ELECTRICAL_RFP');
      expect(ruleIds).toContain('RULE_5_4_SPOT_PO_PACKAGING');
      expect(ruleIds).toContain('RULE_5_5_RFQ');
      expect(ruleIds).toContain('RULE_5_6_RFP');

      // Verify diff
      expect(result.diff.old_version).toBe('5.0');
      expect(result.diff.new_version).toBe('5.1');
      expect(result.diff.added_rules.length).toBeGreaterThan(0);
    });

    it('Administrator can reject draft policy, ensuring active baseline remains v5.0', async () => {
      // Reject draft 5.1
      const rejected = await policyService.rejectPolicyDraft('5.1');
      expect(rejected).toBe(true);

      // Active policy must still be 5.0
      const active = await policyService.getActivePolicy('2026-11-01');
      expect(active.version).toBe('5.0');
      expect(active.status).toBe('ACTIVE');
    });
  });
});
