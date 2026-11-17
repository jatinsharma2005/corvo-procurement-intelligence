import { Router, Request, Response } from 'express';
import multer from 'multer';
import { BatchService } from '../services/batch.service';
import { ExportService } from '../services/export.service';
import { BatchRunModel } from '../models/BatchRun';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
const batchService = new BatchService();
const exportService = new ExportService();

// Mandatory API: POST /api/process-batch
router.post('/process-batch', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let csvContent: string | Buffer = '';
    let filename = 'sample_pr_batch.csv';

    if (req.file) {
      csvContent = req.file.buffer;
      filename = req.file.originalname;
    } else if (req.body && typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body && req.body.csv) {
      csvContent = req.body.csv;
      if (req.body.filename) filename = req.body.filename;
    } else {
      return res.status(400).json({ error: 'No CSV file or data provided in request' });
    }

    const customPolicyVersion = (req.query.policy_version || req.body?.policy_version) as string | undefined;

    const result = await batchService.processBatchCSV(csvContent, filename, customPolicyVersion);

    // If client requested CSV format (via Accept header or query param format=csv)
    if (req.query.format === 'csv' || req.headers.accept?.includes('text/csv')) {
      const csvStr = exportService.generateDecisionsCSV(result.csv_rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="decisions_${result.batch_id}.csv"`);
      return res.send(csvStr);
    }

    return res.json({
      success: true,
      batch_id: result.batch_id,
      policy_version: result.policy_version,
      summary: {
        total_pr_lines: result.total_lines,
        total_requirement_groups: result.total_requirements,
        total_purchase_orders: result.total_pos,
        total_sourcing_requests: result.total_sourcing_requests,
        total_procurement_value_inr: result.total_value_inr
      },
      decisions: result.decisions,
      requirements: result.requirements,
      csv_rows: result.csv_rows
    });
  } catch (err: any) {
    console.error('[API /process-batch error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/batches
router.get('/batches', async (req: Request, res: Response) => {
  try {
    const runs = await BatchRunModel.find().sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ batches: runs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/batches/:id
router.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const run = await BatchRunModel.findOne({ batch_id: req.params.id }).lean();
    if (!run) return res.status(404).json({ error: 'Batch run not found' });
    const decisions = await batchService.getBatchDecisions(req.params.id);
    return res.json({ batch: run, decisions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const batchRoutes = router;
