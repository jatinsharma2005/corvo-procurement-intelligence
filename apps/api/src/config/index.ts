import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/corvo_procurement',
  jwtSecret: process.env.JWT_SECRET || 'corvo_procurement_super_secret_jwt_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiProvider: (process.env.AI_PROVIDER || 'fallback') as 'gemini' | 'openai' | 'fallback',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  defaultAsOfDate: process.env.DEFAULT_AS_OF_DATE || '2026-11-01'
};
