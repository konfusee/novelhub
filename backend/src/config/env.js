import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('novelhub_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
});

/**
 * Parses and validates process environment once. Throws with every invalid key listed
 * so a misconfigured server fails fast at startup instead of at first use.
 */
export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return Object.freeze(result.data);
}
