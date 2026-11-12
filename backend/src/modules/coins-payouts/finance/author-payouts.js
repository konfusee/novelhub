import { PayoutResultEntry, PayoutSheetRow, WithdrawalRequest } from '../../../models/index.js'
import { maskedBankDetails } from './bank-details.js'
import { withTransaction } from '../../../db/connection.js'

export async function getAuthorPayouts(accountId, page = 1, { status, year } = {}) {
  const pageSize = 20

  return withTransaction(async session => {
    const withdrawals = await WithdrawalRequest.find({
      accountId,
      ...(status ? { status } : {}),
      ...(year ? { periodId: { $gte: year + '-01', $lte: year + '-12' } } : {}),
    })
      .select('periodId amountCoins payoutSlipAmountVnd status createdAt +bankDetailsSnapshot')
      .sort({ periodId: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .session(session)
      .lean()

    const hasMore = withdrawals.length > pageSize
    const rows = withdrawals.slice(0, pageSize)

    const sheets = await PayoutSheetRow.find({
      withdrawalRequestId: { $in: rows.map(row => row._id) },
    })
      .select('withdrawalRequestId +correctedBankDetailsSnapshot')
      .session(session)
      .lean()
    const corrections = new Map(
      sheets.map(row => [String(row.withdrawalRequestId), row.correctedBankDetailsSnapshot]),
    )
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
        const bank = maskedBankDetails(corrections.get(String(row._id)) ?? row.bankDetailsSnapshot)

        return {
          withdrawalId: String(row._id),
          periodId: row.periodId,
          amountCoins: row.amountCoins,
          payoutSlipAmountVnd: row.payoutSlipAmountVnd,
          status: row.status,
          bankDetails: bank ? { bankName: bank.bankName, accountNumber: bank.accountNumber } : null,
          createdAt: row.createdAt,
          latestResult: latest
            ? {
                executionMode: latest.executionMode ?? 'legacy',
                result: latest.result,
                occurredAt: latest.occurredAt,
              }
            : null,
          bank: row.bankDetailsSnapshot
            ? {
                bankName: row.bankDetailsSnapshot.bankName ?? '',
                accountNumber:
                  String(row.bankDetailsSnapshot.accountNumber ?? '').length > 4
                    ? `••••${String(row.bankDetailsSnapshot.accountNumber).slice(-4)}`
                    : String(row.bankDetailsSnapshot.accountNumber ?? ''),
              }
            : null,
        }
      }),
    }
  })
}
