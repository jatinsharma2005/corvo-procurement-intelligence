import path from 'path';
import dotenv from 'dotenv';
// Load from monorepo root or local directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { UserModel } from '../models/User';
import { AuditLogModel } from '../models/AuditLog';

/**
 * Securely resets the password hash of a specific user in MongoDB.
 * Never logs or exposes plaintext passwords or password hashes.
 */
export async function resetUserPassword(email: string, newPassword: string): Promise<boolean> {
  if (!email || !newPassword) {
    throw new Error('Email and new password are required');
  }
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.mongodbUri);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await UserModel.findOne({ email: normalizedEmail });

  if (!user) {
    console.error(`[ERROR] User not found with email: ${normalizedEmail}`);
    return false;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = passwordHash;
  await user.save();

  try {
    await AuditLogModel.create({
      entity_type: 'USER',
      entity_id: user._id.toString(),
      action: 'PASSWORD_RESET',
      actor: { user_id: 'SYSTEM_CLI', name: 'CLI Administrator', role: 'ADMIN' },
      details: { email: user.email, role: user.role, source: 'CLI_RESET' }
    });
  } catch (err: any) {
    // Non-blocking audit trail capture
  }

  console.log(`[SUCCESS] Password hash updated for user: ${normalizedEmail} (Role: ${user.role})`);
  return true;
}

/**
 * Resets Admin and Buyer accounts based on configured environment variables.
 */
export async function resetCredentialsFromEnv(): Promise<{ adminUpdated: boolean; buyerUpdated: boolean }> {
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@corvo.internal').toLowerCase().trim();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  const buyerEmail = (process.env.INITIAL_BUYER_EMAIL || 'buyer@corvo.internal').toLowerCase().trim();
  const buyerPassword = process.env.INITIAL_BUYER_PASSWORD;

  let adminUpdated = false;
  let buyerUpdated = false;

  if (adminPassword) {
    adminUpdated = await resetUserPassword(adminEmail, adminPassword);
  } else {
    console.warn('[WARN] INITIAL_ADMIN_PASSWORD not set in environment.');
  }

  if (buyerPassword) {
    buyerUpdated = await resetUserPassword(buyerEmail, buyerPassword);
  } else {
    console.warn('[WARN] INITIAL_BUYER_PASSWORD not set in environment.');
  }

  return { adminUpdated, buyerUpdated };
}

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf('--email');
  const passIdx = args.indexOf('--password');

  try {
    if (emailIdx !== -1 && passIdx !== -1 && args[emailIdx + 1] && args[args.indexOf('--password') + 1]) {
      const email = args[emailIdx + 1];
      const password = args[passIdx + 1];
      await resetUserPassword(email, password);
    } else {
      await resetCredentialsFromEnv();
    }
  } catch (err: any) {
    console.error(`[FATAL] Credential reset failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(() => process.exit(1));
}
