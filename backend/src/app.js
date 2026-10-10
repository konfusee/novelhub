import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logSerializers } from './config/logger.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './routes/health.routes.js';

export function createApp({ logger, corsOrigin }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  // pino-http's child logger replaces serializers; pass ours so req.log redacts too.
  if (logger) app.use(pinoHttp({ logger, serializers: logSerializers }));

  app.use('/api', healthRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
