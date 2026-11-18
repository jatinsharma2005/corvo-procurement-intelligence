import mongoose from 'mongoose';
import { config } from '../config';

export { mongoose };

export * from './User';
export * from './Plant';
export * from './Item';
export * from './Supplier';
export * from './PurchaseHistory';
export * from './Contract';
export * from './PolicyVersion';
export * from './PurchaseRequest';
export * from './RequirementGroup';
export * from './ProcurementDecision';
export * from './PurchaseOrder';
export * from './SourcingRequest';
export * from './Conversation';
export * from './AuditLog';
export * from './BatchRun';

let isConnected = false;
mongoose.set('bufferCommands', false);

export async function connectDatabase(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) return true;

  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 10000
    });
    isConnected = true;
    const sanitizedUri = config.mongodbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log(`[DB] Connected to MongoDB at ${sanitizedUri}`);

    try {
      const { UserModel } = await import('./User');
      if (await UserModel.countDocuments() === 0) {
        const { seedDatabase } = await import('../scripts/seed');
        await seedDatabase();
      }
    } catch (seedError: any) {
      console.warn(`[DB] Automatic seed skipped: ${seedError.message}`);
    }
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn(`[DB] MongoDB connection failed (${err.message}). Running in in-memory / local fallback mode.`);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
