import { Schema, model, Document } from 'mongoose';
import { UrgencyLevel, PlantCode } from '@corvo/shared-types';

export interface IPurchaseRequestLine extends Document {
  pr_no: string;
  pr_line: number;
  created_at: Date;
  requester: string;
  department: string;
  plant: PlantCode;
  item_code?: string;
  description: string;
  quantity: number;
  uom: string;
  estimated_unit_price?: number;
  need_by_date: Date;
  urgency: UrgencyLevel;
  resolved_item_code?: string;
  group_id?: string;
  batch_id?: string;
}

const PurchaseRequestLineSchema = new Schema<IPurchaseRequestLine>({
  pr_no: { type: String, required: true, index: true },
  pr_line: { type: Number, required: true },
  created_at: { type: Date, required: true, index: true },
  requester: { type: String, required: true },
  department: { type: String, required: true },
  plant: { type: String, required: true, index: true },
  item_code: { type: String, index: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  uom: { type: String, required: true },
  estimated_unit_price: { type: Number },
  need_by_date: { type: Date, required: true, index: true },
  urgency: { type: String, enum: ['Normal', 'Emergency', 'NORMAL', 'EMERGENCY', 'URGENT'], default: 'Normal' },
  resolved_item_code: { type: String, index: true },
  group_id: { type: String, index: true },
  batch_id: { type: String, index: true }
});

PurchaseRequestLineSchema.index({ pr_no: 1, pr_line: 1 }, { unique: true });

export const PurchaseRequestLineModel = model<IPurchaseRequestLine>('PurchaseRequestLine', PurchaseRequestLineSchema);
