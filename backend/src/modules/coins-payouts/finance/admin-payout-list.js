import { PayoutResultEntry, WithdrawalRequest } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { assertReportAmounts, matchesAuthorName, paginateReport } from './finance-reporting.js'

export async function listMonthlyPayouts({
  periodId,
  status,
  search = '',
  latestResult,
  page = 1,
  all = false,
}) {
  return withTransaction(async session => {
    const rows = await WithdrawalRequest.find({ periodId })
      .select(
        'accountId periodId amountCoins payoutSlipAmountVnd status createdAt +bankDetailsSnapshot',
      )
      .populate({
        path: 'accountId',
        select: 'displayName',
      })
      .sort({ createdAt: -1, _id: -1 })
      .session(session)
      .lean()

    const latestResults = rows.length
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
              result: { $first: '$result' },
              note: { $first: '$note' },
              occurredAt: { $first: '$occurredAt' },
            },
          },
        ]).session(session)
      : []

    const resultByWithdrawal = new Map(latestResults.map(result => [String(result._id), result]))

    const items = rows.map(row => {
      const latest = resultByWithdrawal.get(String(row._id))
      const bank = row.bankDetailsSnapshot

      return {
        withdrawalId: String(row._id),
        accountId: row.accountId ? String(row.accountId._id) : null,
        displayName: row.accountId?.displayName ?? '',
        periodId: row.periodId,
        amountCoins: row.amountCoins,
        payoutSlipAmountVnd: row.payoutSlipAmountVnd,
        status: row.status,
        createdAt: row.createdAt,
        bankDetails: bank
          ? {
              bankName: bank.bankName,
              accountNumber: bank.accountNumber,
              accountHolder: bank.accountHolder,
            }
          : null,
        latestResult: latest
          ? {
              result: latest.result,
              note: latest.note ?? '',
              occurredAt: latest.occurredAt,
            }
          : null,
      }
    })

    const summary = {
      totalAmountVnd: 0,
      paidAmountVnd: 0,
      pendingAmountVnd: 0,
      failedCount: 0,
      failedAmountVnd: 0,
      totalCount: items.length,
    }
    for (const row of items) {
      summary.totalAmountVnd += row.payoutSlipAmountVnd
      if (row.status === 'paid') summary.paidAmountVnd += row.payoutSlipAmountVnd
      else {
        summary.pendingAmountVnd += row.payoutSlipAmountVnd
        if (row.latestResult?.result === 'Failed') {
          summary.failedCount++
          summary.failedAmountVnd += row.payoutSlipAmountVnd
        }
      }
    }
    assertReportAmounts(Object.values(summary))
    const filtered = items.filter(
      row =>
        (!status || row.status === status) &&
        matchesAuthorName(row.displayName, search) &&
        (!latestResult || (row.status === 'pending' && row.latestResult?.result === latestResult)),
    )

    return { periodId, summary, ...paginateReport(filtered, page, all) }
  })
}
