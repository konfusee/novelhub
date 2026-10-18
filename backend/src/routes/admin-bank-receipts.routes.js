import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { BankTransaction } from '../models/index.js';
import { resolveBankReceipt } from '../modules/admin-bank-receipts.js';

export function createAdminBankReceiptsRouter(config) {
  const router = Router();
  router.use(
    '/admin/bank-receipts',
    requireAuth(config),
    requireRole('admin'),
    (_req, res, next) => {
      res.set('Cache-Control', 'private, no-store');
      next();
    },
  );
  router.get('/admin/bank-receipts', async (req, res, next) => {
    try {
      const query = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          status: z.enum(['open', 'resolved']).default('open'),
        })
        .strict()
        .safeParse(req.query);
      if (!query.success) throw new HttpError(400, 'validation_error', 'Bộ lọc không hợp lệ.');
      const filter = {
        matchStatus:
          query.data.status === 'resolved'
            ? 'resolved'
            : { $in: ['unmatched', 'amount-mismatch', 'expired', 'already-paid'] },
      };
      const items = await BankTransaction.find(filter)
        .sort({ receivedAt: -1, _id: -1 })
        .skip((query.data.page - 1) * 20)
        .limit(21)
        .lean();
      res.json({
        items: items
          .slice(0, 20)
          .map((r) => ({
            id: String(r._id),
            version: r.version,
            providerId: r.sePayTransactionId,
            amountVnd: r.amountVnd,
            content: r.content ?? '',
            paymentCode: r.extractedPaymentCode ?? '',
            status: r.matchStatus,
            originalStatus: r.originalMatchStatus,
            orderId: r.matchedOrderId ? String(r.matchedOrderId) : null,
            receivedAt: r.receivedAt,
            reason: r.resolutionReason ?? '',
            adjustmentId: r.adjustmentId ? String(r.adjustmentId) : null,
            canResolve:
              r.matchStatus !== 'resolved' &&
              r.apiKeyAuthenticated &&
              Number.isSafeInteger(r.amountVnd) &&
              r.amountVnd > 0,
          })),
        hasMore: items.length > 20,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/bank-receipts/:id/resolve', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          expectedVersion: z.number().int().min(0),
          accountId: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .transform((v) => v.toLowerCase()),
          reason: z.string().trim().min(1).max(500),
          confirmedRecipient: z.literal(true),
        })
        .strict()
        .safeParse(req.body);
      if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.id))
        throw new HttpError(
          400,
          'validation_error',
          'Tài khoản, phiên bản, lý do hoặc xác nhận không hợp lệ.',
        );
      res.json(await resolveBankReceipt(req.account, req.params.id, parsed.data));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
