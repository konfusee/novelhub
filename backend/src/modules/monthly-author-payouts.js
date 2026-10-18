import {
  Account,
  AuditEvent,
  LedgerEntry,
  PolicyVersion,
  PayoutSheetRow,
  Wallet,
  WithdrawalRequest,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { monthlyCutoff } from './admin-final-payout.js';
import { enqueuePayoutNotification } from './payout-notifications.js';
import { digest } from './submission-digests.js';

// Serialize with account suspension, deletion, bank edits and other financial writes.
export async function evaluateMonthlyAuthorPayout(accountId, now = new Date()) {
  const cutoff = monthlyCutoff(now);
  const alreadyEvaluated = await AuditEvent.findOne({
    action: 'author.monthly-payout.evaluated',
    targetId: accountId,
    correlationId: cutoff.period,
  }).lean();
  if (alreadyEvaluated) return { result: alreadyEvaluated.result, replayed: true };
  return withTransaction(async (session) => {
    const account = await Account.findOneAndUpdate(
      { _id: accountId, status: 'active', everAuthor: true, createdAt: { $lt: cutoff.at } },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).select('+bankDetails');
    if (!account) return { result: 'ineligible' };
    const previous = await AuditEvent.findOne({
      action: 'author.monthly-payout.evaluated',
      targetId: account._id,
      correlationId: cutoff.period,
    }).session(session);
    if (previous) return { result: previous.result, replayed: true };
    if (await WithdrawalRequest.exists({ accountId, periodId: cutoff.period }).session(session))
      return { result: 'existing-withdrawal', replayed: true };
    const policy = await PolicyVersion.findOne({
      status: { $in: ['effective', 'superseded'] },
      effectiveAt: { $lte: cutoff.at },
    })
      .sort({ effectiveAt: -1, _id: -1 })
      .session(session);
    if (
      !policy ||
      !Number.isSafeInteger(policy.withdrawalThresholdCoins) ||
      policy.withdrawalThresholdCoins < 0
    )
      throw new HttpError(
        409,
        'payout_policy_missing',
        'Chưa có chính sách chi trả hợp lệ tại kỳ chốt.',
      );
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: accountId,
      purpose: 'author-earnings',
    }).session(session);
    const available = wallet?.availableBalance ?? 0;
    // A delayed scheduler must not include earnings credited after the monthly cutoff.
    const [movement] = wallet
      ? await LedgerEntry.aggregate([
          { $match: { walletId: wallet._id, occurredAt: { $gte: cutoff.at } } },
          {
            $group: {
              _id: null,
              net: {
                $sum: {
                  $cond: [
                    { $eq: ['$direction', 'credit'] },
                    '$amount',
                    { $multiply: ['$amount', -1] },
                  ],
                },
              },
            },
          },
        ]).session(session)
      : [];
    const cutoffBalance = available - (movement?.net ?? 0);
    if (
      ![available, cutoffBalance].every(Number.isSafeInteger) ||
      available < 0 ||
      cutoffBalance < 0
    )
      throw new HttpError(409, 'invalid_balance', 'Số dư thu nhập không hợp lệ.');
    const amount = Math.min(available, cutoffBalance);
    const bank = account.bankDetails?.toObject();
    const bankComplete = ['bankName', 'accountNumber', 'accountHolder'].every(
      (key) => typeof bank?.[key] === 'string' && bank[key].trim(),
    );
    let result = 'below-threshold',
      withdrawal;
    if (amount > 0 && amount >= policy.withdrawalThresholdCoins) {
      if (!bankComplete) {
        result = 'bank-required';
        await enqueuePayoutNotification(
          account,
          {
            key: `withdrawal-created:bank-required:${account._id}:${cutoff.period}`,
            type: 'withdrawal.bank-required',
            title: 'Cần bổ sung thông tin nhận chi trả',
            body: `Thu nhập kỳ ${cutoff.period} đã đủ ngưỡng nhưng thiếu thông tin ngân hàng. Số dư được giữ nguyên và sẽ được xét lại ở kỳ sau.`,
          },
          session,
          now,
        );
      } else {
        result = 'pending-payout';
        [withdrawal] = await WithdrawalRequest.create(
          [
            {
              accountId,
              earningsWalletId: wallet._id,
              origin: 'system-monthly',
              periodId: cutoff.period,
              cutoffAt: cutoff.at,
              evaluatedBalanceCoins: cutoffBalance,
              thresholdCoins: policy.withdrawalThresholdCoins,
              policySnapshot: {
                policyVersionId: String(policy._id),
                thresholdCoins: policy.withdrawalThresholdCoins,
              },
              evaluatedAt: now,
              amountCoins: amount,
              payoutSlipAmountVnd: amount,
              forcedByDeletion: false,
              bankDetailsSnapshot: bank,
            },
          ],
          { session },
        );
        await PayoutSheetRow.create(
          [
            {
              withdrawalRequestId: withdrawal._id,
              periodId: cutoff.period,
              amountCoins: amount,
              bankDetailsMissing: false,
              bankDetailsSnapshot: bank,
            },
          ],
          { session },
        );
        const debited = await Wallet.updateOne(
          { _id: wallet._id, balanceVersion: wallet.balanceVersion, availableBalance: available },
          { $inc: { availableBalance: -amount, balanceVersion: 1, version: 1 } },
          { session },
        );
        if (debited.modifiedCount !== 1)
          throw new HttpError(409, 'wallet_changed', 'Ví đã thay đổi.');
        await LedgerEntry.create(
          [
            {
              walletId: wallet._id,
              ledgerType: 'withdrawal-debit',
              direction: 'debit',
              amount,
              sourceType: 'WithdrawalRequest',
              sourceId: withdrawal._id,
              occurredAt: now,
              idempotencyScope: {
                operation: 'monthly-author-payout',
                ownerId: account._id,
                key: cutoff.period,
              },
            },
          ],
          { session },
        );
        await enqueuePayoutNotification(
          account,
          {
            key: `withdrawal-created:${withdrawal._id}`,
            type: 'withdrawal.created',
            title: 'Khoản chi trả tháng đã được lập',
            body: `Khoản ${amount} xu kỳ ${cutoff.period} đang chờ chi trả.`,
            withdrawalId: withdrawal._id,
          },
          session,
          now,
        );
      }
    }
    await AuditEvent.create(
      [
        {
          actorType: 'system',
          action: 'author.monthly-payout.evaluated',
          targetType: 'Account',
          targetId: account._id,
          targetVersion: account.version,
          result,
          correlationId: cutoff.period,
          occurredAt: now,
          dataDigest: digest({
            cutoffAt: cutoff.at,
            cutoffBalance,
            amount,
            policyId: String(policy._id),
          }),
        },
      ],
      { session },
    );
    return { result, withdrawalId: withdrawal ? String(withdrawal._id) : null, replayed: false };
  });
}

