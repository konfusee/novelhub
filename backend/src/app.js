import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { httpLogOptions } from './config/logger.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './routes/health.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { csrfProtection } from './middleware/csrf.js';
import { createAdminAuthorRouter } from './routes/admin-author.routes.js';
import { createSessionRouter } from './routes/session.routes.js';

// Runtime configuration is validated by loadEnv and mapped by toAppConfig.
export function createApp(config) {
  const { logger, corsOrigin, cookieName, httpJsonLimitKb } = config;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: httpJsonLimitKb * 1024 }));
  app.use(csrfProtection({ corsOrigin, cookieName }));
  if (logger) app.use(pinoHttp({ logger, ...httpLogOptions }));
  app.use('/api', healthRouter);
  app.use('/api', createAuthRouter(config));
  app.use('/api', createAdminAuthorRouter(config));
  app.use('/api', createSessionRouter(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
