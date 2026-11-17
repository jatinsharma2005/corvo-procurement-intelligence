import { Schema, model, Document } from 'mongoose';
import { DecisionRoute, PlantCode } from '@corvo/shared-types';

export interface IPurchaseOrder extends Document {
  po_id: string;
  batch_id?: string;
  supplier_id: string;
  supplier_name: string;
  plant: PlantCode;
  route: DecisionRoute;
  first_created_at: Date;
  requirements: string[]; // group_ids
  total_value_inr: number;
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  created_at: Date;
}

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    po_id: { type: String, required: true, unique: true, index: true },
    batch_id: { type: String, index: true },
    supplier_id: { type: String, required: true, index: true },
    supplier_name: { type: String, required: true },
    plant: { type: String, required: true, index: true },
    route: { type: String, required: true, index: true },
    first_created_at: { type: Date, required: true },
    requirements: [{ type: String }],
    total_value_inr: { type: Number, required: true },
    status: { type: String, enum: ['DRAFT', 'ISSUED', 'CANCELLED'], default: 'DRAFT', index: true }
  },
  { timestamps: true }
);

export const PurchaseOrderModel = model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