export async function evaluateDueMonthlyAuthorPayouts({ now = new Date(), logger } = {}) {
  const cutoff = monthlyCutoff(now);
  const results = { evaluated: 0, failed: 0 };
  const cursor = Account.find({ status: 'active', everAuthor: true, createdAt: { $lt: cutoff.at } })
    .select('_id')
    .cursor({ batchSize: 25 });
  try {
    for await (const account of cursor) {
      try {
        const result = await evaluateMonthlyAuthorPayout(account._id, now);
        if (!result.replayed && result.result !== 'ineligible') results.evaluated++;
      } catch (error) {
        results.failed++;
        logger?.error(
          { err: error, accountId: String(account._id) },
          'Monthly author payout evaluation failed',
        );
      }
    }
  } finally {
    await cursor.close();
  }
  return results;
}

export async function regularPayoutQueue(page, now = new Date(), input = {}) {
  const pending = await WithdrawalRequest.aggregate([
    {
      $match: {
        ...(input.status === 'all' ? {} : { status: input.status ?? 'pending' }),
        ...(input.period && input.period !== 'all' ? { periodId: input.period } : {}),
        forcedByDeletion: false,
      },
    },
    {
      $group: {
        _id: '$accountId',
        pendingWithdrawals: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        evaluatedAt: { $min: '$evaluatedAt' },
      },
    },
    {
      $lookup: {
        from: Account.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: '$account' },
    { $match: { 'account.status': { $in: ['active', 'suspended'] }, 'account.everAuthor': true } },
    { $sort: { evaluatedAt: 1, _id: 1 } },
    {
      $facet: { items: [{ $skip: (page - 1) * 20 }, { $limit: 20 }], count: [{ $count: 'total' }] },
    },
  ]);
  const result = pending[0];
  const items = [];
  for (const row of result?.items ?? []) {
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: row._id,
      purpose: 'author-earnings',
    })
      .select('availableBalance')
      .lean();
    items.push({
      id: String(row._id),
      balance: wallet?.availableBalance ?? 0,
      pendingWithdrawals: row.pendingWithdrawals,
      evaluatedAt: row.evaluatedAt,
      canEvaluate: false,
    });
  }
  return {
    items,
    total: result?.count[0]?.total ?? 0,
    page,
    pageSize: 20,
    period: monthlyCutoff(now).period,
  };
}
