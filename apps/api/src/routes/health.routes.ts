import { Router, Request, Response } from 'express';
import { isDbConnected } from '../models';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'corvo-procurement-api',
    version: '1.0.0',
    database: isDbConnected() ? 'connected' : 'in-memory-fallback'
  });
});

export const healthRoutes = router;
