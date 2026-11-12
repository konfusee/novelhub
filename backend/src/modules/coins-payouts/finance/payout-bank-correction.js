import {
  AuditEvent,
  PayoutResultEntry,
  PayoutSheetRow,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { requireCurrentAdmin } from './admin-guard.js'
import { bankDetailsSchema, maskedBankDetails, validBankDetails } from './bank-details.js'

async function correctBank(withdrawal, bank, actorId, reason, session, now) {
  const sheet = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id })
    .select('+bankDetailsSnapshot +correctedBankDetailsSnapshot')
    .session(session)
  if (!sheet) throw new HttpError(409, 'payout_sheet_missing', 'Không tìm thấy phiếu chi.')
  const current = sheet.correctedBankDetailsSnapshot ?? sheet.bankDetailsSnapshot
  const latest = await PayoutResultEntry.findOne({ withdrawalRequestId: withdrawal._id })
    .sort({ occurredAt: -1, _id: -1 })
    .session(session)
    .lean()
  if (validBankDetails(current) && latest?.result !== 'Failed') return false
  const locked = await WithdrawalRequest.updateOne(
    {
      _id: withdrawal._id,
      status: 'pending',
      executionMode: 'simulation',
      version: withdrawal.version,
    },
    { $inc: { version: 1 } },
    { session },
  )
  if (locked.matchedCount !== 1)
    throw new HttpError(409, 'payout_changed', 'Khoản chi đã thay đổi. Vui lòng tải lại.')
  sheet.correctedBankDetailsSnapshot = bank
  sheet.correctedBy = actorId
  sheet.correctedAt = now
  sheet.correctionReason = reason
  await sheet.save({ session })
  await AuditEvent.create(
    [
      {
        actorType: 'account',
        actorId,
        action: 'monthly-payout.bank-corrected',
        targetType: 'WithdrawalRequest',
        targetId: withdrawal._id,
        targetVersion: withdrawal.version + 1,
        reason,
        result: 'committed',
        occurredAt: now,
      },
    ],
    { session },
  )
  return true
}

// Updating the author's profile repairs only their failed/invalid simulated obligations.
// Neither the original snapshot nor the wallet reservation is changed.
export async function correctAuthorPendingPayoutBanks(account, session, now = new Date()) {
  const bank = bankDetailsSchema.parse({
    bankName: account.bankDetails.bankName,
    accountNumber: account.bankDetails.accountNumber,
    accountHolder: account.bankDetails.accountHolder,
  })
  const rows = await WithdrawalRequest.find({
    accountId: account._id,
    status: 'pending',
    executionMode: 'simulation',
  }).session(session)
  for (const row of rows)
    await correctBank(
      row,
      bank,
      account._id,
      'Tác giả cập nhật ngân hàng nhận khoản chi bị lỗi.',
      session,
      now,
    )
}

export async function correctPayoutBank(admin, withdrawalId, input, now = new Date()) {
  return withTransaction(async session => {
    await requireCurrentAdmin(admin, session)
    const withdrawal = await WithdrawalRequest.findOne({ _id: withdrawalId }).session(session)
    if (!withdrawal) throw new HttpError(404, 'payout_not_found', 'Không tìm thấy khoản chi.')
    if (
      withdrawal.status !== 'pending' ||
      withdrawal.executionMode !== 'simulation' ||
      withdrawal.version !== input.expectedVersion
    )
      throw new HttpError(
        409,
        'payout_changed',
        'Khoản chi đã thay đổi hoặc không cho phép sửa. Vui lòng tải lại.',
      )
    const bank = bankDetailsSchema.parse(input.bankDetails)
    const changed = await correctBank(withdrawal, bank, admin._id, input.reason, session, now)
    if (!changed)
      throw new HttpError(
        409,
        'payout_bank_not_failed',
        'Chỉ sửa ngân hàng của khoản chi bị lỗi hoặc thiếu thông tin.',
      )
    return { bankDetails: maskedBankDetails(bank), retryState: 'queued' }
  })
}
