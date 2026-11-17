import { AuditLogModel } from '../models/AuditLog';
import { AuditLog, UserRole } from '@corvo/shared-types';

export class AuditService {
  public async log(params: {
    entity_type: string;
    entity_id: string;
    action: string;
    actor: {
      user_id: string;
      name: string;
      role: UserRole;
    };
    details?: Record<string, any>;
  }): Promise<AuditLog> {
    const doc = new AuditLogModel({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      actor: params.actor,
      details: params.details || {},
      timestamp: new Date()
    });

    try {
      await doc.save();
    } catch (err: any) {
      console.warn(`[AuditService] Failed to persist audit log: ${err.message}`);
    }

    return {
      id: doc._id.toString(),
      entity_type: doc.entity_type as any,
      entity_id: doc.entity_id,
      action: doc.action as any,
      actor: doc.actor as any,
      details: doc.details,
      timestamp: doc.timestamp.toISOString()
    };
  }

  public async getLogs(filter: { entity_type?: string; limit?: number } = {}): Promise<AuditLog[]> {
    try {
      const q = filter.entity_type ? { entity_type: filter.entity_type } : {};
      const docs = await AuditLogModel.find(q)
        .sort({ timestamp: -1 })
        .limit(filter.limit || 100)
        .lean();

      return docs.map((d: any) => ({
        id: d._id.toString(),
        entity_type: d.entity_type,
        entity_id: d.entity_id,
        action: d.action,
        actor: d.actor,
        details: d.details,
        timestamp: d.timestamp.toISOString()
      }));
    } catch {
      return [];
    }
  }
}
