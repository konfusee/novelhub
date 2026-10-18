import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { LedgerEntry, PolicyVersion, TopUpOrder, TopUpPackage, Wallet } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { createTopUpOrder, topUpOrderView } from '../modules/reader-top-up-orders.js';

export function createReaderTopUpOrdersRouter(config) {
  const router = Router();
  router.get('/reader/wallet', requireAuth(config), async (req, res, next) => {
    try {
      const result = await withTransaction(async (session) => {
        const wallet = await Wallet.findOne({
          ownerType: 'account',
          ownerId: req.account._id,
          purpose: 'reader-coins',
        })
          .session(session)
          .lean();
        const entries = wallet
          ? await LedgerEntry.find({ walletId: wallet._id })
              .sort({ occurredAt: -1, _id: -1 })
              .limit(51)
              .session(session)
              .lean()
          : [];
        const packages = await TopUpPackage.find({ status: 'active' })
          .sort({ priceVnd: 1, _id: 1 })
          .session(session)
          .lean();
        const policy = await PolicyVersion.findOne({
          status: 'effective',
          effectiveAt: { $lte: new Date() },
        })
          .sort({ effectiveAt: -1, _id: -1 })
          .session(session)
          .lean();
        const orders = await TopUpOrder.find({
          accountId: req.account._id,
          status: 'pending',
          expiresAt: { $gt: new Date() },
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .session(session)
          .lean();
        return {
          balance: wallet?.availableBalance ?? 0,
          packages: packages.map((p) => ({
            id: String(p._id),
            coinAmount: p.coinAmount,
            priceVnd: p.priceVnd,
          })),
          entries: entries.slice(0, 50).map((e) => ({
            id: String(e._id),
            type: e.ledgerType,
            amount: e.direction === 'credit' ? e.amount : -e.amount,
            occurredAt: e.occurredAt,
          })),
          hasMore: entries.length > 50,
          orders: orders.map((order) => topUpOrderView(order)),
          payment: config.sepay
            ? { accountNumber: config.sepay.accountNumber, bankName: config.sepay.bankName ?? null }
            : null,
          authorRatePercent: policy?.authorSharePercent ?? null,
        };
      });
      res.set('Cache-Control', 'private, no-store').json(result);
    } catch (error) {
      next(error);
    }
  });
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
