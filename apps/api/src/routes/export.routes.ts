import { Router, Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import { ProcurementDecisionModel } from '../models/ProcurementDecision';
import { PurchaseRequestLineModel } from '../models/PurchaseRequest';
import { DecisionCSVRow } from '@corvo/shared-types';

const router = Router();
const exportService = new ExportService();

// GET /api/exports/decisions
router.get('/decisions', async (req: Request, res: Response) => {
  const batchId = req.query.batch_id as string | undefined;

  try {
    const q = batchId ? { batch_id: batchId } : {};
    const decisions = await ProcurementDecisionModel.find(q).lean();
    if (decisions.length === 0) {
      return res.status(404).json({ error: 'No decisions found for export' });
    }

    const decMap = new Map(decisions.map((d) => [d.group_id, d]));
    const lines = await PurchaseRequestLineModel.find(batchId ? { batch_id: batchId } : {}).lean();

    const rows: DecisionCSVRow[] = [];
    for (const l of lines) {
      const d = decMap.get(l.group_id || '') as any;
      if (!d) continue;

      rows.push({
        pr_no: l.pr_no,
        pr_line: l.pr_line,
        resolved_item_code: d.resolved_item_code,
        group_id: d.group_id,
        po_id: d.po_id || '',
        decision: d.decision,
        route: d.route,
        supplier_id: d.decision === 'PO' ? d.supplier_id || '' : '',
        unit_price: d.decision === 'PO' && d.unit_price !== undefined ? d.unit_price : '',
        group_value_inr: d.group_value_inr,
        suggested_supplier_ids: (d.suggested_supplier_ids || []).join(';'),
        policy_version: d.policy_version,
        reason: d.reason
      });
    }

    const csvStr = exportService.generateDecisionsCSV(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="decisions_${batchId || 'all'}.csv"`);
    return res.send(csvStr);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/exports/preferred-suppliers
router.get('/preferred-suppliers', async (req: Request, res: Response) => {
  const asOfDate = (req.query.as_of_date as string) || '2026-11-01';

  try {
    const csvStr = await exportService.generatePreferredSuppliersCSV(asOfDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="preferred_suppliers_${asOfDate}.csv"`);
    return res.send(csvStr);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const exportRoutes = router;
