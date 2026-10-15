import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import {
  decideApplication,
  getApplication,
  listApplications,
} from '../modules/author-access/service.js';

const querySchema = z
  .object({
    status: z.enum(['submitted', 'approved', 'rejected', 'all']).default('submitted'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(1).max(1000),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export function createAdminAuthorRouter(config) {
  const router = Router();
  router.use('/admin/author-applications', requireAuth(config), requireRole('admin'));
  router.get('/admin/author-applications', async (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Invalid application filters');
      res.json(await listApplications(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.param('id', (req, _res, next, id) => {
    if (!/^[a-f\d]{24}$/i.test(id))
      return next(new HttpError(400, 'validation_error', 'Invalid application ID'));
    next();
  });
  router.get('/admin/author-applications/:id', async (req, res, next) => {
    try {
      res.json({ application: await getApplication(req.params.id) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/author-applications/:id/decision', async (req, res, next) => {
    try {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'A decision, reason and version are required');
      res.json({ application: await decideApplication(req.account, req.params.id, parsed.data) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
