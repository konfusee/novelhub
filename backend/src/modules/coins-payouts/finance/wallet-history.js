import { authorStorySources } from './author-finance-summary.js'
import {
  Wallet,
  LedgerEntry,
  TopUpOrder,
  UnlockRequest,
  UnlockEntitlement,
  ContentRevision,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'

const PAGE_SIZE = 50
const newerThan = entry => ({
  $or: [
    { occurredAt: { $gt: entry.occurredAt } },
    { occurredAt: entry.occurredAt, _id: { $gt: entry._id } },
  ],
})

export async function getWalletHistory(
  accountId,
  { page = 1, type = 'all', from, to, storyId } = {},
  purpose = 'reader-coins',
) {
  return withTransaction(async session => {
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: accountId,
      purpose,
    })
      .select('availableBalance')
      .session(session)
      .lean()
    const match = { walletId: wallet?._id }
    if (from || to)
      match.occurredAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lt: new Date(to) } : {}),
      }
    if (['allocation-credit', 'withdrawal-debit', 'adjustment', 'reversal'].includes(type))
      match.ledgerType = type
    if (type === 'added') match.ledgerType = 'topup-credit'
    if (type === 'unlock') match.ledgerType = 'unlock-debit'
    if (type === 'other') match.ledgerType = { $nin: ['topup-credit', 'unlock-debit'] }
    if (storyId && purpose === 'author-earnings') {
      match.sourceType = 'UnlockRequest'
      match.sourceId = { $in: await authorStorySources(accountId, storyId, session) }
    }
    const net = wallet
      ? await LedgerEntry.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              value: {
                $sum: {
                  $cond: [
                    { $eq: ['$direction', 'credit'] },
                    '$amount',
                    { $multiply: ['$amount', -1] },
                  ],
                },
              },
            },
          },
        ]).session(session)
      : []
    const entries = wallet
      ? await LedgerEntry.find(match)
          .sort({ occurredAt: -1, _id: -1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE + 1)
          .session(session)
          .lean()
      : []
    const rows = entries.slice(0, PAGE_SIZE)
    const sourceIds = rows.map(entry => entry.sourceId)
    const orders = await TopUpOrder.find({
      _id: { $in: sourceIds },
      ...(purpose === 'reader-coins' ? { accountId } : {}),
    })
      .session(session)
      .lean()
    const requests = await UnlockRequest.find({
      _id: { $in: sourceIds },
      ...(purpose === 'reader-coins' ? { accountId } : {}),
    })
      .session(session)
      .lean()
    const entitlements = await UnlockEntitlement.find({
      _id: { $in: requests.map(row => row.entitlementId).filter(Boolean) },
      ...(purpose === 'reader-coins' ? { accountId } : {}),
    })
      .session(session)
      .lean()
    const revisions = await ContentRevision.find({
      _id: { $in: entitlements.map(row => row.publishedRevisionId) },
      contentType: 'chapter',
    })
      .select('content.title')
      .session(session)
      .lean()
    const withdrawals = await WithdrawalRequest.find({ _id: { $in: sourceIds }, accountId })
      .session(session)
      .lean()
    const byWithdrawal = new Map(withdrawals.map(row => [String(row._id), row]))
    const byOrder = new Map(orders.map(row => [String(row._id), row]))
    const byRequest = new Map(requests.map(row => [String(row._id), row]))
    const byEntitlement = new Map(entitlements.map(row => [String(row._id), row]))
    const byRevision = new Map(revisions.map(row => [String(row._id), row.content?.title]))
    // All newer entries contribute to balances, including types hidden by a filter.
    const facets = Object.fromEntries(
      rows.map((entry, index) => [
        'entry' + index,
        [
          { $match: newerThan(entry) },
          {
            $group: {
              _id: null,
              net: {
                $sum: {
                  $cond: [
                    { $eq: ['$direction', 'credit'] },
                    '$amount',
                    { $multiply: ['$amount', -1] },
                  ],
                },
              },
            },
          },
        ],
      ]),
    )
    const totals = rows.length
      ? (
          await LedgerEntry.aggregate([
            { $match: { walletId: wallet._id } },
            { $facet: facets },
          ]).session(session)
        )[0]
      : {}
    return {
      balance: wallet?.availableBalance ?? 0,
      netAmount: net[0]?.value ?? 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: entries.length > PAGE_SIZE,
      entries: rows.map((entry, index) => {
        const order = entry.sourceType === 'TopUpOrder' ? byOrder.get(String(entry.sourceId)) : null
        const request =
          entry.sourceType === 'UnlockRequest' ? byRequest.get(String(entry.sourceId)) : null
        const entitlement = request && byEntitlement.get(String(request.entitlementId))
        const title = entitlement && byRevision.get(String(entitlement.publishedRevisionId))
        const withdrawal =
          entry.sourceType === 'WithdrawalRequest' && byWithdrawal.get(String(entry.sourceId))
        const description = withdrawal
          ? 'Khoản chi kỳ ' + withdrawal.periodId
          : order
            ? 'Nạp ' + order.coinAmount.toLocaleString('vi-VN') + ' xu · ' + order.paymentCode
            : request
              ? title
                ? (purpose === 'reader-coins' ? 'Mở khóa: ' : 'Doanh thu chương: ') + title
                : 'Mở khóa chương đã mua'
              : entry.reason || 'Biến động xu đã ghi nhận'
        return {
          id: String(entry._id),
          type: entry.ledgerType,
          amount: entry.direction === 'credit' ? entry.amount : -entry.amount,
          occurredAt: entry.occurredAt,
          description,
          balanceAfter: wallet.availableBalance - (totals['entry' + index]?.[0]?.net ?? 0),
          status: 'committed',
        }
      }),
    }
  })
}
