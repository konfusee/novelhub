import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import './models/index.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);

await connectDatabase(env.MONGODB_URI, { autoIndex: env.NODE_ENV !== 'production' });
logger.info('connected to MongoDB');

const server = createApp({ logger, corsOrigin: env.CORS_ORIGIN }).listen(env.PORT, () => {
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
