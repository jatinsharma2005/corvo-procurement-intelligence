import { Schema, model, Document } from 'mongoose';
import { PolicyDocument } from '@corvo/policy-schema';

export interface IPolicyVersion extends Document {
  version: string;
  document_number: string;
  title: string;
  effective_date: Date;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  parameters: {
    clubbing_window_days: number;
    clubbing_need_by_window_days: number;
    po_consolidation_window_hours: number;
    purchase_history_recency_days: number;
    preferred_supplier_window_days: number;
  };
  rules: any[];
  amendment_summary?: string;
  created_at: Date;
  approved_at?: Date;
  approved_by?: string;
}

const PolicyVersionSchema = new Schema<IPolicyVersion>(
  {
    version: { type: String, required: true, unique: true, index: true },
    document_number: { type: String, required: true },
    title: { type: String, required: true },
    effective_date: { type: Date, required: true, index: true },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'], required: true, index: true },
    parameters: {
      clubbing_window_days: { type: Number, default: 14 },
      clubbing_need_by_window_days: { type: Number, default: 7 },
      po_consolidation_window_hours: { type: Number, default: 24 },
      purchase_history_recency_days: { type: Number, default: 365 },
      preferred_supplier_window_days: { type: Number, default: 548 }
    },
    rules: { type: [Schema.Types.Mixed], required: true },
    amendment_summary: { type: String },
    created_at: { type: Date, default: Date.now },
    approved_at: { type: Date },
    approved_by: { type: String }
  },
  { timestamps: true }
);

export const PolicyVersionModel = model<IPolicyVersion>('PolicyVersion', PolicyVersionSchema);
