import mongoose from 'mongoose';
import { config } from '../config';

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

export async function connectDatabase(): Promise<boolean> {
  if (isConnected) return true;

  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 3000
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB at ${config.mongodbUri}`);
    return true;
  } catch (err: any) {
    console.warn(`[DB] MongoDB connection failed (${err.message}). Running in in-memory / local fallback mode.`);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
