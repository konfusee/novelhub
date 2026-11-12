import { z } from 'zod'
import path from 'node:path'
import { envKeySource } from './load-dotenv.js'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().refine(
    value =>
      value.split(',').every(origin => {
        try {
          const u = new URL(origin.trim())
          return ['http:', 'https:'].includes(u.protocol) && u.origin === origin.trim()
        } catch {
          return false
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
  MEDIA_STORAGE_DIR: z
    .string()
    .trim()
    .min(1)
    .refine(
      value => path.isAbsolute(value) && !/[\p{Cc}]/u.test(value),
      'MEDIA_STORAGE_DIR must be an absolute directory path',
    )
    .optional(),
  HTTP_JSON_LIMIT_KB: z.coerce.number().int().positive().max(1000000),
  DB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_GREETING_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  EMAIL_SEND_ATTEMPTS: z.coerce.number().int().min(1).max(3),
  GOOGLE_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z
    .enum(['true', 'false'])

    .transform(value => value === 'true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  DEV_SEED_EMAIL: z.string().email().optional(),
  DEV_SEED_PASSWORD: z.string().min(10).optional(),
  DEV_SEED_NAME: z.string().trim().min(2).max(80).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  TOPUP_BANK_BIN: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
  TOPUP_BANK_NAME: z.string().trim().min(1).max(100).optional(),
  TOPUP_BANK_ACCOUNT_NUMBER: z
    .string()
    .trim()
    .regex(/^\d{6,34}$/)
    .optional(),
  TOPUP_BANK_ACCOUNT_NAME: z.string().trim().min(1).max(100).optional(),
  SEPAY_WEBHOOK_API_KEY: z.string().trim().min(32).max(256).optional(),
  MODERATION_CLAIM_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().trim().min(1).default('text-embedding-3-small'),
  OPENAI_REVIEW_MODEL: z.string().trim().min(1).default('gpt-6-luna'),
  OPENAI_REVIEW_REASONING_EFFORT: z
    .enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    .default('low'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(60000),
  AI_EVIDENCE_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(3600).default(30),
  SIMILARITY_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
  VECTOR_SEARCH_INDEX: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]+$/)
    .default('embedding_vectors'),
  AI_EVIDENCE_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  PAYOUT_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  VBEE_APP_ID: z.string().trim().min(1).max(200).optional(),
  VBEE_TOKEN: z.string().trim().min(1).max(5000).optional(),
  VBEE_VOICE_CODE: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+$/)
    .default('hn_female_hermer_stor_48k-fhg'),
  VBEE_API_URL: z.string().url().default('https://api.vbee.vn/v1'),
  VBEE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  TTS_CALLBACK_URL: z.string().url().optional(),
  TTS_REQUEST_COOLDOWN_SECONDS: z.coerce.number().int().min(0).max(3600).default(30),
  TTS_DAILY_CHARACTER_LIMIT: z.coerce.number().int().min(0).default(0),
  AI_BUDGET_USD: z.coerce.number().min(0).max(1000).default(3),
  AI_BUDGET_WINDOW_START: z
    .string()
    .trim()
    .refine(value => !Number.isNaN(Date.parse(value)), 'AI_BUDGET_WINDOW_START must be an ISO date')
    .transform(value => new Date(value))
    .optional(),
})

/**
 * Parses and validates process environment once. Throws with every invalid key listed
 * so a misconfigured server fails fast at startup instead of at first use.
 */
export function loadEnv(source = process.env) {
  const normalized = { ...source }
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
    'MEDIA_STORAGE_DIR',
    'TOPUP_BANK_BIN',
    'TOPUP_BANK_NAME',
    'TOPUP_BANK_ACCOUNT_NUMBER',
    'TOPUP_BANK_ACCOUNT_NAME',
    'SEPAY_WEBHOOK_API_KEY',
    'MODERATION_CLAIM_HOURS',
    'OPENAI_API_KEY',
    'OPENAI_EMBEDDING_MODEL',
    'OPENAI_REVIEW_MODEL',
    'OPENAI_REVIEW_REASONING_EFFORT',
    'OPENAI_TIMEOUT_MS',
    'AI_EVIDENCE_INTERVAL_SECONDS',
    'SIMILARITY_TOP_K',
    'VECTOR_SEARCH_INDEX',
    'AI_EVIDENCE_WORKER_ENABLED',
    'PAYOUT_WORKER_ENABLED',
    'AI_BUDGET_USD',
    'AI_BUDGET_WINDOW_START',
    'VBEE_APP_ID',
    'VBEE_TOKEN',
    'VBEE_VOICE_CODE',
    'VBEE_API_URL',
    'VBEE_TIMEOUT_MS',
    'TTS_CALLBACK_URL',
    'TTS_REQUEST_COOLDOWN_SECONDS',
    'TTS_DAILY_CHARACTER_LIMIT',
  ]) {
    if (normalized[key] === '') delete normalized[key]
  }
  const vbeeKeys = ['VBEE_APP_ID', 'VBEE_TOKEN']
  if (vbeeKeys.some(key => normalized[key]) && !vbeeKeys.every(key => normalized[key]))
    throw new Error('Invalid environment configuration: VBEE_APP_ID and VBEE_TOKEN go together')
  const result = envSchema.safeParse(normalized)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  const env = result.data
  const smtpEnabled = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].some(key => env[key])
  if (smtpEnabled || env.NODE_ENV === 'production') {
    const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].filter(
      key => !env[key],
    )
    if (missing.length)
      throw new Error(`Invalid environment configuration: missing ${missing.join(', ')}`)
  }
  const googleKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
  if (googleKeys.some(key => env[key])) {
    const missing = googleKeys.filter(key => !env[key])
    if (missing.length)
      throw new Error('Invalid environment configuration: missing ' + missing.join(', '))
  }
  return Object.freeze(env)
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
    mediaStorageDir: env.MEDIA_STORAGE_DIR,
    moderationClaimHours: env.MODERATION_CLAIM_HOURS,
    ai: {
      openai: env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : undefined,
      openaiKeySource: envKeySource('OPENAI_API_KEY', env.OPENAI_API_KEY),
      embeddingModel: env.OPENAI_EMBEDDING_MODEL,
      reviewModel: env.OPENAI_REVIEW_MODEL,
      reviewReasoningEffort: env.OPENAI_REVIEW_REASONING_EFFORT,
      timeoutMs: env.OPENAI_TIMEOUT_MS,
      intervalSeconds: env.AI_EVIDENCE_INTERVAL_SECONDS,
      similarityTopK: env.SIMILARITY_TOP_K,
      vectorSearchIndex: env.VECTOR_SEARCH_INDEX,
      workerEnabled: env.AI_EVIDENCE_WORKER_ENABLED,
      budgetUsd: env.AI_BUDGET_USD,
      budgetWindowStart: env.AI_BUDGET_WINDOW_START ?? null,
    },
    payoutWorkerEnabled: env.PAYOUT_WORKER_ENABLED,
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
    topUpBank: {
      bin: env.TOPUP_BANK_BIN,
      name: env.TOPUP_BANK_NAME,
      accountNumber: env.TOPUP_BANK_ACCOUNT_NUMBER,
      accountName: env.TOPUP_BANK_ACCOUNT_NAME,
    },
    sePayWebhookApiKey: env.SEPAY_WEBHOOK_API_KEY,
    tts: {
      vbee:
        env.VBEE_APP_ID && env.VBEE_TOKEN
          ? {
              appId: env.VBEE_APP_ID,
              token: env.VBEE_TOKEN,
              apiUrl: env.VBEE_API_URL,
              timeoutMs: env.VBEE_TIMEOUT_MS,
            }
          : undefined,
      voiceCode: env.VBEE_VOICE_CODE,
      callbackUrl: env.TTS_CALLBACK_URL ?? new URL('/api/tts/vbee/callback', env.FRONTEND_URL).href,
      requestCooldownSeconds: env.TTS_REQUEST_COOLDOWN_SECONDS,
      dailyCharacterLimit: env.TTS_DAILY_CHARACTER_LIMIT,
    },
  }
}
