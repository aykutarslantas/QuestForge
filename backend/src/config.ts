import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};

if (!config.databaseUrl) {
  console.warn('WARNING: DATABASE_URL is not set!');
}

if (!config.geminiApiKey && !config.openaiApiKey) {
  console.warn('WARNING: Neither GEMINI_API_KEY nor OPENAI_API_KEY is set. AI narration will fail!');
}
