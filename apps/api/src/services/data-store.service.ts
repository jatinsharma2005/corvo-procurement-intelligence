import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { Item, Supplier, PurchaseHistoryRecord, Contract } from '@corvo/shared-types';
import { ItemModel } from '../models/Item';
import { SupplierModel } from '../models/Supplier';
import { PurchaseHistoryModel } from '../models/PurchaseHistory';
import { ContractModel } from '../models/Contract';

export function findTaskKitDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../../..'),
    path.resolve(__dirname, '../../../../'),
    path.resolve(process.cwd(), '..'),
    process.cwd(),
    'C:\\Users\\ns448\\OneDrive\\Desktop\\cellint ai\\Cantill_FullStack_Task_Kit',
    'C:\\Users\\ns448\\OneDrive\\Desktop\\cellint.ai\\Cantill_FullStack_Task_Kit'
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'master_data/item_master.csv'))) {
      return c;
    }
  }
  return 'C:\\Users\\ns448\\OneDrive\\Desktop\\cellint.ai\\Cantill_FullStack_Task_Kit';
}

export class DataStore {
  private static instance: DataStore;
  private items: Item[] = [];
  private suppliers: Supplier[] = [];
  private poHistory: PurchaseHistoryRecord[] = [];
  private contracts: Contract[] = [];
  private isLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public async loadData(forceReload = false): Promise<void> {
    if (this.isLoaded && !forceReload) return;

    if (mongoose.connection.readyState === 1) {
      try {
        const [itemsDocs, suppliersDocs, poDocs, contractDocs] = await Promise.all([
          ItemModel.find().lean(),
          SupplierModel.find().lean(),
          PurchaseHistoryModel.find().lean(),
          ContractModel.find().lean()
        ]);

        if (itemsDocs.length > 0) {
          this.items = itemsDocs.map((d: any) => ({
            item_code: d.item_code,
            description: d.description,
            uom: d.uom,
            category: d.category,
            item_type: d.item_type,
            standard_price: d.standard_price
          }));
          this.suppliers = suppliersDocs.map((d: any) => ({
            supplier_id: d.supplier_id,
            name: d.name,
            city: d.city,
            categories: d.categories,
            status: d.status,
            on_time_pct: d.on_time_pct,
            quality_rating: d.quality_rating
          }));
          this.poHistory = poDocs.map((d: any) => ({
            po_number: d.po_number,
            po_date: typeof d.po_date === 'string' ? d.po_date : d.po_date.toISOString().split('T')[0],
            supplier_id: d.supplier_id,
            item_code: d.item_code,
            quantity: d.quantity,
            uom: d.uom,
            unit_price: d.unit_price,
            plant: d.plant,
            delivered_on_time: d.delivered_on_time
          }));
          this.contracts = contractDocs.map((d: any) => ({
            contract_id: d.contract_id,
            supplier_id: d.supplier_id,
            supplier_name: d.supplier_name,
            start_date: typeof d.start_date === 'string' ? d.start_date : d.start_date.toISOString().split('T')[0],
            end_date: typeof d.end_date === 'string' ? d.end_date : d.end_date.toISOString().split('T')[0],
            value_cap: d.value_cap,
            consumed_value: d.consumed_value,
            lines: d.lines instanceof Map ? Object.fromEntries(d.lines) : d.lines || {},
            is_pdf_only: d.is_pdf_only
          }));
          this.isLoaded = true;
          return;
        }
      } catch (err: any) {
        console.warn(`[DataStore] MongoDB read error: ${err.message}. Loading from local task kit CSVs.`);
      }
    }

    this.loadFromFiles();
    this.isLoaded = true;
  }

