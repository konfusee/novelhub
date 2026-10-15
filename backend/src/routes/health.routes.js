import { Router } from 'express';
import { databaseState } from '../db/connection.js';

export const healthRouter = Router();

// Liveness: the process is up.
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: the database is connected and the server can serve requests.
healthRouter.get('/ready', (_req, res) => {
  const database = databaseState();
  const ready = database === 'connected';
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', database });
});
