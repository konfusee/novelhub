import { Types } from 'mongoose'
import { Account, Chapter, LedgerEntry, Story, UnlockRequest, Wallet } from '../models/index.js'
import { withTransaction } from '../db/connection.js'
import { HttpError } from '../middleware/errors.js'
import { assertReportAmounts, monthRange, REPORT_PAGE_SIZE } from './finance-reporting.js'

// Detail rows originate from the author's actual credit legs, never from today's wallet balance.
export async function getAuthorRevenueDetails(accountId, { periodId, page = 1 }) {
  const { start, end } = monthRange(periodId)
  return withTransaction(async session => {
    const author = await Account.findOne({ _id: accountId, everAuthor: true })
      .select('displayName')
      .session(session)
      .lean()
    if (!author) throw new HttpError(404, 'author_not_found', 'Không tìm thấy tác giả.')
    const wallet = await Wallet.findOne({
      ownerId: new Types.ObjectId(accountId),
      ownerType: 'account',
      purpose: 'author-earnings',
      unit: 'coin',
    })
      .session(session)
      .lean()
    const filter = {
      walletId: wallet?._id ?? null,
      ledgerType: 'allocation-credit',
      direction: 'credit',
      sourceType: 'UnlockRequest',
      occurredAt: { $gte: start, $lt: end },
    }
    const [totals] = await LedgerEntry.aggregate([
      { $match: filter },
      { $group: { _id: null, revenueCoins: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).session(session)
    const entries = await LedgerEntry.find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * REPORT_PAGE_SIZE)
      .limit(REPORT_PAGE_SIZE)
      .session(session)
      .lean()
    const sourceIds = entries.map(entry => entry.sourceId)
    const purchases = await UnlockRequest.find({ _id: { $in: sourceIds } })
      .select('chapterId effectivePriceCoins')
      .session(session)
      .lean()
    const chapters = await Chapter.find({ _id: { $in: purchases.map(row => row.chapterId) } })
      .select('title storyId')
      .session(session)
      .lean()
    const stories = await Story.find({ _id: { $in: chapters.map(row => row.storyId) } })
      .select('title')
      .session(session)
      .lean()
    const platformWallets = await Wallet.find({
      ownerType: 'system',
      purpose: 'system-earnings',
      unit: 'coin',
    })
      .select('_id')
      .session(session)
      .lean()
    const platformEntries = await LedgerEntry.find({
      sourceType: 'UnlockRequest',
      sourceId: { $in: sourceIds },
      ledgerType: 'allocation-credit',
      direction: 'credit',
      walletId: { $in: platformWallets.map(row => row._id) },
    })
      .select('sourceId amount')
      .session(session)
      .lean()
    const purchaseById = new Map(purchases.map(row => [String(row._id), row]))
    const chapterById = new Map(chapters.map(row => [String(row._id), row]))
    const storyById = new Map(stories.map(row => [String(row._id), row]))
    const platformBySource = new Map()
    for (const leg of platformEntries)
      platformBySource.set(
        String(leg.sourceId),
        (platformBySource.get(String(leg.sourceId)) ?? 0) + leg.amount,
      )
    const items = entries.map(entry => {
      const purchase = purchaseById.get(String(entry.sourceId))
      const chapter = purchase && chapterById.get(String(purchase.chapterId))
      const priceCoins = purchase?.effectivePriceCoins ?? null
      return {
        ledgerEntryId: String(entry._id),
        purchaseId: String(entry.sourceId),
        occurredAt: entry.occurredAt,
        storyTitle: chapter ? (storyById.get(String(chapter.storyId))?.title ?? null) : null,
        chapterTitle: chapter?.title ?? null,
        priceCoins,
        authorCoins: entry.amount,
        // A zero platform leg is intentionally not persisted. Without the purchase we cannot infer zero.
        platformCoins:
          platformBySource.get(String(entry.sourceId)) ?? (priceCoins === entry.amount ? 0 : null),
      }
    })
    assertReportAmounts([
      totals?.revenueCoins ?? 0,
      ...items.flatMap(row => [
        row.authorCoins,
        ...(row.platformCoins === null ? [] : [row.platformCoins]),
      ]),
    ])
    return {
      accountId: String(author._id),
      displayName: author.displayName,
      periodId,
      revenueCoins: totals?.revenueCoins ?? 0,
      totalItems: totals?.count ?? 0,
      page,
      pageSize: REPORT_PAGE_SIZE,
      hasMore: page * REPORT_PAGE_SIZE < (totals?.count ?? 0),
      items,
    }
  })
}
