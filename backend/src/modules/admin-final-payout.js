import {
  Account,
  AuditEvent,
  LedgerEntry,
  Notification,
  NotificationOutbox,
  PayoutSheetRow,
  RoleAssignment,
  Wallet,
  WithdrawalRequest,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { digest } from './submission-digests.js';

export function monthlyCutoff(now) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const year = local.getUTCFullYear(),
    month = local.getUTCMonth();
  return {
    period: `${year}-${String(month + 1).padStart(2, '0')}`,
    at: new Date(Date.UTC(year, month, 1) - 7 * 3600000),
  };
}
async function lockAdmin(admin, session) {
  const actor = await Account.findOneAndUpdate(
    {
      _id: admin._id,
      status: 'active',
      authorizationEpoch: admin.authorizationEpoch,
      credentialVersion: admin.credentialVersion,
    },
    { $inc: { version: 1 } },
    { session },
  );
  const role = await RoleAssignment.exists({
    accountId: admin._id,
    role: 'admin',
    status: 'active',
  }).session(session);
  if (!actor || !role) throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.');
}

// One account per transaction keeps retries bounded and prevents a partly committed payout sheet.
export async function evaluateFinalPayout(admin, accountId, input, now = new Date()) {
  return withTransaction(async (session) => {
    await lockAdmin(admin, session);
    const account = await Account.findOneAndUpdate(
      {
        _id: accountId,
        status: 'anonymized',
        everAuthor: true,
        version: input.expectedVersion,
        financiallyClosedAt: null,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).select('+finalPayoutBankDetailsSnapshot +retainedPayoutEmail');
    if (!account)
      throw new HttpError(
        409,
        'account_changed',
        'Tài khoản đã thay đổi hoặc đã đóng tài chính. Hãy tải lại.',
      );
    const cutoff = monthlyCutoff(now);
    if (!account.closedAt || account.closedAt >= cutoff.at)
      throw new HttpError(
        409,
        'cutoff_not_reached',
        'Chưa tới kỳ đánh giá tháng sau khi đóng tài khoản.',
      );
    if (account.finalPayoutEvaluatedAt)
      throw new HttpError(
        409,
        'already_evaluated',
        'Tài khoản đã được đánh giá cuối; kiểm tra các khoản chi trả đang chờ.',
      );
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: accountId,
      purpose: 'author-earnings',
    }).session(session);
    const amount = wallet?.availableBalance ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new HttpError(409, 'invalid_balance', 'Số dư thu nhập không hợp lệ.');
    let withdrawal;
    if (amount > 0) {
      if (await WithdrawalRequest.exists({ accountId, periodId: cutoff.period }).session(session))
        throw new HttpError(
          409,
          'period_exists',
          'Kỳ này đã có khoản chi trả. Cần kiểm tra trước khi đánh giá cuối.',
        );
      const bank = account.finalPayoutBankDetailsSnapshot?.toObject();
      const missing = !bank?.bankName || !bank.accountNumber || !bank.accountHolder;
      [withdrawal] = await WithdrawalRequest.create(
        [
          {
            accountId: account._id,
            earningsWalletId: wallet._id,
            origin: 'system-monthly',
            periodId: cutoff.period,
            cutoffAt: cutoff.at,
            evaluatedBalanceCoins: amount,
            thresholdCoins: 0,
            policySnapshot: { forcedByDeletion: true, thresholdCoins: 0 },
            evaluatedAt: now,
            amountCoins: amount,
            payoutSlipAmountVnd: amount,
            forcedByDeletion: true,
            ...(missing ? {} : { bankDetailsSnapshot: bank }),
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
            bankDetailsMissing: missing,
            ...(missing ? {} : { bankDetailsSnapshot: bank }),
          },
        ],
        { session },
      );
      const debited = await Wallet.updateOne(
        { _id: wallet._id, availableBalance: amount, balanceVersion: wallet.balanceVersion },
        { $inc: { availableBalance: -amount, balanceVersion: 1, version: 1 } },
        { session },
      );
      if (debited.modifiedCount !== 1)
        throw new HttpError(409, 'wallet_changed', 'Ví đã thay đổi. Hãy tải lại.');
      await LedgerEntry.create(
        [
          {
            walletId: wallet._id,
            ledgerType: 'withdrawal-debit',
            direction: 'debit',
            amount,
            sourceType: 'WithdrawalRequest',
            sourceId: withdrawal._id,
            actorAccountId: admin._id,
            idempotencyScope: {
              operation: 'final-deletion-evaluation',
              ownerId: account._id,
              key: String(account._id),
            },
            occurredAt: now,
          },
        ],
        { session },
      );
      const sourceEventKey = `withdrawal-created:${withdrawal._id}`;
      const [notification] = await Notification.create(
        [
          {
            recipientAccountId: account._id,
            eventType: 'withdrawal.created',
            sourceEventKey,
            payload: {
              title: 'Khoản chi trả cuối đã được lập',
              body: `Khoản ${amount} xu đang chờ chi trả.`,
              withdrawalRequestId: String(withdrawal._id),
            },
            deliveryState: 'pending',
          },
        ],
        { session },
      );
      await NotificationOutbox.create(
        [
          {
            sourceEventKey,
            notificationId: notification._id,
            channel: 'email',
            status: 'pending',
            attemptCount: 0,
            nextAttemptAt: now,
          },
        ],
        { session },
      );
    }
    account.finalPayoutEvaluatedAt = now;
    const unpaid = await WithdrawalRequest.exists({ accountId, status: 'pending' }).session(
      session,
    );
    if (!unpaid && amount === 0) {
      account.financiallyClosedAt = now;
      account.retainedPayoutEmail = undefined;
    }
    await account.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'account.final-payout.evaluated',
          targetType: 'Account',
          targetId: account._id,
          targetVersion: account.version,
          result: withdrawal
            ? 'pending-payout'
            : unpaid
              ? 'pending-existing-payout'
              : 'financially-closed',
          reason: input.reason,
          occurredAt: now,
        },
      ],
      { session },
    );
    return {
      account: {
        id: String(account._id),
        version: account.version,
        financiallyClosed: !!account.financiallyClosedAt,
      },
      withdrawalId: withdrawal ? String(withdrawal._id) : null,
    };
  });
}

