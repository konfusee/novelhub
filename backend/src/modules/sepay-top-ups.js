import {
  Account,
  AuditEvent,
  BankTransaction,
  LedgerEntry,
  TopUpOrder,
  Wallet,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';

function paymentCode(content) {
  const codes = [...content.toUpperCase().matchAll(/(?<![A-Z0-9])NH[0-9]{8}(?![A-Z0-9])/g)];
  return codes.length === 1 ? codes[0][0] : undefined;
}

// The unique provider ID and all financial writes commit together, including unmatched receipts.
export async function receiveTopUp(input) {
  const id = String(input.id);
  const replay = (existing) => {
    if (existing.amountVnd !== input.transferAmount || existing.content !== input.content)
      throw new HttpError(
        409,
        'receipt_conflict',
        'Mã giao dịch đã được ghi nhận với dữ liệu khác.',
      );
    return existing;
  };
  try {
    return await withTransaction(async (session) => {
      const existing = await BankTransaction.findOne({ sePayTransactionId: id }).session(session);
      if (existing) return replay(existing);
      const now = new Date();
      const code = paymentCode(input.content);
      const order = code ? await TopUpOrder.findOne({ paymentCode: code }).session(session) : null;
      let status = 'unmatched';
      if (order) {
        if (order.status === 'paid') status = 'already-paid';
        else if (order.status === 'expired' || order.expiresAt <= now) status = 'expired';
        else if (order.packageSnapshot.priceVnd !== input.transferAmount)
          status = 'amount-mismatch';
        else {
          // Serialize against account closure/suspension; never credit a deleted account.
          const owner = await Account.findOneAndUpdate(
            { _id: order.accountId, status: 'active' },
            { $inc: { version: 1 } },
            { session },
          );
          if (owner) status = 'matched';
        }
      }
      const [receipt] = await BankTransaction.create(
        [
          {
            sePayTransactionId: id,
            amountVnd: input.transferAmount,
            content: input.content,
            extractedPaymentCode: code,
            matchStatus: status,
            originalMatchStatus: status,
            matchedOrderId: order?._id,
            receivedAt: now,
            apiKeyAuthenticated: true,
          },
        ],
        { session },
      );
      if (status === 'expired' && order.status === 'pending')
        await TopUpOrder.updateOne(
          { _id: order._id, version: order.version, status: 'pending' },
          { $set: { status: 'expired' }, $inc: { version: 1 } },
          { session },
        );
      if (status === 'matched') {
        const wallet = await Wallet.findOne({
          _id: order.walletId,
          ownerType: 'account',
          ownerId: order.accountId,
          purpose: 'reader-coins',
        }).session(session);
        if (
          !wallet ||
          !Number.isSafeInteger(wallet.availableBalance) ||
          !Number.isSafeInteger(order.coinAmount) ||
          order.coinAmount <= 0 ||
          !Number.isSafeInteger(wallet.availableBalance + order.coinAmount)
        )
          throw new HttpError(409, 'invalid_wallet', 'Số dư ví không hợp lệ.');
        const paid = await TopUpOrder.updateOne(
          { _id: order._id, version: order.version, status: 'pending' },
          {
            $set: {
              status: 'paid',
              paidAmountVnd: input.transferAmount,
              bankTransactionId: receipt._id,
              confirmedAt: now,
            },
            $inc: { version: 1 },
          },
          { session },
        );
        const credited = await Wallet.updateOne(
          { _id: wallet._id, balanceVersion: wallet.balanceVersion },
          { $inc: { availableBalance: order.coinAmount, balanceVersion: 1, version: 1 } },
          { session },
        );
        if (paid.modifiedCount !== 1 || credited.modifiedCount !== 1)
          throw new HttpError(409, 'version_conflict', 'Giao dịch đã thay đổi, vui lòng thử lại.');
        await LedgerEntry.create(
          [
            {
              walletId: wallet._id,
              ledgerType: 'topup-credit',
              direction: 'credit',
              amount: order.coinAmount,
              sourceType: 'TopUpOrder',
              sourceId: order._id,
              occurredAt: now,
              idempotencyScope: {
                operation: 'topup-credit',
                ownerId: order.accountId,
                key: String(order._id),
              },
            },
          ],
          { session },
        );
      }
      await AuditEvent.create(
        [
          {
            actorType: 'system',
            action: 'topup.receipt.recorded',
            targetType: 'BankTransaction',
            targetId: receipt._id,
            occurredAt: now,
            result: status,
          },
        ],
        { session },
      );
      return receipt;
    });
  } catch (error) {
    if (error.code !== 11000 || !error.keyPattern?.sePayTransactionId) throw error;
    const existing = await BankTransaction.findOne({ sePayTransactionId: id });
    if (!existing) throw error;
    return replay(existing);
  }
}
