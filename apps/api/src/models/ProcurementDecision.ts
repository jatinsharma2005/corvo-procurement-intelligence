import { Schema, model, Document } from 'mongoose';
import { DecisionType, DecisionRoute, PlantCode } from '@corvo/shared-types';

export interface IProcurementDecision extends Document {
  group_id: string;
  batch_id?: string;
  resolved_item_code: string;
  plant: PlantCode;
  total_quantity: number;
  group_value_inr: number;
  decision: DecisionType;
  route: DecisionRoute;
  supplier_id?: string;
  supplier_name?: string;
  unit_price?: number;
  po_id?: string;
  suggested_supplier_ids: string[];
  policy_version: string;
  clause: string;
  reason: string;
  rule_id?: string;
  calculation_breakdown?: any;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'OVERRIDDEN';
  approved_by?: string;
  approved_at?: Date;
  override_details?: {
    original_decision: DecisionType;
    original_route: DecisionRoute;
    original_supplier_id?: string;
    new_decision: DecisionType;
    new_route: DecisionRoute;
    new_supplier_id?: string;
    reason: string;
    overridden_by: string;
    overridden_at: Date;
  };
}

const ProcurementDecisionSchema = new Schema<IProcurementDecision>(
  {
    group_id: { type: String, required: true, unique: true, index: true },
    batch_id: { type: String, index: true },
    resolved_item_code: { type: String, required: true, index: true },
    plant: { type: String, required: true, index: true },
    total_quantity: { type: Number, required: true },
    group_value_inr: { type: Number, required: true },
    decision: { type: String, enum: ['PO', 'SOURCING_REQUEST', 'NOT_PROCESSED'], required: true, index: true },
    route: {
      type: String,
      enum: [
        'CONTRACT_PO',
        'EMERGENCY_PO',
        'SPOT_PO',
        'RFQ',
        'RFP',
        'CAPEX_SOURCING',
        'NEW_ITEM_SOURCING',
        'NOT_PROCESSED'
      ],
      required: true,
      index: true
    },
    supplier_id: { type: String, index: true },
    supplier_name: { type: String },
    unit_price: { type: Number },
    po_id: { type: String, index: true },
    suggested_supplier_ids: [{ type: String }],
    policy_version: { type: String, required: true, index: true },
    clause: { type: String, required: true },
    reason: { type: String, required: true },
    rule_id: { type: String },
    calculation_breakdown: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'OVERRIDDEN'],
      default: 'PENDING_APPROVAL',
      index: true
    },
    approved_by: { type: String },
    approved_at: { type: Date },
    override_details: {
      original_decision: { type: String },
      original_route: { type: String },
      original_supplier_id: { type: String },
      new_decision: { type: String },
      new_route: { type: String },
      new_supplier_id: { type: String },
      reason: { type: String },
      overridden_by: { type: String },
      overridden_at: { type: Date }
    }
  },
  { timestamps: true }
);

export const ProcurementDecisionModel = model<IProcurementDecision>('ProcurementDecision', ProcurementDecisionSchema);
