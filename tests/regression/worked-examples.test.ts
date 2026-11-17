import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BatchService, BatchProcessingResult } from '../../apps/api/src/services/batch.service';

describe('Regression Verification: All 14 Worked Decisions (Worked_Examples.pdf)', () => {
  let batchResult: BatchProcessingResult;

  beforeAll(async () => {
    const taskKitDir = path.resolve(__dirname, '../../../');
    const samplePrCsv = fs.readFileSync(path.join(taskKitDir, 'pr_batches/sample_pr_batch.csv'), 'utf-8');
    const batchService = new BatchService();
    batchResult = await batchService.processBatchCSV(samplePrCsv, 'sample_pr_batch.csv');
  });

  const getDecisionForPR = (prNo: string) => {
    const line = batchResult.assigned_lines.find((l) => l.pr_no === prNo);
    expect(line).toBeDefined();
    const d = batchResult.decisions.find((dec) => dec.group_id === line?.group_id);
    expect(d).toBeDefined();
    return d!;
  };

  it('1. Contract PO: PR-26-00019/1', () => {
    const d = getDecisionForPR('PR-26-00019');
    expect(d.decision).toBe('PO');
    expect(d.route).toBe('CONTRACT_PO');
    expect(d.supplier_id).toBe('S001');
    expect(Math.round(d.unit_price!)).toBe(9169);
    expect(Math.round(d.group_value_inr)).toBe(137531);
    expect(d.po_id).toBeDefined();
  });

  it('2. Contract that exists only as a PDF: PR-26-00045/1', () => {
    const d = getDecisionForPR('PR-26-00045');
    expect(d.decision).toBe('PO');
    expect(d.route).toBe('CONTRACT_PO');
    expect(d.supplier_id).toBe('S021');
    expect(Math.round(d.unit_price!)).toBe(2439);
    expect(Math.round(d.group_value_inr)).toBe(26829);
  });

  it('3. Contract ceiling nearly used up: PR-26-00004/1 and PR-26-00026/1', () => {
    const d4 = getDecisionForPR('PR-26-00004');
    const d26 = getDecisionForPR('PR-26-00026');
    expect(d4.group_id).toBe(d26.group_id);
    expect(d4.route).toBe('RFQ');
    expect(d4.decision).toBe('SOURCING_REQUEST');
    expect(Math.round(d4.group_value_inr)).toBe(220256);
    expect(d4.suggested_supplier_ids).toEqual(['S014', 'S013', 'S016']);
  });

  it('4. Two contracts for the same item: PR-26-00034/1 and PR-26-00032/1', () => {
    const d34 = getDecisionForPR('PR-26-00034');
    const d32 = getDecisionForPR('PR-26-00032');
    expect(d34.group_id).toBe(d32.group_id);
    expect(d34.decision).toBe('PO');
    expect(d34.route).toBe('CONTRACT_PO');
    expect(d34.supplier_id).toBe('S007');
    expect(Math.round(d34.group_value_inr)).toBe(32547);
  });

  it('5. Split PRs clubbed into one requirement: PR-26-00146, 144, 145', () => {
    const d146 = getDecisionForPR('PR-26-00146');
    const d144 = getDecisionForPR('PR-26-00144');
    const d145 = getDecisionForPR('PR-26-00145');
    expect(d146.group_id).toBe(d144.group_id);
    expect(d146.group_id).toBe(d145.group_id);
    expect(d146.decision).toBe('PO');
    expect(d146.route).toBe('SPOT_PO');
    expect(d146.supplier_id).toBe('S024');
    expect(Math.round(d146.group_value_inr)).toBe(126472);
  });

  it('6. Same item, but not clubbed: PR-26-00106/1 (PUN1) vs PR-26-00103/1 (CHK1)', () => {
    const d106 = getDecisionForPR('PR-26-00106');
    const d103 = getDecisionForPR('PR-26-00103');
    expect(d106.group_id).not.toBe(d103.group_id);
    expect(d106.route).toBe('SPOT_PO');
    expect(d103.route).toBe('SPOT_PO');
    expect(d106.supplier_id).toBe('S027');
    expect(d103.supplier_id).toBe('S027');
    expect(Math.round(d106.group_value_inr)).toBe(156170);
  });

  it('7. Free-text item matched: PR-26-00088/1', () => {
    const d = getDecisionForPR('PR-26-00088');
    expect(d.resolved_item_code).toBe('ITM-1035');
    expect(d.decision).toBe('PO');
    expect(d.route).toBe('SPOT_PO');
    expect(d.supplier_id).toBe('S023');
    expect(Math.round(d.group_value_inr)).toBe(97955);
  });

  it('8. Emergency PO: PR-26-00059/1', () => {
    const d = getDecisionForPR('PR-26-00059');
    expect(d.decision).toBe('PO');
    expect(d.route).toBe('EMERGENCY_PO');
    expect(d.supplier_id).toBe('S014');
    expect(Math.round(d.group_value_inr)).toBe(253184);
  });

  it('9. RFQ: above the PO limit: PR-26-00089/1', () => {
    const d = getDecisionForPR('PR-26-00089');
    expect(d.resolved_item_code).toBe('ITM-1066');
    expect(d.decision).toBe('SOURCING_REQUEST');
    expect(d.route).toBe('RFQ');
    expect(Math.round(d.group_value_inr)).toBe(336562);
    expect(d.suggested_supplier_ids).toEqual(['S043', 'S044', 'S042']);
  });

  it('10. RFQ: small but never bought: PR-26-00050/1', () => {
    const d = getDecisionForPR('PR-26-00050');
    expect(d.decision).toBe('SOURCING_REQUEST');
    expect(d.route).toBe('RFQ');
    expect(Math.round(d.group_value_inr)).toBe(80300);
    expect(d.suggested_supplier_ids).toEqual(['S003', 'S002', 'S005']);
  });

  it('11. RFP: PR-26-00100/1', () => {
    const d = getDecisionForPR('PR-26-00100');
    expect(d.decision).toBe('SOURCING_REQUEST');
    expect(d.route).toBe('RFP');
    expect(d.group_value_inr).toBeGreaterThanOrEqual(1000000);
    expect(d.suggested_supplier_ids).toEqual(['S020', 'S017', 'S019', 'S018']);
  });

  it('12. Capex: PR-26-00047/1', () => {
    const d = getDecisionForPR('PR-26-00047');
    expect(d.resolved_item_code).toBe('ITM-1071');
    expect(d.decision).toBe('SOURCING_REQUEST');
    expect(d.route).toBe('CAPEX_SOURCING');
    expect(d.suggested_supplier_ids).toEqual(['S045', 'S047', 'S020', 'S048', 'S046']);
    expect(Math.round(d.group_value_inr)).toBe(6036704);
  });

  it('13. New item: PR-26-00170/1', () => {
    const d = getDecisionForPR('PR-26-00170');
    expect(d.resolved_item_code).toBe('NEW');
    expect(d.decision).toBe('SOURCING_REQUEST');
    expect(d.route).toBe('NEW_ITEM_SOURCING');
    expect(d.suggested_supplier_ids.length).toBe(0);
    expect(d.group_value_inr).toBe(141100);
  });

  it('14. Several requirements on one PO: PR-26-00031/1 and PR-26-00034/1', () => {
    const d31 = getDecisionForPR('PR-26-00031');
    const d34 = getDecisionForPR('PR-26-00034');
    expect(d31.po_id).toBeDefined();
    expect(d34.po_id).toBeDefined();
    expect(d31.po_id).toBe(d34.po_id);
  });
});
