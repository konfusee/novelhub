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
import { createAdminTaxonomyRouter } from './routes/admin-taxonomy.routes.js';
import { createAdminFormerAuthorRouter } from './routes/admin-former-author.routes.js';
import { createReaderTopUpOrdersRouter } from './routes/reader-top-up-orders.routes.js';
import { createSepayRouter } from './routes/sepay.routes.js';
import { createAdminBankReceiptsRouter } from './routes/admin-bank-receipts.routes.js';
import { createModeratorReviewClaimsRouter } from './routes/moderator-review-claims.routes.js';
import { createReaderUnlocksRouter } from './routes/reader-unlocks.routes.js';
import { createAdminFinalPayoutRouter } from './routes/admin-final-payout.routes.js';
import { createWorkspaceDataRouter } from './routes/workspace-data.routes.js';
import { createReaderDataRouter } from './routes/reader-data.routes.js';
import { createAuthorSubmissionsRouter } from './routes/author-submissions.routes.js';
import { createAuthorImportRouter } from './routes/author-import.routes.js';
import { createAuthorMediaRouter } from './routes/author-media.routes.js';

// Runtime configuration is validated by loadEnv and mapped by toAppConfig.
export function createApp(config) {
  const { logger, corsOrigin, cookieName, httpJsonLimitKb } = config;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
  const standardJson = express.json({ limit: httpJsonLimitKb * 1024 });
  const importJson = express.json({ limit: '2mb' });
  app.use((req, res, next) =>
    (req.method === 'POST' && req.path === '/api/author/imports' ? importJson : standardJson)(
      req,
      res,
      next,
    ),
  );
  app.use(csrfProtection({ corsOrigin, cookieName }));
  if (logger) app.use(pinoHttp({ logger, ...httpLogOptions }));
  app.use('/api', healthRouter);
  app.use('/api', createAuthRouter(config));
  app.use('/api', createAdminAuthorRouter(config));
  app.use('/api', createSessionRouter(config));
  app.use('/api', createCatalogRouter(config));
  app.use('/api', createAuthorContentRouter(config));
  app.use('/api', createAuthorSubmissionsRouter(config));
  app.use('/api', createAuthorImportRouter(config));
  app.use('/api', createAuthorMediaRouter(config));
  app.use('/api', createAdminCategoryRouter(config));
  app.use('/api', createAdminTaxonomyRouter(config));
  app.use('/api', createAdminFormerAuthorRouter(config));
  app.use('/api', createReaderTopUpOrdersRouter(config));
  app.use('/api', createSepayRouter(config));
  app.use('/api', createAdminBankReceiptsRouter(config));
  app.use('/api', createModeratorReviewClaimsRouter(config));
  app.use('/api', createReaderUnlocksRouter(config));
  app.use('/api', createAdminFinalPayoutRouter(config));
  app.use('/api', createWorkspaceDataRouter(config));
  app.use('/api', createReaderDataRouter(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
