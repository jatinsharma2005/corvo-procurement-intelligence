import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../models';
import { PlantModel } from '../models/Plant';
import { ItemModel } from '../models/Item';
import { SupplierModel } from '../models/Supplier';
import { PurchaseHistoryModel } from '../models/PurchaseHistory';
import { ContractModel } from '../models/Contract';
import { PolicyVersionModel } from '../models/PolicyVersion';
import { UserModel } from '../models/User';
import { DEFAULT_POLICY_V5 } from '@corvo/policy-schema';
import { findTaskKitDir } from '../services/data-store.service';

// Path to task kit
const TASK_KIT_DIR = findTaskKitDir();

export async function seedDatabase() {
  console.log('🌱 Starting Corvo Procurement Database Seed...');
  await connectDatabase();

  // 1. Seed Plants
  const plantsCsvPath = path.join(TASK_KIT_DIR, 'master_data/plants.csv');
  if (fs.existsSync(plantsCsvPath)) {
    const records = parse(fs.readFileSync(plantsCsvPath, 'utf-8'), { columns: true, trim: true });
    for (const r of records) {
      await PlantModel.findOneAndUpdate(
        { plant: r.plant },
        { plant: r.plant, name: r.name },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${records.length} plants`);
  }

  // 2. Seed Items
  const itemsCsvPath = path.join(TASK_KIT_DIR, 'master_data/item_master.csv');
  if (fs.existsSync(itemsCsvPath)) {
    const records = parse(fs.readFileSync(itemsCsvPath, 'utf-8'), { columns: true, trim: true });
    for (const r of records) {
      await ItemModel.findOneAndUpdate(
        { item_code: r.item_code },
        {
          item_code: r.item_code,
          description: r.description,
          uom: r.uom,
          category: r.category,
          item_type: r.item_type,
          standard_price: parseFloat(r.standard_price)
        },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${records.length} items`);
  }

  // 3. Seed Suppliers
  const suppliersCsvPath = path.join(TASK_KIT_DIR, 'master_data/supplier_master.csv');
  if (fs.existsSync(suppliersCsvPath)) {
    const records = parse(fs.readFileSync(suppliersCsvPath, 'utf-8'), { columns: true, trim: true });
    for (const r of records) {
      const categories = r.categories.split(';').map((c: string) => c.trim()).filter(Boolean);
      await SupplierModel.findOneAndUpdate(
        { supplier_id: r.supplier_id },
        {
          supplier_id: r.supplier_id,
          name: r.name,
          city: r.city,
          categories,
          status: r.status,
          on_time_pct: parseFloat(r.on_time_pct),
          quality_rating: parseFloat(r.quality_rating)
        },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${records.length} suppliers`);
  }

  // 4. Seed Contracts
  const contractRegCsvPath = path.join(TASK_KIT_DIR, 'contracts/contract_register.csv');
  const contractLinesCsvPath = path.join(TASK_KIT_DIR, 'contracts/contract_lines.csv');

  if (fs.existsSync(contractRegCsvPath) && fs.existsSync(contractLinesCsvPath)) {
    const regRecords = parse(fs.readFileSync(contractRegCsvPath, 'utf-8'), { columns: true, trim: true });
    const linesRecords = parse(fs.readFileSync(contractLinesCsvPath, 'utf-8'), { columns: true, trim: true });

    const linesByContract = new Map<string, Record<string, { rate: number; description: string; uom: string }>>();
    for (const l of linesRecords) {
      if (!linesByContract.has(l.contract_id)) {
        linesByContract.set(l.contract_id, {});
      }
      linesByContract.get(l.contract_id)![l.item_code] = {
        rate: parseFloat(l.rate),
        description: l.description,
        uom: l.uom
      };
    }

    for (const r of regRecords) {
      const lines = linesByContract.get(r.contract_id) || {};
      await ContractModel.findOneAndUpdate(
        { contract_id: r.contract_id },
        {
          contract_id: r.contract_id,
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          start_date: new Date(r.start_date),
          end_date: new Date(r.end_date),
          value_cap: parseFloat(r.value_cap),
          consumed_value: parseFloat(r.consumed_value),
          lines: new Map(Object.entries(lines)),
          is_pdf_only: false
        },
        { upsert: true }
      );
    }

    // 5. Seed PDF-only contracts (RC-2026-031 & RC-2026-033)
    const pdfContracts = [
      {
        contract_id: 'RC-2026-031',
        supplier_id: 'S021',
        supplier_name: 'Pneumatic Point',
        start_date: new Date('2026-11-15'),
        end_date: new Date('2027-11-14'),
        value_cap: 2000000.0,
        consumed_value: 0.0,
        lines: new Map([
          ['ITM-1036', { rate: 3537.76, description: 'Pneumatic cylinder 50x100', uom: 'NOS' }],
          ['ITM-1037', { rate: 2439.01, description: 'Solenoid valve 5/2 1/4 inch', uom: 'NOS' }],
          ['ITM-1039', { rate: 2746.87, description: 'FRL unit 1/2 inch', uom: 'NOS' }]
        ]),
        is_pdf_only: true
      },
      {
        contract_id: 'RC-2026-033',
        supplier_id: 'S035',
        supplier_name: 'Infoline Systems',
        start_date: new Date('2026-11-20'),
        end_date: new Date('2027-11-19'),
        value_cap: 5000000.0,
        consumed_value: 0.0,
        lines: new Map([
          ['ITM-1056', { rate: 64654.36, description: 'Laptop i5 16GB 512GB', uom: 'NOS' }],
          ['ITM-1057', { rate: 10689.51, description: '24 inch monitor', uom: 'NOS' }]
        ]),
        is_pdf_only: true
      }
    ];

    for (const pc of pdfContracts) {
      await ContractModel.findOneAndUpdate(
        { contract_id: pc.contract_id },
        pc,
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${regRecords.length + pdfContracts.length} contracts (including 2 signed PDF-only contracts)`);
  }

  // 6. Seed PO History
  const poHistoryCsvPath = path.join(TASK_KIT_DIR, 'master_data/po_history.csv');
  if (fs.existsSync(poHistoryCsvPath)) {
    const records = parse(fs.readFileSync(poHistoryCsvPath, 'utf-8'), { columns: true, trim: true });
    // Clear and bulk insert
    await PurchaseHistoryModel.deleteMany({});
    const docs = records.map((r: any) => ({
      po_number: r.po_number,
      po_date: new Date(r.po_date),
      supplier_id: r.supplier_id,
      item_code: r.item_code,
      quantity: parseFloat(r.quantity),
      uom: r.uom,
      unit_price: parseFloat(r.unit_price),
      plant: r.plant,
      delivered_on_time: r.delivered_on_time === 'True' || r.delivered_on_time === true
    }));
    await PurchaseHistoryModel.insertMany(docs);
    console.log(`✅ Seeded ${docs.length} PO history records`);
  }

  // 7. Seed Policy Version 5.0
  await PolicyVersionModel.updateMany(
    { version: { $ne: DEFAULT_POLICY_V5.version } },
    { $set: { status: 'ARCHIVED' } }
  );
  await PolicyVersionModel.findOneAndUpdate(
    { version: DEFAULT_POLICY_V5.version },
    {
      version: DEFAULT_POLICY_V5.version,
      document_number: DEFAULT_POLICY_V5.document_number,
      title: DEFAULT_POLICY_V5.title,
      effective_date: new Date(DEFAULT_POLICY_V5.effective_date),
      status: 'ACTIVE',
      parameters: DEFAULT_POLICY_V5.parameters,
      rules: DEFAULT_POLICY_V5.rules,
      created_at: new Date(DEFAULT_POLICY_V5.created_at),
      approved_at: new Date(),
      approved_by: DEFAULT_POLICY_V5.approved_by
    },
    { upsert: true }
  );
  console.log(`✅ Seeded Policy Version ${DEFAULT_POLICY_V5.version} (Status: ACTIVE)`);

  // 8. Seed Default Users
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@corvo.internal').toLowerCase().trim();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@Corvo2026!';
  const buyerEmail = (process.env.INITIAL_BUYER_EMAIL || 'buyer@corvo.internal').toLowerCase().trim();
  const buyerPassword = process.env.INITIAL_BUYER_PASSWORD || 'Buyer@Corvo2026!';

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const buyerHash = await bcrypt.hash(buyerPassword, 12);

  const defaultUsers = [
    {
      name: 'R. Sharma',
      email: buyerEmail,
      role: 'BUYER',
      department: 'Procurement',
      plant: 'PUN1'
    },
    {
      name: 'Head of Procurement',
      email: adminEmail,
      role: 'ADMIN',
      department: 'Procurement',
      plant: 'PUN1'
    },
  ];

  const usersWithHashes = [
    { ...defaultUsers[0], passwordHash: buyerHash, isActive: true },
    { ...defaultUsers[1], passwordHash: adminHash, isActive: true }
  ];
  for (const u of usersWithHashes) {
    const existing = await UserModel.findOne({ email: u.email });
    if (!existing) {
      await UserModel.create(u);
    } else {
      // Idempotent: Preserve existing passwordHash and user modifications; never overwrite existing passwords
      await UserModel.updateOne(
        { email: u.email },
        {
          $set: {
            role: existing.role || u.role,
            isActive: existing.isActive ?? true
          }
        }
      );
    }
  }
  console.log('✅ Seeded initial administrator and buyer accounts (passwords preserved if existing)');

  console.log('🎉 Corvo Procurement Database Seed Completed Successfully!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
