import { Schema, model, Document } from 'mongoose';
import { SupplierStatus } from '@corvo/shared-types';

export interface ISupplier extends Document {
  supplier_id: string;
  name: string;
  city: string;
  categories: string[];
  status: SupplierStatus;
  on_time_pct: number;
  quality_rating: number;
}

const SupplierSchema = new Schema<ISupplier>({
  supplier_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  city: { type: String, required: true },
  categories: [{ type: String, index: true }],
  status: { type: String, enum: ['Active', 'Blocked', 'Inactive'], required: true, index: true },
  on_time_pct: { type: Number, required: true },
  quality_rating: { type: Number, required: true }
});

export const SupplierModel = model<ISupplier>('Supplier', SupplierSchema);
