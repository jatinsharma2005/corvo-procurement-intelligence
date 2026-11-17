import { Schema, model, Document } from 'mongoose';

export interface IPurchaseHistory extends Document {
  po_number: string;
  po_date: Date;
  supplier_id: string;
  item_code: string;
  quantity: number;
  uom: string;
  unit_price: number;
  plant: string;
  delivered_on_time: boolean;
}

const PurchaseHistorySchema = new Schema<IPurchaseHistory>({
  po_number: { type: String, required: true },
  po_date: { type: Date, required: true, index: true },
  supplier_id: { type: String, required: true, index: true },
  item_code: { type: String, required: true, index: true },
  quantity: { type: Number, required: true },
  uom: { type: String, required: true },
  unit_price: { type: Number, required: true },
  plant: { type: String, required: true },
  delivered_on_time: { type: Boolean, required: true }
});

PurchaseHistorySchema.index({ item_code: 1, po_date: -1 });

export const PurchaseHistoryModel = model<IPurchaseHistory>('PurchaseHistory', PurchaseHistorySchema);
