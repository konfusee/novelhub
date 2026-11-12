import {
  Chapter,
  LedgerEntry,
  PayoutResultEntry,
  Story,
  UnlockRequest,
  Wallet,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { payoutCutoff, currentPayoutPeriod } from './payout-period.js'

export async function authorStorySources(accountId, storyId, session) {
  const story = await Story.exists({ _id: storyId, authorAccountId: accountId }).session(session)
  if (!story) return []
  const chapters = await Chapter.distinct('_id', { storyId }).session(session)
  return UnlockRequest.distinct('_id', {
    chapterId: { $in: chapters },
    status: 'committed',
  }).session(session)
}

export async function getAuthorFinanceSummary(accountId, { storyId } = {}, now = new Date()) {
  return withTransaction(async session => {
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: accountId,
      purpose: 'author-earnings',
    })
      .session(session)
      .lean()
    const period = currentPayoutPeriod(now)
    const monthStart = payoutCutoff(period)
    const nextMonth = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1))
    const nextEvaluationAt = payoutCutoff(nextMonth.toISOString().slice(0, 7))
    const sourceIds = storyId ? await authorStorySources(accountId, storyId, session) : null
    const earnings = wallet
      ? await LedgerEntry.aggregate([
          {
            $match: {
              walletId: wallet._id,
              ledgerType: 'allocation-credit',
              sourceType: 'UnlockRequest',
              occurredAt: { $gte: monthStart, $lt: nextEvaluationAt },
              ...(sourceIds ? { sourceId: { $in: sourceIds } } : {}),
            },
          },
          { $group: { _id: '$sourceId', coins: { $sum: '$amount' } } },
          { $group: { _id: null, revenueCoins: { $sum: '$coins' }, paidUnlockCount: { $sum: 1 } } },
        ]).session(session)
      : []
    const payouts = await WithdrawalRequest.find({ accountId })
      .select('status amountCoins')
      .session(session)
      .lean()
    const latest = await PayoutResultEntry.aggregate([
      { $match: { withdrawalRequestId: { $in: payouts.map(row => row._id) } } },
      { $sort: { occurredAt: -1, _id: -1 } },
      { $group: { _id: '$withdrawalRequestId', result: { $first: '$result' } } },
    ]).session(session)
    const results = new Map(latest.map(row => [String(row._id), row.result]))
    const payoutSummary = { pending: 0, paid: 0, failed: 0 }
    for (const row of payouts) {
      const state =
        row.status === 'paid'
          ? 'paid'
          : results.get(String(row._id)) === 'Failed'
            ? 'failed'
            : 'pending'
      payoutSummary[state] += row.amountCoins
    }
    return {
      periodId: period,
      revenueCoins: earnings[0]?.revenueCoins ?? 0,
      paidUnlockCount: earnings[0]?.paidUnlockCount ?? 0,
      payoutSummary,
      nextEvaluationAt,
    }
  })
}