  private loadFromFiles(): void {
    const taskKitDir = findTaskKitDir();

    // 1. Items
    const itemsPath = path.join(taskKitDir, 'master_data/item_master.csv');
    if (fs.existsSync(itemsPath)) {
      const records = parse(fs.readFileSync(itemsPath, 'utf-8'), { columns: true, trim: true });
      this.items = records.map((r: any) => ({
        item_code: r.item_code,
        description: r.description,
        uom: r.uom,
        category: r.category,
        item_type: r.item_type,
        standard_price: parseFloat(r.standard_price)
      }));
    }

    // 2. Suppliers
    const suppliersPath = path.join(taskKitDir, 'master_data/supplier_master.csv');
    if (fs.existsSync(suppliersPath)) {
      const records = parse(fs.readFileSync(suppliersPath, 'utf-8'), { columns: true, trim: true });
      this.suppliers = records.map((r: any) => ({
        supplier_id: r.supplier_id,
        name: r.name,
        city: r.city,
        categories: r.categories.split(';').map((c: string) => c.trim()),
        status: r.status,
        on_time_pct: parseFloat(r.on_time_pct),
        quality_rating: parseFloat(r.quality_rating)
      }));
    }

    // 3. PO History
    const poPath = path.join(taskKitDir, 'master_data/po_history.csv');
    if (fs.existsSync(poPath)) {
      const records = parse(fs.readFileSync(poPath, 'utf-8'), { columns: true, trim: true });
      this.poHistory = records.map((r: any) => ({
        po_number: r.po_number,
        po_date: r.po_date,
        supplier_id: r.supplier_id,
        item_code: r.item_code,
        quantity: parseFloat(r.quantity),
        uom: r.uom,
        unit_price: parseFloat(r.unit_price),
        plant: r.plant,
        delivered_on_time: r.delivered_on_time === 'True' || r.delivered_on_time === true
      }));
    }

    // 4. Contracts
    const cRegPath = path.join(taskKitDir, 'contracts/contract_register.csv');
    const cLinesPath = path.join(taskKitDir, 'contracts/contract_lines.csv');

    if (fs.existsSync(cRegPath) && fs.existsSync(cLinesPath)) {
      const regRecords = parse(fs.readFileSync(cRegPath, 'utf-8'), { columns: true, trim: true });
      const linesRecords = parse(fs.readFileSync(cLinesPath, 'utf-8'), { columns: true, trim: true });

      const linesByContract: Record<string, any> = {};
      for (const l of linesRecords) {
        if (!linesByContract[l.contract_id]) linesByContract[l.contract_id] = {};
        linesByContract[l.contract_id][l.item_code] = {
          rate: parseFloat(l.rate),
          description: l.description,
          uom: l.uom
        };
      }

      this.contracts = regRecords.map((r: any) => ({
        contract_id: r.contract_id,
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        start_date: r.start_date,
        end_date: r.end_date,
        value_cap: parseFloat(r.value_cap),
        consumed_value: parseFloat(r.consumed_value),
        lines: linesByContract[r.contract_id] || {},
        is_pdf_only: false
      }));

      // Add signed PDF-only contracts
      this.contracts.push(
        {
          contract_id: 'RC-2026-031',
          supplier_id: 'S021',
          supplier_name: 'Pneumatic Point',
          start_date: '2026-11-15',
          end_date: '2027-11-14',
          value_cap: 2000000.0,
          consumed_value: 0.0,
          lines: {
            'ITM-1036': { item_code: 'ITM-1036', rate: 3537.76, description: 'Pneumatic cylinder 50x100', uom: 'NOS' },
            'ITM-1037': { item_code: 'ITM-1037', rate: 2439.01, description: 'Solenoid valve 5/2 1/4 inch', uom: 'NOS' },
            'ITM-1039': { item_code: 'ITM-1039', rate: 2746.87, description: 'FRL unit 1/2 inch', uom: 'NOS' }
          },
          is_pdf_only: true
        },
        {
          contract_id: 'RC-2026-033',
          supplier_id: 'S035',
          supplier_name: 'Infoline Systems',
          start_date: '2026-11-20',
          end_date: '2027-11-19',
          value_cap: 5000000.0,
          consumed_value: 0.0,
          lines: {
            'ITM-1056': { item_code: 'ITM-1056', rate: 64654.36, description: 'Laptop i5 16GB 512GB', uom: 'NOS' },
            'ITM-1057': { item_code: 'ITM-1057', rate: 10689.51, description: '24 inch monitor', uom: 'NOS' }
          },
          is_pdf_only: true
        }
      );
    }
  }

  public getItems(): Item[] {
    return this.items;
  }

  public getSuppliers(): Supplier[] {
    return this.suppliers;
  }

  public getPOHistory(): PurchaseHistoryRecord[] {
    return this.poHistory;
  }

  public getContracts(): Contract[] {
    return this.contracts;
  }
}
