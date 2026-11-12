import { startMonthlyPayoutWorker } from './modules/coins-payouts/finance/monthly-payout-worker.js'
import { startNotificationWorker } from './modules/accounts-administration/email-worker.js'
import { createApp } from './app.js'
import { loadEnv, toAppConfig } from './config/env.js'
import { loadDotenv } from './config/load-dotenv.js'
import { createLogger } from './config/logger.js'
import { createSmtpEmailDelivery } from './email/delivery.js'
import { connectDatabase, disconnectDatabase } from './db/connection.js'
import './models/index.js'
import { startChapterScheduler } from './modules/authoring-publishing/content/chapter-scheduler.js'
import { startEvidenceWorker } from './modules/moderation-ai/ai/evidence-worker.js'
loadDotenv()
const env = loadEnv()
const logger = createLogger(env.LOG_LEVEL, {
  nodeEnv: env.NODE_ENV,
})
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
  : undefined
await connectDatabase(env.MONGODB_URI, {
  autoIndex: env.NODE_ENV !== 'production',
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
logger.info('connected to MongoDB')
const config = {
  logger,
  emailDelivery,
  ...toAppConfig(env),
}
const stopMonthlyPayouts = startMonthlyPayoutWorker(logger)
const stopNotifications = startNotificationWorker(config)
const stopScheduler = startChapterScheduler(config, logger)
let stopEvidenceWorker = async () => {}
if (config.ai.workerEnabled) stopEvidenceWorker = startEvidenceWorker(config, logger)
else logger.info('AI evidence worker disabled (AI_EVIDENCE_WORKER_ENABLED is not true)')
const server = createApp(config).listen(env.PORT, () => {
  logger.info(`NovelHub API listening on port ${env.PORT}`)
})
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`)
  server.close()
  await stopMonthlyPayouts()
  await stopNotifications()
  await stopScheduler()
  await stopEvidenceWorker()
  await disconnectDatabase()
  // nodemon restarts with SIGUSR2 and waits for the process to re-raise it.
  if (signal === 'SIGUSR2') process.kill(process.pid, 'SIGUSR2')
  else process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.once('SIGUSR2', shutdown)
