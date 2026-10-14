import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { httpLogOptions } from './config/logger.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './routes/health.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { csrfProtection } from './middleware/csrf.js';

export function createApp({
  logger,
  corsOrigin,
  nodeEnv = 'development',
  cookieName = 'novelhub_session',
  sessionTtlDays = 7,
  frontendUrl = 'http://localhost:5173',
  emailVerificationTtlMinutes = 60,
  passwordResetTtlMinutes = 30,
  emailDelivery,
  captchaStore,
  google,
  googleProvider,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(csrfProtection({ corsOrigin, cookieName }));
  // pino-http's child logger replaces serializers; pass ours so req.log redacts too.
  if (logger) app.use(pinoHttp({ logger, ...httpLogOptions }));

  app.use('/api', healthRouter);
  app.use(
    '/api',
    createAuthRouter({
      nodeEnv,
      cookieName,
      sessionTtlDays,
      frontendUrl,
      emailVerificationTtlMinutes,
      passwordResetTtlMinutes,
      emailDelivery,
      captchaStore,
      logger,
      google,
      googleProvider,
    }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
