import { PayoutResultEntry, WithdrawalRequest } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'

export async function getPayoutDetails(withdrawalId, { accountId, page = 1 } = {}) {
  return withTransaction(async session => {
    const withdrawal = await WithdrawalRequest.findOne({
      _id: withdrawalId,
      ...(accountId ? { accountId } : {}),
    })
      .select('periodId amountCoins status cutoffAt evaluatedAt')
      .session(session)
      .lean()
    if (!withdrawal) throw new HttpError(404, 'payout_not_found', 'Không tìm thấy khoản chi.')
    const entries = await PayoutResultEntry.find({ withdrawalRequestId: withdrawal._id })
      .select(
        'result executionMode actorAccountId note occurredAt transferOccurredAt +transferReference',
      )
      .populate({ path: 'actorAccountId', select: 'displayName' })
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * 20)
      .limit(21)
      .session(session)
      .lean()
    return {
      withdrawalId: String(withdrawal._id),
      periodId: withdrawal.periodId,
      amountCoins: withdrawal.amountCoins,
      status: withdrawal.status,
      cutoffAt: withdrawal.cutoffAt,
      evaluatedAt: withdrawal.evaluatedAt,
      page,
      hasMore: entries.length > 20,
      items: entries
        .slice(0, 20)
        .map(row => ({
          id: String(row._id),
          result: row.result,
          mode: row.executionMode ?? 'legacy',
          actorName: accountId ? null : (row.actorAccountId?.displayName ?? null),
          actorType: row.executionMode === 'simulation' ? 'system' : 'account',
          note: !accountId || row.executionMode === 'simulation' ? (row.note ?? '') : '',
          occurredAt: row.occurredAt,
          transferOccurredAt: row.transferOccurredAt ?? null,
          transferReference:
            !accountId || row.executionMode === 'simulation'
              ? (row.transferReference ?? null)
              : null,
        })),
    }
  })
}