export async function finalPayoutQueue(page, now = new Date()) {
  const filter = { status: 'anonymized', everAuthor: true, financiallyClosedAt: null };
  const [accounts, total] = await Promise.all([
    Account.find(filter)
      .sort({ closedAt: 1, _id: 1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean(),
    Account.countDocuments(filter),
  ]);
  const cutoff = monthlyCutoff(now);
  const items = [];
  for (const account of accounts) {
    const [wallet, pending] = await Promise.all([
      Wallet.findOne({ ownerType: 'account', ownerId: account._id, purpose: 'author-earnings' })
        .select('availableBalance')
        .lean(),
      WithdrawalRequest.countDocuments({ accountId: account._id, status: 'pending' }),
    ]);
    items.push({
      id: String(account._id),
      version: account.version,
      closedAt: account.closedAt,
      evaluatedAt: account.finalPayoutEvaluatedAt ?? null,
      balance: wallet?.availableBalance ?? 0,
      pendingWithdrawals: pending,
      canEvaluate:
        !!account.closedAt && account.closedAt < cutoff.at && !account.finalPayoutEvaluatedAt,
    });
  }
  return { items, total, page, pageSize: 20, period: cutoff.period, cutoffAt: cutoff.at };
}

const bankView = (bank) =>
  bank
    ? {
        bankName: typeof bank.bankName === 'string' ? bank.bankName : '',
        accountNumber: typeof bank.accountNumber === 'string' ? bank.accountNumber : '',
        accountHolder: typeof bank.accountHolder === 'string' ? bank.accountHolder : '',
      }
    : null;
export async function finalPayoutRows(accountId) {
  const account = await Account.exists({ _id: accountId, status: 'anonymized', everAuthor: true });
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản đã đóng.');
  const withdrawals = await WithdrawalRequest.find({ accountId, status: 'pending' })
    .sort({ evaluatedAt: 1, _id: 1 })
    .limit(50)
    .lean();
  const rows = await PayoutSheetRow.find({
    withdrawalRequestId: { $in: withdrawals.map((w) => w._id) },
  })
    .select('+bankDetailsSnapshot +correctedBankDetailsSnapshot')
    .lean();
  return {
    items: withdrawals.map((withdrawal) => {
      const row = rows.find((r) => String(r.withdrawalRequestId) === String(withdrawal._id));
      const consistent =
        row && row.amountCoins === withdrawal.amountCoins && row.periodId === withdrawal.periodId;
      return {
        id: String(withdrawal._id),
        version: withdrawal.version,
        period: withdrawal.periodId,
        amountCoins: withdrawal.amountCoins,
        rowVersion: row?.version ?? null,
        canCorrect: !!consistent,
        originalBank: bankView(row?.bankDetailsSnapshot),
        correctedBank: bankView(row?.correctedBankDetailsSnapshot),
        correctionReason: row?.correctionReason ?? null,
      };
    }),
    limit: 50,
  };
}
export async function correctFinalPayoutBank(admin, accountId, withdrawalId, input) {
  return withTransaction(async (session) => {
    await lockAdmin(admin, session);
    const account = await Account.findOneAndUpdate(
      { _id: accountId, status: 'anonymized', everAuthor: true, financiallyClosedAt: null },
      { $inc: { version: 1 } },
      { session },
    );
    if (!account)
      throw new HttpError(409, 'account_changed', 'Tài khoản không còn chờ quyết toán.');
    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: withdrawalId, accountId, status: 'pending', version: input.expectedWithdrawalVersion },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!withdrawal)
      throw new HttpError(
        409,
        'withdrawal_changed',
        'Khoản chi trả đã thay đổi hoặc đã trả. Hãy tải lại.',
      );
    const row = await PayoutSheetRow.findOne({
      withdrawalRequestId: withdrawal._id,
      version: input.expectedRowVersion,
    }).session(session);
    if (!row || row.amountCoins !== withdrawal.amountCoins || row.periodId !== withdrawal.periodId)
      throw new HttpError(
        409,
        'row_changed',
        'Dòng chi trả không khớp hoặc đã thay đổi. Hãy tải lại.',
      );
    const now = new Date();
    row.correctedBankDetailsSnapshot = input.bank;
    row.correctedBy = admin._id;
    row.correctedAt = now;
    row.correctionReason = input.reason;
    await row.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'payout.bank-details.corrected',
          targetType: 'PayoutSheetRow',
          targetId: row._id,
          targetVersion: row.version,
          result: 'accepted',
          reason: input.reason,
          occurredAt: now,
          dataDigest: digest({ withdrawalId, bank: input.bank }),
        },
      ],
      { session },
    );
    return {
      withdrawalId: String(withdrawal._id),
      withdrawalVersion: withdrawal.version,
      rowVersion: row.version,
    };
  });
}
