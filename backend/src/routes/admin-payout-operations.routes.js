import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { payoutOperations } from '../modules/admin-payout-operations.js';
export function createAdminPayoutOperationsRouter(config) {
  const router = Router();
  router.get(
    '/admin/payout-operations',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            period: z
              .string()
              .regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/)
              .optional(),
            page: z.coerce.number().int().min(1).max(100000).default(1),
          })
          .strict()
          .safeParse(req.query);
        if (!parsed.success)
          throw new HttpError(400, 'validation_error', 'Bộ lọc vận hành chi trả không hợp lệ.');
        res.set('Cache-Control', 'private, no-store').json(await payoutOperations(parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
