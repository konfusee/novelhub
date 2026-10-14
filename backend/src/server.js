import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { loadDotenv } from './config/load-dotenv.js';
import { createLogger } from './config/logger.js';
import { createSmtpEmailDelivery } from './email/delivery.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import './models/index.js';

loadDotenv();
const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL, { nodeEnv: env.NODE_ENV });
const emailDelivery = env.SMTP_HOST
  ? createSmtpEmailDelivery({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    })
  : undefined;

await connectDatabase(env.MONGODB_URI, { autoIndex: env.NODE_ENV !== 'production' });
logger.info('connected to MongoDB');

const server = createApp({
  logger,
  emailDelivery,
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV,
  cookieName: env.AUTH_COOKIE_NAME,
  sessionTtlDays: env.SESSION_TTL_DAYS,
  frontendUrl: env.FRONTEND_URL,
  emailVerificationTtlMinutes: env.EMAIL_VERIFICATION_TTL_MINUTES,
  passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  google:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
        }
      : undefined,
}).listen(env.PORT, () => {
  logger.info(`NovelHub API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await disconnectDatabase();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
