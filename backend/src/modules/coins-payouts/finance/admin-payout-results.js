import { createHash } from 'node:crypto'
import { requireCurrentAdmin } from './admin-guard.js'
import {
  AuditEvent,
  PayoutResultEntry,
  PayoutSheetRow,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { notify } from '../../accounts-administration/service.js'

export async function recordPayoutResult(admin, withdrawalId, input, now = new Date()) {
  return withTransaction(async session => {
    await requireCurrentAdmin(admin, session)
    const note = input.note?.trim() ?? ''
    const transferReference = input.transferReference?.trim() ?? ''
    const transferOccurredAt = input.transferOccurredAt ? new Date(input.transferOccurredAt) : null
    if (
      !['Paid', 'Failed'].includes(input.result) ||
      (input.result === 'Failed' &&
        (!note || transferReference || transferOccurredAt || input.bankDetailsCorrection)) ||
      (input.result === 'Paid' &&
        (!transferReference ||
          transferReference.length > 200 ||
          !transferOccurredAt ||
          !Number.isFinite(+transferOccurredAt) ||
          transferOccurredAt > now))
    ) {
      throw new HttpError(
        400,
        'validation_error',
        'Nhập mã giao dịch và thời gian chuyển khoản, hoặc lý do thất bại.',
      )
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

    const requestDigest = createHash('sha256')
      .update(
        JSON.stringify({
          result: input.result,
          note,
          transferReference,
          transferOccurredAt,
          bank: input.bankDetailsCorrection ?? null,
          correctionReason: input.correctionReason ?? null,
        }),
      )
      .digest('hex')

    const previous = await PayoutResultEntry.findOne({
      withdrawalRequestId: withdrawal._id,
      resultEntryKey: input.resultEntryKey,
    })
      .select('+transferReference')
      .session(session)
      .lean()

    if (previous) {
      if (
        (previous.requestDigest && previous.requestDigest !== requestDigest) ||
        previous.result !== input.result ||
        (previous.note ?? '') !== note ||
        (previous.transferReference ?? '') !== transferReference ||
        +(previous.transferOccurredAt ?? 0) !== +(transferOccurredAt ?? 0)
      ) {
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

    if (input.result === 'Paid' && transferOccurredAt < withdrawal.evaluatedAt) {
      throw new HttpError(
        400,
        'validation_error',
        'Thời gian chuyển khoản phải sau khi lập khoản chi.',
      )
    }

    const sheet = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id })
      .select('+bankDetailsSnapshot +correctedBankDetailsSnapshot')
      .session(session)
    let correctedBankDetailsSnapshot
    if (input.result === 'Paid') {
      if (!sheet) throw new HttpError(409, 'payout_bank_required', 'Chưa có bảng chi trả hợp lệ.')
      const correction = input.bankDetailsCorrection
      if (correction) {
        if (
          !input.correctionReason?.trim() ||
          !['bankName', 'accountNumber', 'accountHolder'].every(
            key => typeof correction[key] === 'string' && correction[key].trim(),
          )
        )
          throw new HttpError(
            400,
            'validation_error',
            'Cần thông tin ngân hàng và lý do hiệu chỉnh.',
          )
        correctedBankDetailsSnapshot = correction
        sheet.correctedBankDetailsSnapshot = correction
        sheet.correctedBy = admin._id
        sheet.correctedAt = now
        sheet.correctionReason = input.correctionReason.trim()
        await sheet.save({ session })
        await AuditEvent.create(
          [
            {
              actorType: 'account',
              actorId: admin._id,
              action: 'monthly-payout.bank-details-corrected',
              targetType: 'PayoutSheetRow',
              targetId: sheet._id,
              reason: sheet.correctionReason,
              result: 'committed',
              occurredAt: now,
            },
          ],
          { session },
        )
      }
      const bank = sheet.correctedBankDetailsSnapshot ?? sheet.bankDetailsSnapshot
      if (!bank?.bankName || !bank.accountNumber || !bank.accountHolder)
        throw new HttpError(
          409,
          'payout_bank_required',
          'Cần bổ sung ngân hàng nhận có căn cứ trước khi ghi nhận đã trả.',
        )
      if (await PayoutResultEntry.exists({ result: 'Paid', transferReference }).session(session))
        throw new HttpError(
          409,
          'transfer_reference_used',
          'Mã giao dịch đã được dùng cho khoản chi khác.',
        )
    }

    const [entry] = await PayoutResultEntry.create(
      [
        {
          withdrawalRequestId: withdrawal._id,
          resultEntryKey: input.resultEntryKey,
          requestDigest,
          actorAccountId: admin._id,
          occurredAt: now,
          result: input.result,
          note,
          ...(input.result === 'Paid'
            ? {
                transferReference,
                transferOccurredAt,
                correctedBankDetailsSnapshot,
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

    await notify(
      {
        recipientAccountId: withdrawal.accountId,
        eventType: `monthly-payout.${input.result}`,
        sourceEventKey: `payout-result:${entry._id}`,
        payload: {
          withdrawalId: String(withdrawal._id),
          periodId: withdrawal.periodId,
          amountCoins: withdrawal.amountCoins,
          outcome: input.result,
          reason: note,
        },
      },
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
