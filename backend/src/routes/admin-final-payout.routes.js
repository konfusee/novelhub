import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { recordPayoutResult } from '../modules/admin-payout-results.js';
import { regularPayoutQueue } from '../modules/monthly-author-payouts.js';
import {
  correctFinalPayoutBank,
  evaluateFinalPayout,
  finalPayoutQueue,
  finalPayoutRows,
} from '../modules/admin-final-payout.js';
export function createAdminFinalPayoutRouter(config, regular = false) {
  const router = Router();
  const base = regular ? '/admin/monthly-payouts' : '/admin/account-closures';
  router.use(base, requireAuth(config), requireRole('admin'));
  router.post(`${base}/:id/payouts/:withdrawalId/results`, async (req, res, next) => {
    try {
      const fields = {
        expectedWithdrawalVersion: z.number().int().min(0),
        expectedRowVersion: z.number().int().min(0),
        resultEntryKey: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
        reason: z.string().trim().min(1).max(1000),
        note: z.string().trim().max(1000).optional(),
        transferReference: z.string().trim().max(200).optional(),
      };
      const parsed = z
        .discriminatedUnion('result', [
          z
            .object({
              ...fields,
              result: z.literal('Paid'),
              confirmedExternalTransfer: z.literal(true),
            })
            .strict(),
          z.object({ ...fields, result: z.literal('Failed') }).strict(),
        ])
        .safeParse(req.body);
      if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.withdrawalId))
        throw new HttpError(
          400,
          'validation_error',
          'Kết quả, phiên bản, lý do hoặc xác nhận không hợp lệ.',
        );
      res
        .set('Cache-Control', 'private, no-store')
        .json(
          await recordPayoutResult(
            req.account,
            req.params.id,
            req.params.withdrawalId,
            parsed.data,
            regular,
          ),
        );
    } catch (error) {
      next(error);
    }
  });
  router.param('id', (req, res, next, id) =>
    /^[a-f\d]{24}$/i.test(id)
      ? next()
      : next(new HttpError(400, 'validation_error', 'Mã tài khoản không hợp lệ.')),
  );
  router.get(`${base}/:id/payouts`, async (req, res, next) => {
    try {
      res
        .set('Cache-Control', 'private, no-store')
        .json(await finalPayoutRows(req.params.id, regular));
    } catch (error) {
      next(error);
    }
  });
  router.post(`${base}/:id/payouts/:withdrawalId/bank`, async (req, res, next) => {
    try {
      const text = z.string().trim().min(1).max(200);
      const parsed = z
        .object({
          expectedWithdrawalVersion: z.number().int().min(0),
          expectedRowVersion: z.number().int().min(0),
          reason: z.string().trim().min(1).max(1000),
          bank: z.object({ bankName: text, accountNumber: text, accountHolder: text }).strict(),
        })
        .strict()
        .safeParse(req.body);
      if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.withdrawalId))
        throw new HttpError(
          400,
          'validation_error',
          'Thông tin ngân hàng, phiên bản và lý do không hợp lệ.',
        );
      res
        .set('Cache-Control', 'private, no-store')
        .json(
          await correctFinalPayoutBank(
            req.account,
            req.params.id,
            req.params.withdrawalId,
            parsed.data,
            regular,
          ),
        );
    } catch (error) {
      next(error);
    }
  });
  router.get(base, async (req, res, next) => {
    try {
      const parsed = z
        .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
        .strict()
        .safeParse(req.query);
      if (!parsed.success) throw new HttpError(400, 'validation_error', 'Phân trang không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(
          await (regular
            ? regularPayoutQueue(parsed.data.page)
            : finalPayoutQueue(parsed.data.page)),
        );
    } catch (error) {
      next(error);
    }
  });
  router.post(`${base}/:id/evaluate`, async (req, res, next) => {
    try {
      if (regular) throw new HttpError(405, 'automatic_only', 'Kỳ chi trả được đánh giá tự động.');
      const parsed = z
        .object({
          expectedVersion: z.number().int().min(0),
          reason: z.string().trim().min(1).max(1000),
        })
        .strict()
        .safeParse(req.body);
      if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.id))
        throw new HttpError(400, 'validation_error', 'Tài khoản, phiên bản và lý do không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(await evaluateFinalPayout(req.account, req.params.id, parsed.data));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
