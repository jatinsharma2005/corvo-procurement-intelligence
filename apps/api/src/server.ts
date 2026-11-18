import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { connectDatabase } from './models';
import { authRoutes } from './routes/auth.routes';
import { batchRoutes } from './routes/batch.routes';
import { chatRoutes } from './routes/chat.routes';
import { procurementRoutes } from './routes/procurement.routes';
import { policyRoutes } from './routes/policy.routes';
import { contractRoutes } from './routes/contract.routes';
import { supplierRoutes } from './routes/supplier.routes';
import { exportRoutes } from './routes/export.routes';
import { auditRoutes } from './routes/audit.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { healthRoutes } from './routes/health.routes';
import { userRoutes } from './routes/user.routes';

export const app = express();

// Middlewares
const parseAllowedOrigins = () => {
  const defaults = ['http://localhost:3000', 'http://localhost:3100'];
  if (!config.corsOrigin) return defaults;
  const list = config.corsOrigin.split(',').map((s: string) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return Array.from(new Set([...defaults, ...list]));
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.trim().replace(/\/+$/, '');
    const allowed = parseAllowedOrigins();
    if (
      allowed.includes(normalizedOrigin) ||
      normalizedOrigin.endsWith('.vercel.app') ||
      normalizedOrigin.includes('localhost') ||
      normalizedOrigin.includes('127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (config.nodeEnv !== 'test') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// API Routes
app.use('/api', batchRoutes); // Mounts /api/process-batch
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', procurementRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Corvo Procurement Intelligence API',
    version: '1.0.0',
    documentation: '/docs',
    endpoints: {
      health: '/api/health',
      process_batch: 'POST /api/process-batch',
      dashboard: '/api/dashboard/summary',
      policies: '/api/policies',
      contracts: '/api/contracts',
      suppliers: '/api/suppliers'
    }
  });
});

// Centralized error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {})
  });
});

// Server initialization
export async function startServer(port: number = config.port) {
  await connectDatabase();
  return app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Corvo Procurement Intelligence API running on port ${port} (0.0.0.0)`);
    console.log(`📋 Mandatory Endpoint: POST http://localhost:${port}/api/process-batch`);
    console.log(`🩺 Health Check Endpoint: GET http://localhost:${port}/api/health`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
