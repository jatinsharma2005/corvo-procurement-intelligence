import { Router, Request, Response } from 'express';
import { SupplierModel } from '../models/Supplier';
import { ItemModel } from '../models/Item';
import { PurchaseHistoryModel } from '../models/PurchaseHistory';
import { ContractService } from '../services/contract.service';
import { SupplierRankingEngine } from '../engines/supplier-ranking';
import { Item, Supplier, PurchaseHistoryRecord } from '@corvo/shared-types';

const router = Router();
const contractService = new ContractService();

// GET /api/suppliers
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, category, search } = req.query;
    const q: any = {};
    if (status) q.status = status;
    if (category) q.categories = category;
    if (search) {
      q.$or = [
        { supplier_id: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const suppliers = await SupplierModel.find(q).sort({ supplier_id: 1 }).lean();
    return res.json({ suppliers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/suppliers/rankings
router.get('/rankings', async (req: Request, res: Response) => {
  const itemCode = req.query.item_code as string;
  const asOfDate = (req.query.as_of_date as string) || '2026-11-01';

  if (!itemCode) {
    return res.status(400).json({ error: 'item_code query parameter is required' });
  }

  try {
    const [suppliersDocs, poHistoryDocs, contracts] = await Promise.all([
      SupplierModel.find().lean(),
      PurchaseHistoryModel.find().lean(),
      contractService.getAllContracts()
    ]);

    const suppliers: Supplier[] = suppliersDocs.map((d: any) => ({
      supplier_id: d.supplier_id,
      name: d.name,
      city: d.city,
      categories: d.categories,
      status: d.status,
      on_time_pct: d.on_time_pct,
      quality_rating: d.quality_rating
    }));

    const poHistory: PurchaseHistoryRecord[] = poHistoryDocs.map((d: any) => ({
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

    const engine = new SupplierRankingEngine(suppliers, poHistory, contracts);
    const rankings = engine.rankSuppliers(itemCode, asOfDate);

    return res.json({
      item_code: itemCode,
      as_of_date: asOfDate,
      rankings
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/suppliers/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supplier = await SupplierModel.findOne({ supplier_id: req.params.id }).lean();
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // History and contracts
    const [pos, contracts] = await Promise.all([
      PurchaseHistoryModel.find({ supplier_id: req.params.id }).sort({ po_date: -1 }).limit(20).lean(),
      contractService.getAllContracts()
    ]);

    const matchingContracts = contracts.filter((c) => c.supplier_id === req.params.id);

    return res.json({
      supplier,
      recent_pos: pos,
      contracts: matchingContracts
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const supplierRoutes = router;
