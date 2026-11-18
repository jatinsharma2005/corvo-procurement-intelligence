import { Schema, model, Document } from 'mongoose';
import { UserRole } from '@corvo/shared-types';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  department?: string;
  plant?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['BUYER', 'ADMIN'], default: 'BUYER' },
    isActive: { type: Boolean, default: true },
    department: { type: String },
    plant: { type: String },
    createdBy: { type: String }
  },
  { timestamps: true }
);

export const UserModel = model<IUser>('User', UserSchema);
