import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PolicyService } from '../services/policy.service';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
const policyService = new PolicyService();
const auditService = new AuditService();

// GET /api/policies
router.get('/', async (req: Request, res: Response) => {
  try {
    const policies = await policyService.getAllPolicies();
    return res.json({ policies });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/policies/active
router.get('/active', async (req: Request, res: Response) => {
  try {
    const policy = await policyService.getActivePolicy();
    return res.json({ policy });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/policies/upload (Upload PDF amendment)
router.post('/upload', upload.single('file'), authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Policy PDF file is required' });
  }

  try {
    const result = await policyService.proposeAmendment({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname
    });

    await auditService.log({
      entity_type: 'POLICY',
      entity_id: result.draftPolicy.version,
      action: 'CREATE',
      actor: {
        user_id: req.user?.id || 'usr-admin',
        name: req.user?.name || 'Procurement Admin',
        role: req.user?.role || 'ADMIN'
      },
      details: { filename: req.file.originalname, version: result.draftPolicy.version }
    });

    return res.json({
      success: true,
      draft_policy: result.draftPolicy,
      proposal: result.proposal,
      diff: result.diff
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/policies/draft (Submit text amendment)
router.post('/draft', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { amendment_text } = req.body;
  if (!amendment_text || !amendment_text.trim()) {
    return res.status(400).json({ error: 'amendment_text is required' });
  }

  try {
    const result = await policyService.proposeAmendment({ text: amendment_text.trim() });

    await auditService.log({
      entity_type: 'POLICY',
      entity_id: result.draftPolicy.version,
      action: 'CREATE',
      actor: {
        user_id: req.user?.id || 'usr-admin',
        name: req.user?.name || 'Procurement Admin',
        role: req.user?.role || 'ADMIN'
      },
      details: { version: result.draftPolicy.version, summary: result.proposal.amendment_summary }
    });

    return res.json({
      success: true,
      draft_policy: result.draftPolicy,
      proposal: result.proposal,
      diff: result.diff
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/policies/:version/approve
router.post('/:version/approve', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approved = await policyService.approvePolicy(
      req.params.version,
      req.user?.name || 'Procurement Head'
    );

    await auditService.log({
      entity_type: 'POLICY',
      entity_id: req.params.version,
      action: 'ACTIVATE',
      actor: {
        user_id: req.user?.id || 'usr-admin',
        name: req.user?.name || 'Procurement Head',
        role: req.user?.role || 'ADMIN'
      },
      details: { version: req.params.version, effective_date: approved.effective_date }
    });

    return res.json({ success: true, policy: approved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/policies/:version/diff
router.get('/:version/diff', async (req: Request, res: Response) => {
  try {
    const active = await policyService.getActivePolicy();
    const target = await policyService.getPolicyByVersion(req.params.version);
    if (!target) return res.status(404).json({ error: 'Policy version not found' });

    const diff = policyService.computeDiff(active, target);
    return res.json({ diff });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const policyRoutes = router;
