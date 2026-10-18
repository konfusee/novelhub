import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { financeReport } from '../modules/admin-finance-report.js';
export function createAdminFinanceReportRouter(config) {
  const router = Router();
  router.get(
    '/admin/finance-report',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const query = z
          .object({
            period: z
              .union([z.literal('all'), z.string().regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/)])
              .default('all'),
            page: z.coerce.number().int().min(1).max(100000).default(1),
            type: z
              .enum([
                'all',
                'topup-credit',
                'unlock-debit',
                'allocation-credit',
                'withdrawal-debit',
                'adjustment',
                'reversal',
                'deletion-forfeiture',
              ])
              .default('all'),
            purpose: z
              .enum(['all', 'reader-coins', 'author-earnings', 'system-earnings'])
              .default('all'),
          })
          .strict()
          .safeParse(req.query);
        if (!query.success)
          throw new HttpError(400, 'validation_error', 'Bộ lọc tài chính không hợp lệ.');
        res.set('Cache-Control', 'private, no-store').json(await financeReport(query.data));
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
