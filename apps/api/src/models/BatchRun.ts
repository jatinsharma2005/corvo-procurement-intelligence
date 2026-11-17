import { Schema, model, Document } from 'mongoose';

export interface IBatchRun extends Document {
  batch_id: string;
  filename: string;
  total_lines: number;
  total_requirements: number;
  total_pos: number;
  total_sourcing_requests: number;
  total_value_inr: number;
  policy_version: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_message?: string;
  created_at: Date;
}

const BatchRunSchema = new Schema<IBatchRun>(
  {
    batch_id: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    total_lines: { type: Number, required: true },
    total_requirements: { type: Number, required: true },
    total_pos: { type: Number, required: true },
    total_sourcing_requests: { type: Number, required: true },
    total_value_inr: { type: Number, required: true },
    policy_version: { type: String, required: true, index: true },
    status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'FAILED'], default: 'PROCESSING' },
    error_message: { type: String }
  },
  { timestamps: true }
);

export const BatchRunModel = model<IBatchRun>('BatchRun', BatchRunSchema);
