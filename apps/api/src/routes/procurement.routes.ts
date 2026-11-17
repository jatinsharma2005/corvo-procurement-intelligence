import { Router, Response } from 'express';
import { RequirementGroupModel } from '../models/RequirementGroup';
import { ProcurementDecisionModel } from '../models/ProcurementDecision';
import { PurchaseOrderModel } from '../models/PurchaseOrder';
import { SourcingRequestModel } from '../models/SourcingRequest';
import { PurchaseRequestLineModel } from '../models/PurchaseRequest';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const auditService = new AuditService();

// GET /api/requirements
router.get('/requirements', async (req, res) => {
  try {
    const { plant, status, search, limit = 100 } = req.query;
    const q: any = {};
    if (plant) q.plant = plant;
    if (status) q.status = status;
    if (search) {
      q.$or = [
        { group_id: { $regex: search, $options: 'i' } },
        { resolved_item_code: { $regex: search, $options: 'i' } }
      ];
    }

    const groups = await RequirementGroupModel.find(q)
      .sort({ first_created_at: -1 })
      .limit(Number(limit))
      .lean();

    // Populate decisions
    const groupIds = groups.map((g) => g.group_id);
    const decisions = await ProcurementDecisionModel.find({ group_id: { $in: groupIds } }).lean();
    const decMap = new Map(decisions.map((d) => [d.group_id, d]));

    const populated = groups.map((g) => ({
      ...g,
      decision: decMap.get(g.group_id)
    }));

    return res.json({ requirements: populated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/requirements/:id
router.get('/requirements/:id', async (req, res) => {
  try {
    const group = await RequirementGroupModel.findOne({ group_id: req.params.id }).lean();
    if (!group) return res.status(404).json({ error: 'Requirement not found' });

    const [decision, lines] = await Promise.all([
      ProcurementDecisionModel.findOne({ group_id: req.params.id }).lean(),
      PurchaseRequestLineModel.find({ group_id: req.params.id }).lean()
    ]);

    return res.json({
      requirement: group,
      decision,
      lines
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/decisions
router.get('/decisions', async (req, res) => {
  try {
    const { route, decision, status, search, limit = 100 } = req.query;
    const q: any = {};
    if (route) q.route = route;
    if (decision) q.decision = decision;
    if (status) q.status = status;
    if (search) {
      q.$or = [
        { group_id: { $regex: search, $options: 'i' } },
        { resolved_item_code: { $regex: search, $options: 'i' } },
        { po_id: { $regex: search, $options: 'i' } },
        { supplier_id: { $regex: search, $options: 'i' } }
      ];
    }

    const decisions = await ProcurementDecisionModel.find(q)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    return res.json({ decisions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/decisions/:id/approve
router.post('/decisions/:id/approve', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const decision = await ProcurementDecisionModel.findOne({ group_id: req.params.id });
    if (!decision) return res.status(404).json({ error: 'Decision not found' });

    decision.status = 'APPROVED';
    decision.approved_by = req.user?.name || 'Buyer';
    decision.approved_at = new Date();
    await decision.save();

    // If PO, create/finalize PurchaseOrder
    if (decision.decision === 'PO' && decision.po_id) {
      await PurchaseOrderModel.findOneAndUpdate(
        { po_id: decision.po_id },
        {
          po_id: decision.po_id,
          supplier_id: decision.supplier_id || 'S001',
          supplier_name: decision.supplier_name || 'Selected Supplier',
          plant: decision.plant,
          route: decision.route,
          first_created_at: new Date(),
          total_value_inr: decision.group_value_inr,
          status: 'ISSUED',
          $addToSet: { requirements: decision.group_id }
        },
        { upsert: true }
      );
    } else {
      // Sourcing request
      const srId = `SR-${Date.now().toString().slice(-4)}`;
      await SourcingRequestModel.findOneAndUpdate(
        { group_id: decision.group_id },
        {
          sr_id: srId,
          group_id: decision.group_id,
          item_code: decision.resolved_item_code,
          plant: decision.plant,
          route: decision.route as any,
          suggested_supplier_ids: decision.suggested_supplier_ids,
          estimated_value_inr: decision.group_value_inr,
          status: 'OPEN'
        },
        { upsert: true }
      );
    }

    await auditService.log({
      entity_type: 'DECISION',
      entity_id: decision.group_id,
      action: 'APPROVE',
      actor: {
        user_id: req.user?.id || 'usr-buyer',
        name: req.user?.name || 'Buyer',
        role: req.user?.role || 'BUYER'
      },
      details: { decision: decision.decision, route: decision.route, po_id: decision.po_id }
    });

    return res.json({ success: true, decision });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/decisions/:id/override (MANDATORY: requires written override reason)
router.post('/decisions/:id/override', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { new_decision, new_route, new_supplier_id, reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A written override reason is mandatory to override automated decisions.' });
  }
  if (!new_decision || !new_route) {
    return res.status(400).json({ error: 'new_decision and new_route are required.' });
  }

  try {
    const decision = await ProcurementDecisionModel.findOne({ group_id: req.params.id });
    if (!decision) return res.status(404).json({ error: 'Decision not found' });

    const overrideDetails = {
      original_decision: decision.decision,
      original_route: decision.route,
      original_supplier_id: decision.supplier_id,
      new_decision,
      new_route,
      new_supplier_id,
      reason: reason.trim(),
      overridden_by: req.user?.name || 'Buyer',
      overridden_at: new Date()
    };

    decision.status = 'OVERRIDDEN';
    decision.decision = new_decision;
    decision.route = new_route;
    if (new_supplier_id) decision.supplier_id = new_supplier_id;
    decision.override_details = overrideDetails;
    await decision.save();

    await auditService.log({
      entity_type: 'DECISION',
      entity_id: decision.group_id,
      action: 'OVERRIDE',
      actor: {
        user_id: req.user?.id || 'usr-buyer',
        name: req.user?.name || 'Buyer',
        role: req.user?.role || 'BUYER'
      },
      details: overrideDetails
    });

    return res.json({ success: true, decision });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await PurchaseOrderModel.find().sort({ createdAt: -1 }).lean();
    return res.json({ orders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing
router.get('/sourcing', async (req, res) => {
  try {
    const requests = await SourcingRequestModel.find().sort({ createdAt: -1 }).lean();
    return res.json({ sourcing_requests: requests });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const procurementRoutes = router;
