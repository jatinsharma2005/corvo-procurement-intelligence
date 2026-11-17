import { Schema, model, Document } from 'mongoose';
import { UserRole } from '@corvo/shared-types';

export interface IAuditLog extends Document {
  entity_type: string;
  entity_id: string;
  action: string;
  actor: {
    user_id: string;
    name: string;
    role: UserRole;
  };
  details: Record<string, any>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    entity_type: { type: String, required: true, index: true },
    entity_id: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    actor: {
      user_id: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true }
    },
    details: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const AuditLogModel = model<IAuditLog>('AuditLog', AuditLogSchema);
