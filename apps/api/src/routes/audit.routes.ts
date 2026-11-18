import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const auditService = new AuditService();
router.use(authMiddleware);

const handleGetLogs = async (req: Request, res: Response) => {
  const entityType = req.query.entity_type as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

  try {
    const logs = await auditService.getLogs({ entity_type: entityType, limit });
    return res.json({ logs, audit_logs: logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

router.get('/', handleGetLogs);
router.get('/logs', handleGetLogs);

export const auditRoutes = router;
