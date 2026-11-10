import {
  Account,
  AuditEvent,
  PayoutResultEntry,
  RoleAssignment,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'

export async function recordSimulatedPayoutResult(admin, withdrawalId, input, now = new Date()) {
  return withTransaction(async session => {
    // Kiểm tra lại quyền admin tại thời điểm ghi dữ liệu.
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        credentialVersion: admin.credentialVersion,
        authorizationEpoch: admin.authorizationEpoch,
      },
      { $inc: { version: 1 } },
      { session },
    )

    const adminRole = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)

    if (!actor || !adminRole) {
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    }

    // Ghi vào khoản chi để các thao tác đồng thời không xử lý
    // độc lập trên cùng một trạng thái cũ.
    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: withdrawalId },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    )

    if (!withdrawal) {
      throw new HttpError(404, 'payout_not_found', 'Không tìm thấy khoản chi.')
    }

    const note = input.note ?? ''

    const previous = await PayoutResultEntry.findOne({
      withdrawalRequestId: withdrawal._id,
      resultEntryKey: input.resultEntryKey,
    })
      .session(session)
      .lean()

    if (previous) {
      if (previous.result !== input.result || (previous.note ?? '') !== note) {
        throw new HttpError(
          409,
          'payout_result_conflict',
          'Mã thao tác đã được dùng cho kết quả khác.',
        )
      }

      return {
        withdrawalId: String(withdrawal._id),
        resultEntryId: String(previous._id),
        result: previous.result,
        status: withdrawal.status,
        reused: true,
      }
    }

    if (withdrawal.status !== 'pending') {
      throw new HttpError(409, 'payout_already_paid', 'Khoản chi đã được thanh toán.')
    }

    const [entry] = await PayoutResultEntry.create(
      [
        {
          withdrawalRequestId: withdrawal._id,
          resultEntryKey: input.resultEntryKey,
          actorAccountId: admin._id,
          occurredAt: now,
          result: input.result,
          note,
          ...(input.result === 'Paid'
            ? {
                transferReference: `SIM-${withdrawal._id}-${input.resultEntryKey}`,
              }
            : {}),
        },
      ],
      { session },
    )

    if (input.result === 'Paid') {
      withdrawal.status = 'paid'
      await withdrawal.save({ session })
    }

    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'monthly-payout.result-recorded',
          targetType: 'WithdrawalRequest',
          targetId: withdrawal._id,
          targetVersion: withdrawal.version,
          result: 'committed',
          occurredAt: now,
        },
      ],
      { session },
    )

    return {
      withdrawalId: String(withdrawal._id),
      resultEntryId: String(entry._id),
      result: entry.result,
      status: withdrawal.status,
      reused: false,
    }
  })
}
