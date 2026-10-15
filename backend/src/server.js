import { createApp } from './app.js';
import { loadEnv, toAppConfig } from './config/env.js';
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
      connectionTimeoutMs: env.SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeoutMs: env.SMTP_GREETING_TIMEOUT_MS,
      socketTimeoutMs: env.SMTP_SOCKET_TIMEOUT_MS,
    })
  : undefined;

await connectDatabase(env.MONGODB_URI, {
  autoIndex: env.NODE_ENV !== 'production',
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
});
logger.info('connected to MongoDB');

const server = createApp({
  logger,
  emailDelivery,
  ...toAppConfig(env),
}).listen(env.PORT, () => {
  logger.info(`NovelHub API listening on port ${env.PORT}`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await disconnectDatabase();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
