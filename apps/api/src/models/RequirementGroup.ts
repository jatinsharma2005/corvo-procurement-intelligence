import { Schema, model, Document } from 'mongoose';
import { PlantCode } from '@corvo/shared-types';

export interface IRequirementGroup extends Document {
  group_id: string;
  batch_id?: string;
  resolved_item_code: string;
  plant: PlantCode;
  first_created_at: Date;
  first_need_by: Date;
  is_emergency: boolean;
  total_quantity: number;
  line_ids: string[]; // PRLine IDs
  estimated_value_inr?: number;
  valuation_basis?: string;
  decision_id?: string;
}

const RequirementGroupSchema = new Schema<IRequirementGroup>(
  {
    group_id: { type: String, required: true, unique: true, index: true },
    batch_id: { type: String, index: true },
    resolved_item_code: { type: String, required: true, index: true },
    plant: { type: String, required: true, index: true },
    first_created_at: { type: Date, required: true, index: true },
    first_need_by: { type: Date, required: true },
    is_emergency: { type: Boolean, default: false },
    total_quantity: { type: Number, required: true },
    line_ids: [{ type: String }],
    estimated_value_inr: { type: Number },
    valuation_basis: { type: String },
    decision_id: { type: String }
  },
  { timestamps: true }
);

export const RequirementGroupModel = model<IRequirementGroup>('RequirementGroup', RequirementGroupSchema);
