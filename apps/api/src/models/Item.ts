import { Schema, model, Document } from 'mongoose';
import { ItemType } from '@corvo/shared-types';

export interface IItem extends Document {
  item_code: string;
  description: string;
  uom: string;
  category: string;
  item_type: ItemType;
  standard_price: number;
}

const ItemSchema = new Schema<IItem>({
  item_code: { type: String, required: true, unique: true, index: true },
  description: { type: String, required: true, index: 'text' },
  uom: { type: String, required: true },
  category: { type: String, required: true, index: true },
  item_type: { type: String, enum: ['Material', 'Service', 'Capex'], required: true, index: true },
  standard_price: { type: Number, required: true }
});

export const ItemModel = model<IItem>('Item', ItemSchema);
