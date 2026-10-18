import {
  BankTransaction,
  LedgerEntry,
  PayoutResultEntry,
  Wallet,
  WithdrawalRequest,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';

export function financePeriod(period) {
  if (period === 'all') return null;
  const [year, month] = period.split('-').map(Number);
  return {
    $gte: new Date(Date.UTC(year, month - 1, 1) - 7 * 3600000),
    $lt: new Date(Date.UTC(year, month, 1) - 7 * 3600000),
  };
}
function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new HttpError(
      409,
      'invalid_financial_data',
      'Số liệu tài chính vượt giới hạn hoặc không hợp lệ.',
    );
  return value;
}
export async function financeReport(input) {
  return withTransaction(async (session) => {
    const period = financePeriod(input.period),
      match = period ? { occurredAt: period } : {};
    const totals = await LedgerEntry.aggregate([
      { $match: match },
      {
        $lookup: {
          from: Wallet.collection.name,
          localField: 'walletId',
          foreignField: '_id',
          as: 'wallet',
        },
      },
      { $unwind: '$wallet' },
      {
        $group: {
          _id: {
            type: '$ledgerType',
            direction: '$direction',
            purpose: '$wallet.purpose',
            ownerType: '$wallet.ownerType',
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]).session(session);
    const sum = (filter) =>
      integer(totals.filter(filter).reduce((total, row) => total + row.amount, 0));
    const summary = {
      topUpCoins: sum(
        (r) =>
          r._id.type === 'topup-credit' &&
          r._id.direction === 'credit' &&
          r._id.purpose === 'reader-coins',
      ),
      unlockCoins: sum(
        (r) =>
          r._id.type === 'unlock-debit' &&
          r._id.direction === 'debit' &&
          r._id.purpose === 'reader-coins',
      ),
      authorRevenueCoins: sum(
        (r) =>
          r._id.type === 'allocation-credit' &&
          r._id.direction === 'credit' &&
          r._id.purpose === 'author-earnings',
      ),
      platformRevenueCoins: sum(
        (r) =>
          r._id.type === 'allocation-credit' &&
          r._id.direction === 'credit' &&
          r._id.purpose === 'system-earnings' &&
          r._id.ownerType === 'system',
      ),
    };
    const balances = await Wallet.aggregate([
      { $match: { ownerType: 'system', purpose: 'system-earnings' } },
      { $group: { _id: null, balance: { $sum: '$availableBalance' } } },
    ]).session(session);
    summary.platformBalanceCoins = integer(balances[0]?.balance ?? 0);
    const unpaid = await WithdrawalRequest.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, amount: { $sum: '$amountCoins' }, count: { $sum: 1 } } },
    ]).session(session);
    summary.pendingPayoutCoins = integer(unpaid[0]?.amount ?? 0);
    summary.pendingPayoutCount = unpaid[0]?.count ?? 0;
    const payouts = await PayoutResultEntry.aggregate([
      { $match: { result: 'Paid', ...match } },
      {
        $lookup: {
          from: WithdrawalRequest.collection.name,
          localField: 'withdrawalRequestId',
          foreignField: '_id',
          as: 'withdrawal',
        },
      },
      { $unwind: '$withdrawal' },
      { $group: { _id: null, amount: { $sum: '$withdrawal.amountCoins' }, count: { $sum: 1 } } },
    ]).session(session);
    summary.paidPayoutCoins = integer(payouts[0]?.amount ?? 0);
    summary.paidPayoutCount = payouts[0]?.count ?? 0;
    summary.failedPayoutAttempts = await PayoutResultEntry.countDocuments({
      result: 'Failed',
      ...match,
    }).session(session);
    summary.openBankExceptions = await BankTransaction.countDocuments({
      matchStatus: { $in: ['unmatched', 'amount-mismatch', 'expired', 'already-paid'] },
    }).session(session);
    const filter = { ...match, ...(input.type === 'all' ? {} : { ledgerType: input.type }) };
    const stages = [
      { $match: filter },
      {
        $lookup: {
          from: Wallet.collection.name,
          localField: 'walletId',
          foreignField: '_id',
          as: 'wallet',
        },
      },
      { $unwind: '$wallet' },
      ...(input.purpose === 'all' ? [] : [{ $match: { 'wallet.purpose': input.purpose } }]),
      { $sort: { occurredAt: -1, _id: -1 } },
      { $skip: (input.page - 1) * 20 },
      { $limit: 21 },
      {
        $project: {
          ledgerType: 1,
          direction: 1,
          amount: 1,
          sourceType: 1,
          sourceId: 1,
          occurredAt: 1,
          'wallet.purpose': 1,
          'wallet.ownerType': 1,
          'wallet.ownerId': 1,
        },
      },
    ];
    const rows = await LedgerEntry.aggregate(stages).session(session);
    return {
      summary,
      period: input.period,
      asOf: new Date(),
      items: rows.slice(0, 20).map((r) => ({
        id: String(r._id),
        type: r.ledgerType,
        direction: r.direction,
        amount: integer(r.amount),
        sourceType: r.sourceType,
        sourceId: String(r.sourceId),
        occurredAt: r.occurredAt,
        purpose: r.wallet.purpose,
        ownerType: r.wallet.ownerType,
        ownerId: String(r.wallet.ownerId),
      })),
      hasMore: rows.length > 20,
      page: input.page,
    };
  });
}
