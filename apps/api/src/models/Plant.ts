import { Schema, model, Document } from 'mongoose';

export interface IPlant extends Document {
  plant: string;
  name: string;
}

const PlantSchema = new Schema<IPlant>({
  plant: { type: String, required: true, unique: true },
  name: { type: String, required: true }
});

export const PlantModel = model<IPlant>('Plant', PlantSchema);
