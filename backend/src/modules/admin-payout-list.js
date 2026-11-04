import { PayoutResultEntry, WithdrawalRequest } from '../models/index.js'

export async function listMonthlyPayouts({ periodId, status, page = 1 }) {
  const pageSize = 20
  const filter = { periodId }

  if (status) {
    filter.status = status
  }

  const withdrawals = await WithdrawalRequest.find(filter)
    .select(
      'accountId periodId amountCoins payoutSlipAmountVnd status createdAt +bankDetailsSnapshot',
    )
    .populate({
      path: 'accountId',
      select: 'displayName',
    })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize + 1)
    .lean()

  // Lấy dư một bản ghi để biết còn trang tiếp theo không.
  const hasMore = withdrawals.length > pageSize
  const rows = withdrawals.slice(0, pageSize)

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
      ])
    : []

  const resultByWithdrawal = new Map(latestResults.map(result => [String(result._id), result]))

  return {
    periodId,
    page,
    pageSize,
    hasMore,
    items: rows.map(row => {
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
    }),
  }
}
