import { PayoutResultEntry, WithdrawalRequest } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'

export async function getAuthorPayouts(accountId, page = 1) {
  const pageSize = 20

  return withTransaction(async session => {
    const withdrawals = await WithdrawalRequest.find({
      accountId,
    })
      .select('periodId amountCoins payoutSlipAmountVnd status createdAt')
      .sort({ periodId: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .session(session)
      .lean()

    const hasMore = withdrawals.length > pageSize
    const rows = withdrawals.slice(0, pageSize)

    const results = rows.length
      ? await PayoutResultEntry.aggregate([
          {
            $match: {
              withdrawalRequestId: {
                $in: rows.map(row => row._id),
              },
            },
          },
          {
            $sort: {
              occurredAt: -1,
              _id: -1,
            },
          },
          {
            $group: {
              _id: '$withdrawalRequestId',
              executionMode: { $first: '$executionMode' },
              result: { $first: '$result' },
              occurredAt: { $first: '$occurredAt' },
            },
          },
        ]).session(session)
      : []

    const resultByWithdrawal = new Map(results.map(result => [String(result._id), result]))

    return {
      page,
      pageSize,
      hasMore,
      items: rows.map(row => {
        const latest = resultByWithdrawal.get(String(row._id))

        return {
          withdrawalId: String(row._id),
          periodId: row.periodId,
          amountCoins: row.amountCoins,
          payoutSlipAmountVnd: row.payoutSlipAmountVnd,
          status: row.status,
          createdAt: row.createdAt,
          latestResult: latest
            ? {
                executionMode: latest.executionMode ?? 'legacy',
                result: latest.result,
                occurredAt: latest.occurredAt,
              }
            : null,
        }
      }),
    }
  })
}
