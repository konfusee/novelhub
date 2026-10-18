import { Account, AuditEvent, BankTransaction, LedgerEntry, Wallet } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { lockPayoutAdmin } from './admin-final-payout.js';
import { digest } from './submission-digests.js';

export async function resolveBankReceipt(admin, receiptId, input) {
  if (input.confirmedRecipient !== true)
    throw new HttpError(400, 'confirmation_required', 'Cần xác nhận đã đối chiếu người nhận xu.');
  return withTransaction(async (session) => {
    await lockPayoutAdmin(admin, session);
    const receipt = await BankTransaction.findById(receiptId).session(session);
    if (!receipt) throw new HttpError(404, 'not_found', 'Không tìm thấy giao dịch ngân hàng.');
    const fingerprint = digest({
      accountId: input.accountId,
      reason: input.reason,
      actorId: String(admin._id),
    });
    if (receipt.matchStatus === 'resolved') {
      const audit = await AuditEvent.findOne({
        action: 'topup.receipt.resolved',
        targetId: receipt._id,
      }).session(session);
      if (!audit || audit.dataDigest !== fingerprint)
        throw new HttpError(409, 'already_resolved', 'Giao dịch đã được xử lý với nội dung khác.');
      return {
        receiptId: String(receipt._id),
        adjustmentId: String(receipt.adjustmentId),
        replayed: true,
      };
    }
    if (
      receipt.version !== input.expectedVersion ||
      receipt.matchStatus === 'matched' ||
      !receipt.apiKeyAuthenticated ||
      !Number.isSafeInteger(receipt.amountVnd) ||
      receipt.amountVnd <= 0
    )
      throw new HttpError(409, 'receipt_changed', 'Giao dịch không đủ điều kiện hoặc đã thay đổi.');
    const owner = await Account.findOneAndUpdate(
      { _id: input.accountId, status: 'active' },
      { $inc: { version: 1 } },
      { session },
    );
    if (!owner)
      throw new HttpError(409, 'recipient_unavailable', 'Tài khoản nhận xu không còn hoạt động.');
    const wallet = await Wallet.findOneAndUpdate(
      { ownerType: 'account', ownerId: owner._id, purpose: 'reader-coins' },
      { $setOnInsert: { availableBalance: 0 } },
      { upsert: true, returnDocument: 'after', session },
    );
    if (
      !Number.isSafeInteger(wallet.availableBalance) ||
      wallet.availableBalance < 0 ||
      !Number.isSafeInteger(wallet.availableBalance + receipt.amountVnd)
    )
      throw new HttpError(409, 'invalid_balance', 'Số dư không hợp lệ.');
    const credited = await Wallet.updateOne(
      { _id: wallet._id, balanceVersion: wallet.balanceVersion },
      { $inc: { availableBalance: receipt.amountVnd, balanceVersion: 1, version: 1 } },
      { session },
    );
    if (credited.modifiedCount !== 1) throw new HttpError(409, 'wallet_changed', 'Ví đã thay đổi.');
    const now = new Date();
    const [adjustment] = await LedgerEntry.create(
      [
        {
          walletId: wallet._id,
          ledgerType: 'adjustment',
          direction: 'credit',
          amount: receipt.amountVnd,
          reason: input.reason,
          actorAccountId: admin._id,
          sourceType: 'BankTransaction',
          sourceId: receipt._id,
          idempotencyScope: {
            operation: 'bank-receipt-resolution',
            ownerId: owner._id,
            key: String(receipt._id),
          },
          occurredAt: now,
        },
      ],
      { session },
    );
    const resolved = await BankTransaction.updateOne(
      { _id: receipt._id, version: input.expectedVersion, matchStatus: receipt.matchStatus },
      {
        $set: {
          matchStatus: 'resolved',
          resolvedBy: admin._id,
          resolvedAt: now,
          resolutionReason: input.reason,
          adjustmentId: adjustment._id,
        },
        $inc: { version: 1 },
      },
      { session },
    );
    if (resolved.modifiedCount !== 1)
      throw new HttpError(409, 'receipt_changed', 'Giao dịch đã thay đổi.');
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'topup.receipt.resolved',
          targetType: 'BankTransaction',
          targetId: receipt._id,
          targetVersion: receipt.version + 1,
          reason: input.reason,
          result: 'credited',
          dataDigest: fingerprint,
          occurredAt: now,
          idempotencyScope: {
            operation: 'bank-receipt-resolution',
            ownerId: owner._id,
            key: String(receipt._id),
          },
        },
      ],
      { session },
    );
    return {
      receiptId: String(receipt._id),
      adjustmentId: String(adjustment._id),
      replayed: false,
    };
  });
}
