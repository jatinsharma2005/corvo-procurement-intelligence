import { Schema, model, Document } from 'mongoose';

export interface IContract extends Document {
  contract_id: string;
  supplier_id: string;
  supplier_name: string;
  start_date: Date;
  end_date: Date;
  value_cap: number;
  consumed_value: number;
  lines: Map<string, { rate: number; description: string; uom: string }>;
  is_pdf_only: boolean;
  document_url?: string;
}

const ContractSchema = new Schema<IContract>({
  contract_id: { type: String, required: true, unique: true, index: true },
  supplier_id: { type: String, required: true, index: true },
  supplier_name: { type: String, required: true },
  start_date: { type: Date, required: true, index: true },
  end_date: { type: Date, required: true, index: true },
  value_cap: { type: Number, required: true },
  consumed_value: { type: Number, required: true, default: 0 },
  lines: {
    type: Map,
    of: new Schema({
      rate: { type: Number, required: true },
      description: { type: String, required: true },
      uom: { type: String, required: true }
    }, { _id: false })
  },
  is_pdf_only: { type: Boolean, default: false },
  document_url: { type: String }
});

export const ContractModel = model<IContract>('Contract', ContractSchema);
