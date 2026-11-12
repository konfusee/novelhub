import {
  AuditEvent,
  PayoutResultEntry,
  PayoutSheetRow,
  WithdrawalRequest,
} from '../../../models/index.js'
import { createHash } from 'node:crypto'
import { validBankDetails } from './bank-details.js'
import { withTransaction } from '../../../db/connection.js'
import { notify } from '../../accounts-administration/service.js'

// This provider is deliberately simulated: no bank request is made. The receipt
// and result explicitly identify simulation instead of claiming a real transfer.
export async function simulatePendingPayouts(now = new Date()) {
  const pending = await WithdrawalRequest.find({
    executionMode: 'simulation',
    status: 'pending',
    evaluatedAt: { $lte: now },
  })
    .select('_id')
    .sort({ _id: 1 })
    .lean()
  const results = []
  for (const candidate of pending) {
    results.push(
      await withTransaction(async session => {
        const withdrawal = await WithdrawalRequest.findOne({
          _id: candidate._id,
          status: 'pending',
          executionMode: 'simulation',
        }).session(session)
        if (!withdrawal) return { reused: true }
        const sheet = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id })
          .select('+bankDetailsSnapshot +correctedBankDetailsSnapshot')
          .session(session)
          .lean()
        const bank = sheet?.correctedBankDetailsSnapshot ?? sheet?.bankDetailsSnapshot
        // One attempt per bank snapshot: a correction creates a new attempt, never a new debit.
        const bankFingerprint = createHash('sha256')
          .update(JSON.stringify(bank ?? null))
          .digest('hex')
        const resultEntryKey = `automatic-simulation:${withdrawal._id}:${bankFingerprint}`
        if (
          await PayoutResultEntry.exists({
            withdrawalRequestId: withdrawal._id,
            resultEntryKey,
          }).session(session)
        )
          return { reused: true }
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
        if (locked.matchedCount !== 1) return { reused: true }
        withdrawal.version += 1
        const validBank = validBankDetails(bank)
        const result = validBank ? 'Paid' : 'Failed'
        const note = validBank
          ? 'Hệ thống giả lập thanh toán thành công; không có chuyển khoản ngân hàng thực tế.'
          : 'Giả lập thất bại: thiếu hoặc không hợp lệ thông tin ngân hàng nhận. Khoản chi vẫn chờ xử lý.'
        const [entry] = await PayoutResultEntry.create(
          [
            {
              withdrawalRequestId: withdrawal._id,
              resultEntryKey,
              occurredAt: now,
              executionMode: 'simulation',
              correctedBankDetailsSnapshot: sheet?.correctedBankDetailsSnapshot,
              result,
              note,
              ...(validBank
                ? { transferReference: `SIM-AUTO-${withdrawal._id}`, transferOccurredAt: now }
                : {}),
            },
          ],
          { session },
        )
        if (validBank) {
          withdrawal.status = 'paid'
          await withdrawal.save({ session })
        }
        await AuditEvent.create(
          [
            {
              actorType: 'system',
              action: 'monthly-payout.simulated',
              targetType: 'WithdrawalRequest',
              targetId: withdrawal._id,
              targetVersion: withdrawal.version,
              result,
              reason: note,
              occurredAt: now,
            },
          ],
          { session },
        )
        await notify(
          {
            recipientAccountId: withdrawal.accountId,
            eventType: `monthly-payout.${result}`,
            sourceEventKey: `payout-result:${entry._id}`,
            payload: {
              withdrawalId: String(withdrawal._id),
              periodId: withdrawal.periodId,
              amountCoins: withdrawal.amountCoins,
              outcome: result,
              reason: note,
              executionMode: 'simulation',
            },
          },
          { session },
        )
        return { withdrawalId: String(withdrawal._id), result, reused: false }
      }),
    )
  }
  return results
}
