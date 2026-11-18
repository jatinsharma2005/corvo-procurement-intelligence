import { stringify } from 'csv-stringify/sync';
import { DecisionCSVRow, PreferredSupplierCSVRow } from '@corvo/shared-types';
import { SupplierRankingEngine } from '../engines/supplier-ranking';
import { DataStore } from './data-store.service';
import { ProcurementDecisionModel } from '../models/ProcurementDecision';
import { PurchaseRequestLineModel } from '../models/PurchaseRequest';
import mongoose from 'mongoose';

function sanitizeCSVField(val: any): any {
  if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

export class ExportService {
  public generateDecisionsCSV(rows: DecisionCSVRow[]): string {
    const sanitizedRows = rows.map((row) => {
      const sanitized: any = {};
      for (const [k, v] of Object.entries(row)) {
        sanitized[k] = sanitizeCSVField(v);
      }
      return sanitized as DecisionCSVRow;
    });

    return stringify(sanitizedRows, {
      header: true,
      columns: [
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
      ]
    });
  }

  public async generatePreferredSuppliersCSV(asOfDate: string = '2026-11-01'): Promise<string> {
    const dataStore = DataStore.getInstance();
    await dataStore.loadData();

    const items = dataStore.getItems();
    const suppliers = dataStore.getSuppliers();
    const poHistory = dataStore.getPOHistory();
    const contracts = dataStore.getContracts();

    const rankingEngine = new SupplierRankingEngine(suppliers, poHistory, contracts);
    const rows: PreferredSupplierCSVRow[] = [];

    // Sort items by item_code ascending for deterministic output
    const sortedItems = [...items].sort((a, b) => a.item_code.localeCompare(b.item_code));

    for (const item of sortedItems) {
      const rankings = rankingEngine.rankSuppliers(item.item_code, asOfDate);
      // Top 3 preferred suppliers
      const top3 = rankings.slice(0, 3);
      for (const r of top3) {
        rows.push({
          item_code: item.item_code,
          rank: r.rank,
          supplier_id: r.supplier_id,
          reference_price: r.reference_price !== undefined ? r.reference_price : ''
        });
      }
    }

    return stringify(rows, {
      header: true,
      columns: ['item_code', 'rank', 'supplier_id', 'reference_price']
    });
  }
}
