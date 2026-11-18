import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ContractService } from '../services/contract.service';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only signed PDF contracts are allowed'));
    }
  }
});
const router = Router();
const contractService = new ContractService();
const auditService = new AuditService();
router.use(authMiddleware);

// GET /api/contracts
router.get('/', async (req: Request, res: Response) => {
  try {
    const contracts = await contractService.getAllContracts();
    return res.json({ contracts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/contracts/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    return res.json({ contract });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { contract } = req.body;
  if (!contract || !contract.contract_id || !contract.supplier_id) {
    return res.status(400).json({ error: 'Valid contract data is required' });
  }

  try {
    const registered = await contractService.registerContract(contract);

    await auditService.log({
      entity_type: 'CONTRACT',
      entity_id: registered.contract_id,
      action: 'CREATE',
      actor: {
        user_id: req.user?.id || 'usr-buyer',
        name: req.user?.name || 'Buyer',
        role: req.user?.role || 'BUYER'
      },
      details: { supplier_id: registered.supplier_id, value_cap: registered.value_cap }
    });

    return res.status(201).json({ success: true, contract: registered });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts/upload (PDF-only contract extraction)
router.post('/upload', upload.single('file'), authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Contract PDF file is required' });
  }

  try {
    const extracted = await contractService.extractContractFromPDF(
      req.file.buffer,
      req.file.originalname
    );

    return res.json({
      success: true,
      extracted_contract: extracted,
      message: 'Contract successfully extracted. Review and confirm to save in register.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const contractRoutes = router;
