import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),

  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // Rate limiting (per client IP). Optional — sensible defaults applied.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Number of reverse proxies in front of the app (for correct client IPs).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  // SMTP (optional — when unset, outgoing email is logged instead of sent).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

// On invalid config we do NOT throw or exit — that would crash a serverless
// function at import time with an opaque error. Instead we record the error and
// fall back to a safe placeholder config so module-load code (CORS, rate
// limiter) can initialize; every request is then rejected by the env-guard
// middleware (see app.ts) with a readable message.
export const envValidationError: string | null = parsed.success
  ? null
  : JSON.stringify(parsed.error.flatten().fieldErrors);

if (!parsed.success) {
  logger.fatal(
    { fieldErrors: parsed.error.flatten().fieldErrors },
    'Invalid or missing environment variables'
  );
}

const FALLBACK_ENV: EnvConfig = {
  PORT: 8000,
  NODE_ENV: 'production',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://invalid:invalid@localhost:5432/invalid',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost',
  JWT_SECRET: 'x'.repeat(32),
  JWT_EXPIRES_IN: '1d',
  BCRYPT_SALT_ROUNDS: 12,
  ACCESS_TOKEN_SECRET: 'x'.repeat(32),
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_SECRET: 'x'.repeat(32),
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 1000,
  AUTH_RATE_LIMIT_MAX: 20,
  TRUST_PROXY_HOPS: 1,
};

export const envConfig: EnvConfig = parsed.success ? parsed.data : FALLBACK_ENV;