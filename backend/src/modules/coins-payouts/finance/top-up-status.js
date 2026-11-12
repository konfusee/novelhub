import { BankTransaction } from '../../../models/index.js'

export async function topUpReviewStates(orderIds) {
  const receipts = await BankTransaction.find({
    matchedOrderId: { $in: orderIds },
    apiKeyAuthenticated: true,
  })
    .select('matchedOrderId matchStatus adjustmentId amountVnd')
    .lean()
  const grouped = Map.groupBy(receipts, row => String(row.matchedOrderId))
  return new Map(
    orderIds.map(id => {
      const rows = grouped.get(String(id)) ?? []
      return [
        String(id),
        {
          reviewState: rows.some(row => !['resolved', 'matched'].includes(row.matchStatus))
            ? 'pending-review'
            : rows.some(row => row.matchStatus === 'resolved' && row.adjustmentId)
              ? 'resolved-credit'
              : rows.some(row => row.matchStatus === 'resolved')
                ? 'resolved-no-credit'
                : rows.some(row => row.matchStatus === 'matched')
                  ? 'settled'
                  : 'no-payment',
          receivedAmountVnd: rows.reduce((total, row) => total + row.amountVnd, 0),
        },
      ]
    }),
  )
}

export function orderPayment(order, bank) {
  if (!bank?.bin || !bank.name || !bank.accountNumber || !bank.accountName) return undefined
  if (order.status !== 'pending' || order.reviewState !== 'no-payment') return undefined
  return {
    bankBin: bank.bin,
    bankName: bank.name,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    amount: order.priceVnd,
    content: order.paymentCode,
  }
}
