import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { TopUpOrder } from '../models/index.js';
import { createTopUpOrder, topUpOrderView } from '../modules/reader-top-up-orders.js';

export function createReaderTopUpOrdersRouter(config) {
  const router = Router();
  router.use('/reader/top-up-orders', requireAuth(config));
  router.post('/reader/top-up-orders', async (req, res, next) => {
    try {
      const input = z
        .object({ packageId: z.string().regex(/^[a-f\d]{24}$/i) })
        .strict()
        .safeParse(req.body);
      if (!input.success) throw new HttpError(400, 'validation_error', 'Mã gói nạp không hợp lệ.');
      const result = await createTopUpOrder(req.account, input.data.packageId);
      res
        .status(result.reused ? 200 : 201)
        .set('Cache-Control', 'private, no-store')
        .json(result);
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/top-up-orders/:id', async (req, res, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id))
        throw new HttpError(400, 'validation_error', 'Mã đơn không hợp lệ.');
      const order = await TopUpOrder.findOne({
        _id: req.params.id,
        accountId: req.account._id,
      }).lean();
      if (!order) throw new HttpError(404, 'not_found', 'Không tìm thấy đơn nạp.');
      res.set('Cache-Control', 'private, no-store').json({ order: topUpOrderView(order) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
