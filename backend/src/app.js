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
import { createCatalogRouter } from './routes/catalog.routes.js';
import { createAuthorContentRouter } from './routes/author-content.routes.js';
import { createAdminCategoryRouter } from './routes/admin-category.routes.js';
import { createWorkspaceDataRouter } from './routes/workspace-data.routes.js';
import { createReaderDataRouter } from './routes/reader-data.routes.js';
import { createAuthorSubmissionsRouter } from './routes/author-submissions.routes.js';

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
  app.use('/api', createCatalogRouter(config));
  app.use('/api', createAuthorContentRouter(config));
  app.use('/api', createAuthorSubmissionsRouter(config));
  app.use('/api', createAdminCategoryRouter(config));
  app.use('/api', createWorkspaceDataRouter(config));
  app.use('/api', createReaderDataRouter(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
