import { randomInt } from 'node:crypto';
import {
  Account,
  AuditEvent,
  PolicyVersion,
  TopUpOrder,
  TopUpPackage,
  Wallet,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';

export const topUpOrderView = (order, now = new Date()) => ({
  id: String(order._id),
  packageId: String(order.packageId),
  paymentCode: order.paymentCode,
  coinAmount: order.coinAmount,
  priceVnd: order.packageSnapshot.priceVnd,
  status: order.status === 'pending' && order.expiresAt <= now ? 'expired' : order.status,
  expiresAt: order.expiresAt,
  createdAt: order.createdAt,
});

// Creating an invoice never credits a wallet or asserts receipt of a transfer.
export async function createTopUpOrder(account, packageId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await withTransaction(async (session) => {
        const owner = await Account.findOneAndUpdate(
          {
            _id: account._id,
            status: 'active',
            credentialVersion: account.credentialVersion,
            authorizationEpoch: account.authorizationEpoch,
          },
          { $inc: { version: 1 } },
          { session },
        );
        if (!owner) throw new HttpError(403, 'forbidden', 'Tài khoản không còn hoạt động.');
        const now = new Date();
        const pack = await TopUpPackage.findOne({ _id: packageId, status: 'active' }).session(
          session,
        );
        if (!pack) throw new HttpError(409, 'package_unavailable', 'Gói nạp không còn hoạt động.');
        const policy = await PolicyVersion.findOne({
          status: 'effective',
          effectiveAt: { $lte: now },
        })
          .sort({ effectiveAt: -1, _id: -1 })
          .session(session);
        if (
          !policy ||
          !Number.isSafeInteger(policy.orderExpiryHours) ||
          policy.orderExpiryHours <= 0
        )
          throw new HttpError(
            409,
            'policy_required',
            'Chưa có chính sách thời hạn đơn nạp hợp lệ.',
          );
        const expiresAt = new Date(now.getTime() + policy.orderExpiryHours * 3600000);
        if (!Number.isFinite(expiresAt.getTime()))
          throw new HttpError(409, 'invalid_policy', 'Thời hạn đơn nạp không hợp lệ.');
        const wallet = await Wallet.findOneAndUpdate(
          { ownerType: 'account', ownerId: account._id, purpose: 'reader-coins' },
          { $setOnInsert: { availableBalance: 0 } },
          { upsert: true, returnDocument: 'after', session },
        );
        await TopUpOrder.updateMany(
          { accountId: account._id, status: 'pending', expiresAt: { $lte: now } },
          { $set: { status: 'expired' }, $inc: { version: 1 } },
          { session },
        );
        // Account lock serializes retries: return the existing live invoice for this package.
        const existing = await TopUpOrder.findOne({
          accountId: account._id,
          packageId,
          status: 'pending',
          expiresAt: { $gt: now },
        })
          .sort({ createdAt: -1, _id: -1 })
          .session(session);
        if (existing) return { order: topUpOrderView(existing, now), reused: true };
        const [order] = await TopUpOrder.create(
          [
            {
              accountId: account._id,
              walletId: wallet._id,
              packageId: pack._id,
              packageSnapshot: {
                priceVnd: pack.priceVnd,
                coinAmount: pack.coinAmount,
                packageVersion: pack.version,
                policy: {
                  id: String(policy._id),
                  version: policy.version,
                  effectiveAt: policy.effectiveAt,
                  orderExpiryHours: policy.orderExpiryHours,
                },
              },
              paymentCode: `NH${String(randomInt(100000000)).padStart(8, '0')}`,
              coinAmount: pack.coinAmount,
              status: 'pending',
              expiresAt,
            },
          ],
          { session },
        );
        await AuditEvent.create(
          [
            {
              actorType: 'account',
              actorId: account._id,
              action: 'topup.order.created',
              targetType: 'TopUpOrder',
              targetId: order._id,
              targetVersion: order.version,
              occurredAt: now,
              result: 'pending',
            },
          ],
          { session },
        );
        return { order: topUpOrderView(order, now), reused: false };
      });
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.paymentCode || attempt === 3) throw error;
    }
  }
}
