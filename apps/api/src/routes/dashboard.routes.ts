import { Router, Request, Response } from 'express';
import { PurchaseRequestLineModel } from '../models/PurchaseRequest';
import { RequirementGroupModel } from '../models/RequirementGroup';
import { ProcurementDecisionModel } from '../models/ProcurementDecision';
import { PurchaseOrderModel } from '../models/PurchaseOrder';
import { SourcingRequestModel } from '../models/SourcingRequest';
import { PolicyService } from '../services/policy.service';
import { AuditService } from '../services/audit.service';

const router = Router();
const policyService = new PolicyService();
const auditService = new AuditService();

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const [
      totalLines,
      totalGroups,
      totalPOs,
      totalSRs,
      decisions,
      activePolicy,
      recentLogs
    ] = await Promise.all([
      PurchaseRequestLineModel.countDocuments(),
      RequirementGroupModel.countDocuments(),
      PurchaseOrderModel.countDocuments(),
      SourcingRequestModel.countDocuments(),
      ProcurementDecisionModel.find().lean(),
      policyService.getActivePolicy(),
      auditService.getLogs({ limit: 10 })
    ]);

    let totalProcurementValue = 0;
    let pendingApprovals = 0;
    const plantDist: Record<string, number> = { PUN1: 0, CHK1: 0 };
    const routeDist: Record<string, number> = {
      CONTRACT_PO: 0,
      SPOT_PO: 0,
      EMERGENCY_PO: 0,
      RFQ: 0,
      RFP: 0,
      CAPEX_SOURCING: 0,
      NEW_ITEM_SOURCING: 0
    };

    for (const d of decisions as any[]) {
      totalProcurementValue += d.group_value_inr || 0;
      if (d.status === 'PENDING_APPROVAL') pendingApprovals++;
      if (d.plant && plantDist[d.plant] !== undefined) {
        plantDist[d.plant]++;
      } else if (d.plant) {
        plantDist[d.plant] = 1;
      }
      if (d.route && routeDist[d.route] !== undefined) {
        routeDist[d.route]++;
      } else if (d.route) {
        routeDist[d.route] = 1;
      }
    }

    return res.json({
      metrics: {
        total_pr_lines: totalLines,
        total_requirements: totalGroups,
        total_purchase_orders: totalPOs,
        total_sourcing_requests: totalSRs,
        total_procurement_value_inr: Math.round(totalProcurementValue * 100) / 100,
        pending_approvals: pendingApprovals,
        active_policy_version: activePolicy.version
      },
      distributions: {
        plants: plantDist,
        routes: routeDist
      },
      recent_activity: recentLogs
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const dashboardRoutes = router;
