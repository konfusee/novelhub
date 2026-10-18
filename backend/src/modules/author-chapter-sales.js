import {
  ContentRevision,
  LedgerEntry,
  RevenueAllocation,
  Story,
  UnlockEntitlement,
  UnlockRequest,
} from '../models/index.js';
import { HttpError } from '../middleware/errors.js';

// Only committed purchases linked to this Author's actual credit leg count as sales.
export async function authorChapterSales(accountId, walletId, start, now) {
  if (!walletId) return { sales: [], buyers: 0, linkedCoins: 0, salesHasMore: false };
  const results = await LedgerEntry.aggregate([
    {
      $match: {
        walletId,
        ledgerType: 'allocation-credit',
        direction: 'credit',
        occurredAt: { $gte: start, $lte: now },
        sourceType: { $in: ['UnlockRequest', 'RevenueAllocation'] },
      },
    },
    {
      $lookup: {
        from: RevenueAllocation.collection.name,
        localField: 'sourceId',
        foreignField: '_id',
        as: 'allocation',
      },
    },
    {
      $set: {
        unlockId: {
          $cond: [
            { $eq: ['$sourceType', 'UnlockRequest'] },
            '$sourceId',
            { $arrayElemAt: ['$allocation.unlockRequestId', 0] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: UnlockRequest.collection.name,
        localField: 'unlockId',
        foreignField: '_id',
        as: 'unlock',
      },
    },
    { $unwind: '$unlock' },
    {
      $match: {
        'unlock.status': 'committed',
        'unlock.effectivePriceCoins': { $gt: 0, $lte: Number.MAX_SAFE_INTEGER },
      },
    },
    {
      $lookup: {
        from: UnlockEntitlement.collection.name,
        localField: 'unlock.entitlementId',
        foreignField: '_id',
        as: 'entitlement',
      },
    },
    { $unwind: '$entitlement' },
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ['$entitlement.accountId', '$unlock.accountId'] },
            { $eq: ['$entitlement.chapterId', '$unlock.chapterId'] },
            { $eq: ['$entitlement.priceCoins', '$unlock.effectivePriceCoins'] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: Story.collection.name,
        localField: 'entitlement.storyId',
        foreignField: '_id',
        as: 'story',
      },
    },
    { $unwind: '$story' },
    { $match: { 'story.authorAccountId': accountId } },
    {
      $lookup: {
        from: ContentRevision.collection.name,
        localField: 'entitlement.publishedRevisionId',
        foreignField: '_id',
        as: 'revision',
      },
    },
    { $unwind: '$revision' },
    {
      $match: {
        'revision.authorAccountId': accountId,
        $expr: {
          $and: [
            { $eq: ['$revision.chapterId', '$unlock.chapterId'] },
            { $eq: ['$revision.storyId', '$story._id'] },
          ],
        },
      },
    },
    {
      $facet: {
        buyers: [{ $group: { _id: '$unlock.accountId' } }, { $count: 'count' }],
        credits: [{ $group: { _id: null, amount: { $sum: '$amount' } } }],
        sales: [
          {
            $group: {
              _id: {
                chapterId: '$unlock.chapterId',
                price: '$unlock.effectivePriceCoins',
                buyerId: '$unlock.accountId',
              },
              coins: { $sum: '$amount' },
              title: { $first: '$story.title' },
              chapterTitle: { $first: '$revision.content.title' },
              storyId: { $first: '$story._id' },
            },
          },
          {
            $group: {
              _id: { chapterId: '$_id.chapterId', price: '$_id.price' },
              coins: { $sum: '$coins' },
              buyers: { $sum: 1 },
              title: { $first: '$title' },
              chapterTitle: { $first: '$chapterTitle' },
              storyId: { $first: '$storyId' },
            },
          },
          { $sort: { coins: -1, '_id.chapterId': 1, '_id.price': 1 } },
          { $limit: 101 },
        ],
      },
    },
  ]);
  const result = results[0] ?? { sales: [], buyers: [], credits: [] };
  if (
    !Number.isSafeInteger(result.credits[0]?.amount ?? 0) ||
    result.sales.some(
      (r) => !Number.isSafeInteger(r.coins) || r.coins < 0 || !Number.isSafeInteger(r._id.price),
    )
  )
    throw new HttpError(
      409,
      'invalid_sales_data',
      'Số liệu doanh số không hợp lệ hoặc vượt giới hạn.',
    );
  return {
    sales: result.sales.slice(0, 100).map((r) => ({
      id: `${r._id.chapterId}:${r._id.price}`,
      storyId: String(r.storyId),
      chapterId: String(r._id.chapterId),
      title: r.title,
      chapter: r.chapterTitle,
      price: r._id.price,
      buyers: r.buyers,
      coins: r.coins,
    })),
    buyers: result.buyers[0]?.count ?? 0,
    linkedCoins: result.credits[0]?.amount ?? 0,
    salesHasMore: result.sales.length > 100,
  };
}
