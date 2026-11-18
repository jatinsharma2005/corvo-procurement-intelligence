import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BatchService } from '../../apps/api/src/services/batch.service';
import { ExportService } from '../../apps/api/src/services/export.service';
import { parse } from 'csv-parse/sync';

describe('Integration Test: Full Sample Batch (186 PR Lines)', () => {
  let samplePrCsv: string;
  let batchService: BatchService;
  let exportService: ExportService;

  beforeAll(() => {
    const taskKitDir = path.resolve(__dirname, '../../../');
    samplePrCsv = fs.readFileSync(path.join(taskKitDir, 'pr_batches/sample_pr_batch.csv'), 'utf-8');
    batchService = new BatchService();
    exportService = new ExportService();
  });

  it('processes all 186 PR lines deterministically', async () => {
    const result = await batchService.processBatchCSV(samplePrCsv, 'sample_pr_batch.csv');

    // 1. Total input lines accounted for
    expect(result.total_lines).toBe(186);
    expect(result.assigned_lines.length).toBe(186);
    expect(result.csv_rows.length).toBe(186);

    // 2. Requirement groups created
    expect(result.total_requirements).toBeGreaterThan(100);
    expect(result.total_requirements).toBe(result.requirements.length);

    // 3. Purchase Orders and Sourcing Requests created
    expect(result.total_pos).toBeGreaterThan(0);
    expect(result.total_sourcing_requests).toBeGreaterThan(0);
    expect(result.total_value_inr).toBeGreaterThan(1000000);

    // 4. Policy version is 5.0
    expect(result.policy_version).toBe('5.0');

    // 5. Generate and validate Decision CSV output
    const csvStr = exportService.generateDecisionsCSV(result.csv_rows);
    const parsedCsv = parse(csvStr, { columns: true, trim: true });
    expect(parsedCsv.length).toBe(186);

    const expectedHeaders = [
      'pr_no',
      'pr_line',
      'resolved_item_code',
      'group_id',
      'po_id',
      'decision',
      'route',
      'supplier_id',
      'unit_price',
      'group_value_inr',
      'suggested_supplier_ids',
      'policy_version',
      'reason'
    ];
    expect(Object.keys(parsedCsv[0])).toEqual(expectedHeaders);

    for (const row of parsedCsv) {
      expect(row.pr_no).toBeTruthy();
      expect(row.pr_line).toBeTruthy();
      expect(row.resolved_item_code).toBeTruthy();
      expect(row.group_id).toBeTruthy();
      expect(['PO', 'SOURCING_REQUEST', 'NOT_PROCESSED']).toContain(row.decision);
      expect([
        'CONTRACT_PO',
        'EMERGENCY_PO',
        'SPOT_PO',
        'RFQ',
        'RFP',
        'CAPEX_SOURCING',
        'NEW_ITEM_SOURCING',
        'NOT_PROCESSED'
      ]).toContain(row.route);

      if (row.decision === 'PO') {
        expect(row.supplier_id).toBeTruthy();
        expect(row.po_id).toBeTruthy();
        expect(parseFloat(row.unit_price)).toBeGreaterThan(0);
      }
    }
  });

  it('exports preferred suppliers CSV with top 3 per item', async () => {
    const csvStr = await exportService.generatePreferredSuppliersCSV('2026-11-01');
    const parsedCsv = parse(csvStr, { columns: true, trim: true });

    const expectedHeaders = ['item_code', 'rank', 'supplier_id', 'reference_price'];
    expect(Object.keys(parsedCsv[0])).toEqual(expectedHeaders);

    const ranks = parsedCsv.map((r: any) => parseInt(r.rank, 10));
    expect(ranks.every((rn: number) => rn >= 1 && rn <= 3)).toBe(true);
  });
});
