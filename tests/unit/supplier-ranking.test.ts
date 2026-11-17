import { describe, it, expect, beforeAll } from 'vitest';
import { SupplierRankingEngine } from '../../apps/api/src/engines/supplier-ranking';
import { Supplier, PurchaseHistoryRecord, Contract } from '@corvo/shared-types';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

describe('Supplier Ranking Engine (Policy Section 6 & Worked Examples)', () => {
  let engine: SupplierRankingEngine;

  beforeAll(() => {
    const taskKitDir = path.resolve(__dirname, '../../../');
    const suppliersCsv = fs.readFileSync(path.join(taskKitDir, 'master_data/supplier_master.csv'), 'utf-8');
    const poHistoryCsv = fs.readFileSync(path.join(taskKitDir, 'master_data/po_history.csv'), 'utf-8');
    const contractRegCsv = fs.readFileSync(path.join(taskKitDir, 'contracts/contract_register.csv'), 'utf-8');
    const contractLinesCsv = fs.readFileSync(path.join(taskKitDir, 'contracts/contract_lines.csv'), 'utf-8');

    const sRecords = parse(suppliersCsv, { columns: true, trim: true });
    const poRecords = parse(poHistoryCsv, { columns: true, trim: true });
    const cRegRecords = parse(contractRegCsv, { columns: true, trim: true });
    const cLineRecords = parse(contractLinesCsv, { columns: true, trim: true });

    const suppliers: Supplier[] = sRecords.map((r: any) => ({
      supplier_id: r.supplier_id,
      name: r.name,
      city: r.city,
      categories: r.categories.split(';').map((c: string) => c.trim()),
      status: r.status,
      on_time_pct: parseFloat(r.on_time_pct),
      quality_rating: parseFloat(r.quality_rating)
    }));

    const poHistory: PurchaseHistoryRecord[] = poRecords.map((r: any) => ({
      po_number: r.po_number,
      po_date: r.po_date,
      supplier_id: r.supplier_id,
      item_code: r.item_code,
      quantity: parseFloat(r.quantity),
      uom: r.uom,
      unit_price: parseFloat(r.unit_price),
      plant: r.plant,
      delivered_on_time: r.delivered_on_time === 'True'
    }));

    const linesByContract: Record<string, any> = {};
    for (const l of cLineRecords) {
      if (!linesByContract[l.contract_id]) linesByContract[l.contract_id] = {};
      linesByContract[l.contract_id][l.item_code] = {
        rate: parseFloat(l.rate),
        description: l.description,
        uom: l.uom
      };
    }

    const contracts: Contract[] = cRegRecords.map((r: any) => ({
      contract_id: r.contract_id,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      start_date: r.start_date,
      end_date: r.end_date,
      value_cap: parseFloat(r.value_cap),
      consumed_value: parseFloat(r.consumed_value),
      lines: linesByContract[r.contract_id] || {}
    }));

    engine = new SupplierRankingEngine(suppliers, poHistory, contracts);
  });

  it('verifies Example A: ITM-1048 Nitrile coated gloves as of 1 Nov 2026', () => {
    const rankings = engine.rankSuppliers('ITM-1048', '2026-11-01');
    expect(rankings.length).toBe(2);
    expect(rankings[0].supplier_id).toBe('S029'); // SafeGuard
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].po_count_548d).toBe(7);
    expect(rankings[0].recency_score).toBe(1.0);
    expect(rankings[0].has_contract).toBe(true);

    expect(rankings[1].supplier_id).toBe('S030'); // Karam
    expect(rankings[1].rank).toBe(2);
    expect(rankings[1].po_count_548d).toBe(4);
    expect(rankings[1].recency_score).toBe(1.0);
    expect(rankings[1].has_contract).toBe(false);

    // S031 Udyogi is Inactive, must be excluded!
    expect(rankings.some((r) => r.supplier_id === 'S031')).toBe(false);
  });

  it('verifies Example B: ITM-1036 Pneumatic cylinder 50x100 as of 1 Nov 2026', () => {
    const rankings = engine.rankSuppliers('ITM-1036', '2026-11-01');
    expect(rankings.length).toBe(3);
    expect(rankings[0].supplier_id).toBe('S023'); // Hydrax
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].recency_score).toBe(1.0);

    expect(rankings[1].supplier_id).toBe('S022'); // Fluidline
    expect(rankings[1].rank).toBe(2);
    expect(rankings[1].recency_score).toBe(0.5);

    expect(rankings[2].supplier_id).toBe('S024'); // Janatics
    expect(rankings[2].rank).toBe(3);
    expect(rankings[2].recency_score).toBe(0.0);
  });

  it('verifies Example C: ITM-1016 MIG wire ER70S-6 1.2mm as of 1 Nov 2026', () => {
    const rankings = engine.rankSuppliers('ITM-1016', '2026-11-01');
    expect(rankings.length).toBe(2);
    expect(rankings[0].supplier_id).toBe('S009'); // Weldtech
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].has_contract).toBe(true);

    expect(rankings[1].supplier_id).toBe('S010'); // Inox
    expect(rankings[1].rank).toBe(2);
    expect(rankings[1].has_contract).toBe(false);
  });
});
