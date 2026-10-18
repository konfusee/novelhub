import {
  Account,
  AuditEvent,
  PayoutResultEntry,
  PayoutSheetRow,
  Wallet,
  WithdrawalRequest,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { lockPayoutAdmin } from './admin-final-payout.js';
import { digest } from './submission-digests.js';
import { enqueuePayoutNotification } from './payout-notifications.js';

export async function recordPayoutResult(admin, accountId, withdrawalId, input, regular = false) {
  if (input.result === 'Paid' && input.confirmedExternalTransfer !== true)
    throw new HttpError(
      400,
      'confirmation_required',
      'Cần xác nhận đã đối chiếu khoản chuyển tiền bên ngoài hệ thống.',
    );
  return withTransaction(async (session) => {
    await lockPayoutAdmin(admin, session);
    const account = await Account.findOneAndUpdate(
      {
        _id: accountId,
        status: regular ? { $in: ['active', 'suspended'] } : 'anonymized',
        everAuthor: true,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).select('+retainedPayoutEmail');
    if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản đã đóng.');
    const fingerprint = digest({
      actorId: String(admin._id),
      result: input.result,
      reason: input.reason,
      note: input.note ?? '',
      transferReference: input.transferReference ?? '',
    });
    const key = `${withdrawalId}:${input.resultEntryKey}`;
    const previous = await PayoutResultEntry.findOne({
      withdrawalRequestId: withdrawalId,
      resultEntryKey: input.resultEntryKey,
    }).session(session);
    if (previous) {
      const audit = await AuditEvent.findOne({
        action: 'payout.result.recorded',
        'idempotencyScope.operation': 'payout-result',
        'idempotencyScope.ownerId': account._id,
        'idempotencyScope.key': key,
      }).session(session);
      if (!audit || audit.dataDigest !== fingerprint)
        throw new HttpError(409, 'idempotency_conflict', 'Mã thao tác đã dùng với nội dung khác.');
      return {
        entryId: String(previous._id),
        result: previous.result,
        financiallyClosed: !!account.financiallyClosedAt,
        replayed: true,
      };
    }
    if (account.financiallyClosedAt)
      throw new HttpError(409, 'financially_closed', 'Tài khoản đã đóng tài chính.');
    if (
      await PayoutResultEntry.exists({ withdrawalRequestId: withdrawalId, result: 'Paid' }).session(
        session,
      )
    )
      throw new HttpError(
        409,
        'already_paid',
        'Khoản đã có bằng chứng Paid; không thể ghi thêm kết quả.',
      );
    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      {
        _id: withdrawalId,
        accountId,
        status: 'pending',
        version: input.expectedWithdrawalVersion,
        ...(regular ? { forcedByDeletion: false } : {}),
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    );
    const row = await PayoutSheetRow.findOne({
      withdrawalRequestId: withdrawalId,
      version: input.expectedRowVersion,
    })
      .select('+bankDetailsSnapshot +correctedBankDetailsSnapshot')
      .session(session);
    if (
      !withdrawal ||
      !row ||
      row.periodId !== withdrawal.periodId ||
      row.amountCoins !== withdrawal.amountCoins ||
      withdrawal.payoutSlipAmountVnd !== withdrawal.amountCoins
    )
      throw new HttpError(
        409,
        'payout_changed',
        'Khoản hoặc dòng chi trả đã thay đổi. Hãy tải lại.',
      );
    const bank = row.correctedBankDetailsSnapshot ?? row.bankDetailsSnapshot;
    if (
      input.result === 'Paid' &&
      !['bankName', 'accountNumber', 'accountHolder'].every(
        (key) => typeof bank?.[key] === 'string' && bank[key].trim(),
      )
    )
      throw new HttpError(
        409,
        'bank_required',
        'Cần đủ thông tin ngân hàng trước khi ghi đã chi trả.',
      );
    const now = new Date();
    const [entry] = await PayoutResultEntry.create(
      [
        {
          withdrawalRequestId: withdrawal._id,
          resultEntryKey: input.resultEntryKey,
          actorAccountId: admin._id,
          occurredAt: now,
          result: input.result,
          transferReference: input.transferReference,
          note: input.note,
          correctedBankDetailsSnapshot: row.correctedBankDetailsSnapshot,
        },
      ],
      { session },
    );
    if (input.result === 'Paid') {
      withdrawal.status = 'paid';
      await withdrawal.save({ session });
    }
    await enqueuePayoutNotification(
      account,
      {
        key: `withdrawal-result:${withdrawal._id}:${input.resultEntryKey}`,
        type: `withdrawal.${input.result.toLowerCase()}`,
        title:
          input.result === 'Paid'
            ? 'Khoản chi trả đã được ghi nhận'
            : 'Khoản chi trả chưa thành công',
        body:
          input.result === 'Paid'
            ? `Đã ghi nhận chi trả ${withdrawal.amountCoins} xu, tương ứng ${withdrawal.payoutSlipAmountVnd} VND, kỳ ${withdrawal.periodId}.`
            : `Khoản ${withdrawal.amountCoins} xu kỳ ${withdrawal.periodId} vẫn đang chờ chi trả.`,
        withdrawalId: withdrawal._id,
      },
      session,
      now,
    );
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: accountId,
      purpose: 'author-earnings',
    }).session(session);
    const unpaid = await WithdrawalRequest.exists({ accountId, status: 'pending' }).session(
      session,
    );
    if (
      account.status === 'anonymized' &&
      account.finalPayoutEvaluatedAt &&
      wallet?.availableBalance === 0 &&
      !unpaid
    ) {
      account.financiallyClosedAt = now;
      account.retainedPayoutEmail = undefined;
      await account.save({ session });
    }
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'payout.result.recorded',
          targetType: 'WithdrawalRequest',
          targetId: withdrawal._id,
          targetVersion: withdrawal.version,
          result: input.result,
          reason: input.reason,
          occurredAt: now,
          dataDigest: fingerprint,
          idempotencyScope: { operation: 'payout-result', ownerId: account._id, key },
        },
      ],
      { session },
    );
    return {
      entryId: String(entry._id),
      result: entry.result,
      financiallyClosed: !!account.financiallyClosedAt,
      replayed: false,
    };
  });
}
