import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().refine(
    (value) =>
      value.split(',').every((origin) => {
        try {
          const u = new URL(origin.trim());
          return ['http:', 'https:'].includes(u.protocol) && u.origin === origin.trim();
        } catch {
          return false;
        }
      }),
    'CORS_ORIGIN must contain HTTP(S) origins',
  ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30),
  FRONTEND_URL: z.string().url(),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(240),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().max(1440),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().max(1000000),
  AUTH_RECOVERY_MAX_ATTEMPTS: z.coerce.number().int().positive().max(1000000),
  AUTH_CODE_MAX_ATTEMPTS: z.coerce.number().int().positive().max(1000000),
  AUTH_CODE_RESEND_SECONDS: z.coerce.number().int().positive().max(1000000),
  SECURITY_CODE_TTL_MINUTES: z.coerce.number().int().positive().max(1440),
  OAUTH_STATE_TTL_MINUTES: z.coerce.number().int().positive().max(1440),
  CAPTCHA_TTL_MINUTES: z.coerce.number().int().positive().max(1440),
  CAPTCHA_MAX_ENTRIES: z.coerce.number().int().positive().max(1000000),
  CAPTCHA_MAX_REQUESTS: z.coerce.number().int().positive().max(1000000),
  HTTP_JSON_LIMIT_KB: z.coerce.number().int().positive().max(1000000),
  DB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_GREETING_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  EMAIL_SEND_ATTEMPTS: z.coerce.number().int().min(1).max(5),
  GOOGLE_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z
    .enum(['true', 'false'])

    .transform((value) => value === 'true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  DEV_SEED_EMAIL: z.string().email().optional(),
  DEV_SEED_PASSWORD: z.string().min(10).optional(),
  DEV_SEED_NAME: z.string().trim().min(2).max(80).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

/**
 * Parses and validates process environment once. Throws with every invalid key listed
 * so a misconfigured server fails fast at startup instead of at first use.
 */
export function loadEnv(source = process.env) {
  const normalized = { ...source };
  for (const key of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'DEV_SEED_EMAIL',
    'DEV_SEED_PASSWORD',
    'DEV_SEED_NAME',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
  ]) {
    if (normalized[key] === '') delete normalized[key];
  }
  const result = envSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = result.data;
  const smtpEnabled = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].some(
    (key) => env[key],
  );
  if (smtpEnabled || env.NODE_ENV === 'production') {
    const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].filter(
      (key) => !env[key],
    );
    if (missing.length)
      throw new Error(`Invalid environment configuration: missing ${missing.join(', ')}`);
  }
  const googleKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  if (googleKeys.some((key) => env[key])) {
    const missing = googleKeys.filter((key) => !env[key]);
    if (missing.length)
      throw new Error('Invalid environment configuration: missing ' + missing.join(', '));
  }
  return Object.freeze(env);
}

export function toAppConfig(env) {
  return {
    nodeEnv: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
    cookieName: env.AUTH_COOKIE_NAME,
    sessionTtlDays: env.SESSION_TTL_DAYS,
    frontendUrl: env.FRONTEND_URL,
    emailVerificationTtlMinutes: env.EMAIL_VERIFICATION_TTL_MINUTES,
    passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    httpJsonLimitKb: env.HTTP_JSON_LIMIT_KB,
    securityConfig: {
      emailSendAttempts: env.EMAIL_SEND_ATTEMPTS,
      windowMs: env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60000,
      loginMaxAttempts: env.AUTH_LOGIN_MAX_ATTEMPTS,
      recoveryMaxAttempts: env.AUTH_RECOVERY_MAX_ATTEMPTS,
      codeMaxAttempts: env.AUTH_CODE_MAX_ATTEMPTS,
      resendSeconds: env.AUTH_CODE_RESEND_SECONDS,
      codeTtlMinutes: env.SECURITY_CODE_TTL_MINUTES,
      oauthTtlMinutes: env.OAUTH_STATE_TTL_MINUTES,
      captchaTtlMinutes: env.CAPTCHA_TTL_MINUTES,
      captchaMaxEntries: env.CAPTCHA_MAX_ENTRIES,
      captchaMaxRequests: env.CAPTCHA_MAX_REQUESTS,
    },
    google: env.GOOGLE_CLIENT_ID
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
          timeoutMs: env.GOOGLE_HTTP_TIMEOUT_MS,
        }
      : undefined,
  };
}
