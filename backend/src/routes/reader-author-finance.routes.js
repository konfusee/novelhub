import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { authorBankDetails, saveAuthorBankDetails } from '../modules/author-bank-details.js';
import {
  authorPayouts,
  authorPayoutDetail,
  authorPayoutQuery,
  authorPayoutId,
} from '../modules/author-payouts.js';

// Financial rights survive Author role removal; this router grants no authoring permissions.
export function createReaderAuthorFinanceRouter(config) {
  const router = Router();
  router.use('/reader/author-finance', requireAuth(config), (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next(
      req.account.everAuthor
        ? undefined
        : new HttpError(403, 'forbidden', 'Tài khoản chưa có quyền thu nhập tác giả.'),
    );
  });
  const parse = (schema, value) => {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new HttpError(400, 'validation_error', 'Thông tin chi trả không hợp lệ.');
    return result.data;
  };
  router.get('/reader/author-finance/bank-details', async (req, res, next) => {
    try {
      res.json(await authorBankDetails(req.account._id));
    } catch (error) {
      next(error);
    }
  });
  router.put('/reader/author-finance/bank-details', async (req, res, next) => {
    try {
      const text = z
        .string()
        .trim()
        .min(1)
        .max(200)
        .regex(/^[^\p{Cc}\p{Cf}]+$/u);
      const input = parse(
        z
          .object({
            expectedVersion: z
              .number()
              .int()
              .min(0)
              .max(Number.MAX_SAFE_INTEGER - 2),
            bank: z.object({ bankName: text, accountNumber: text, accountHolder: text }).strict(),
          })
          .strict(),
        req.body,
      );
      res.json(await saveAuthorBankDetails(req.account, input));
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/author-finance/payouts', async (req, res, next) => {
    try {
      res.json(await authorPayouts(req.account._id, parse(authorPayoutQuery, req.query)));
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/author-finance/payouts/:id', async (req, res, next) => {
    try {
      res.json(await authorPayoutDetail(req.account._id, parse(authorPayoutId, req.params.id)));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
