import { Schema, model, Document } from 'mongoose';
import { PlantCode } from '@corvo/shared-types';

export interface ISourcingRequest extends Document {
  sr_id: string;
  group_id: string;
  batch_id?: string;
  item_code: string;
  plant: PlantCode;
  route: 'RFQ' | 'RFP' | 'CAPEX_SOURCING' | 'NEW_ITEM_SOURCING';
  suggested_supplier_ids: string[];
  estimated_value_inr: number;
  status: 'OPEN' | 'QUOTING' | 'AWARDED' | 'CANCELLED';
}

const SourcingRequestSchema = new Schema<ISourcingRequest>(
  {
    sr_id: { type: String, required: true, unique: true, index: true },
    group_id: { type: String, required: true, unique: true, index: true },
    batch_id: { type: String, index: true },
    item_code: { type: String, required: true, index: true },
    plant: { type: String, required: true, index: true },
    route: {
      type: String,
      enum: ['RFQ', 'RFP', 'CAPEX_SOURCING', 'NEW_ITEM_SOURCING'],
      required: true
    },
    suggested_supplier_ids: [{ type: String }],
    estimated_value_inr: { type: Number, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'QUOTING', 'AWARDED', 'CANCELLED'],
      default: 'OPEN',
      index: true
    }
  },
  { timestamps: true }
);

export const SourcingRequestModel = model<ISourcingRequest>('SourcingRequest', SourcingRequestSchema);
