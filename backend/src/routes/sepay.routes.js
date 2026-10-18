import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import { receiveTopUp } from '../modules/sepay-top-ups.js';

const digest = (value) => createHash('sha256').update(value).digest();
const payload = z.object({
  id: z.number().int().positive().safe(),
  accountNumber: z.string().max(30),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.number().int().positive().safe(),
  content: z.string().max(4000),
});

export function createSepayRouter(config) {
  const router = Router();
  router.post('/webhooks/sepay', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (!config.sepay)
        throw new HttpError(503, 'payments_unavailable', 'Chưa cấu hình ngân hàng.');
      const provided = /^Apikey (.+)$/i.exec(req.get('authorization') ?? '')?.[1] ?? '';
      if (!timingSafeEqual(digest(provided), digest(config.sepay.apiKey)))
        throw new HttpError(401, 'unauthorized', 'Không được phép nhận giao dịch.');
      const parsed = payload.safeParse(req.body);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Dữ liệu giao dịch không hợp lệ.');
      if (parsed.data.accountNumber !== config.sepay.accountNumber)
        throw new HttpError(400, 'wrong_bank_account', 'Tài khoản ngân hàng không khớp.');
      if (parsed.data.transferType === 'in') await receiveTopUp(parsed.data);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
