import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '5000'), 10),
  DATABASE_URL: optional('DATABASE_URL', process.env.POSTGRES_URL || process.env.DATABASE_PRIVATE_URL || ''),

  // JWT
  JWT_SECRET: optional('JWT_SECRET', 'fallback-jwt-secret-change-in-production'),
  JWT_REFRESH_SECRET: optional('JWT_REFRESH_SECRET', 'fallback-refresh-secret-change-in-production'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  // CORS
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),

  // Files
  UPLOAD_DIR: optional('UPLOAD_DIR', './uploads'),
  MAX_FILE_SIZE_MB: parseInt(optional('MAX_FILE_SIZE_MB', '10'), 10),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),

  // Timezone
  TZ: optional('TZ', 'Asia/Kolkata'),

  get isDevelopment() {
    return this.NODE_ENV === 'development';
  },
  get isProduction() {
    return this.NODE_ENV === 'production';
  },
} as const;
