import mongoose from 'mongoose'
import {
  Account,
  BankTransaction,
  LedgerEntry,
  UnlockRequest,
  Wallet,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { assertReportAmounts } from './finance-reporting.js'

const timeKey = (field, bucket) => ({
  $dateToString: {
    date:
      bucket === 'week'
        ? {
            $dateTrunc: {
              date: field,
              unit: 'week',
              startOfWeek: 'monday',
              timezone: 'Asia/Ho_Chi_Minh',
            },
          }
        : field,
    format: bucket === 'month' ? '%Y-%m' : '%Y-%m-%d',
    timezone: 'Asia/Ho_Chi_Minh',
  },
})

export async function getPlatformFinanceReport({
  from,
  to,
  groupBy = 'month',
  policyId,
  authorId,
  storyId,
  chapterId,
  page = 1,
  all = false,
}) {
  const range = { $gte: new Date(from), $lt: new Date(to) }
  const bucket = ['day', 'week', 'month'].includes(groupBy) ? groupBy : 'month'
  return withTransaction(async session => {
    const registrations = await Account.aggregate([
      { $match: { createdAt: range } },
      {
        $group: {
          _id: { bucket: timeKey('$createdAt', bucket), status: '$status' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.bucket': 1, '_id.status': 1 } },
    ]).session(session)
    const pipeline = [
      {
        $match: {
          status: 'committed',
          createdAt: range,
          ...(policyId ? { 'policySnapshot.id': policyId } : {}),
        },
      },
      {
        $lookup: {
          from: 'unlockEntitlements',
          localField: 'entitlementId',
          foreignField: '_id',
          as: 'entitlement',
        },
      },
      { $unwind: '$entitlement' },
      {
        $lookup: {
          from: 'stories',
          localField: 'entitlement.storyId',
          foreignField: '_id',
          as: 'story',
        },
      },
      { $unwind: { path: '$story', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...(authorId ? { 'story.authorAccountId': new mongoose.Types.ObjectId(authorId) } : {}),
          ...(storyId ? { 'entitlement.storyId': new mongoose.Types.ObjectId(storyId) } : {}),
          ...(chapterId ? { chapterId: new mongoose.Types.ObjectId(chapterId) } : {}),
        },
      },
    ]
    const groupedId = ['day', 'week', 'month'].includes(groupBy)
      ? timeKey('$createdAt', groupBy)
      : groupBy === 'chapter'
        ? '$chapterId'
        : groupBy === 'story'
          ? '$entitlement.storyId'
          : '$story.authorAccountId'
    const unlocks = await UnlockRequest.aggregate([
      ...pipeline,
      {
        $group: {
          _id: groupedId,
          count: { $sum: 1 },
          coins: { $sum: '$effectivePriceCoins' },
          revisionId: {
            $first:
              groupBy === 'story'
                ? '$story.publishedRevisionId'
                : '$entitlement.publishedRevisionId',
          },
        },
      },
      { $sort: { coins: -1, _id: 1 } },
      {
        $lookup: {
          from: 'contentRevisions',
          localField: 'revisionId',
          foreignField: '_id',
          as: 'revision',
        },
      },
      { $lookup: { from: 'accounts', localField: '_id', foreignField: '_id', as: 'author' } },
      {
        $project: {
          count: 1,
          coins: 1,
          label:
            groupBy === 'author'
              ? { $arrayElemAt: ['$author.displayName', 0] }
              : ['story', 'chapter'].includes(groupBy)
                ? { $arrayElemAt: ['$revision.content.title', 0] }
                : '$_id',
        },
      },
    ]).session(session)
    const allocation = await UnlockRequest.aggregate([
      ...pipeline,
      {
        $lookup: {
          from: 'ledgerEntries',
          let: { requestId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sourceId', '$$requestId'] },
                    { $eq: ['$sourceType', 'UnlockRequest'] },
                    { $eq: ['$ledgerType', 'allocation-credit'] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'wallets',
                localField: 'walletId',
                foreignField: '_id',
                as: 'wallet',
              },
            },
            { $unwind: '$wallet' },
            { $group: { _id: '$wallet.purpose', coins: { $sum: '$amount' } } },
          ],
          as: 'legs',
        },
      },
      { $unwind: '$legs' },
      { $group: { _id: '$legs._id', coins: { $sum: '$legs.coins' } } },
    ]).session(session)
    const bank = await BankTransaction.aggregate([
      { $match: { receivedAt: range } },
      { $group: { _id: '$matchStatus', count: { $sum: 1 }, amountVnd: { $sum: '$amountVnd' } } },
      { $sort: { _id: 1 } },
    ]).session(session)
    const topUps = await LedgerEntry.aggregate([
      { $match: { ledgerType: 'topup-credit', direction: 'credit', occurredAt: range } },
      { $group: { _id: null, coins: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).session(session)
    const balances = await Wallet.aggregate([
      {
        $group: {
          _id: '$purpose',
          balanceCoins: { $sum: '$availableBalance' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).session(session)
    const payouts = await WithdrawalRequest.aggregate([
      { $match: { evaluatedAt: range } },
      {
        $lookup: {
          from: 'payoutResultEntries',
          let: { withdrawalId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$withdrawalRequestId', '$$withdrawalId'] } } },
            { $sort: { occurredAt: -1, _id: -1 } },
            { $limit: 1 },
          ],
          as: 'latest',
        },
      },
      {
        $group: {
          _id: {
            result: { $ifNull: [{ $arrayElemAt: ['$latest.result', 0] }, 'Pending'] },
            mode: { $ifNull: [{ $arrayElemAt: ['$latest.executionMode', 0] }, 'legacy'] },
          },
          count: { $sum: 1 },
          coins: { $sum: '$amountCoins' },
        },
      },
    ]).session(session)
    const summary = {
      registeredAccounts: registrations.reduce((sum, row) => sum + row.count, 0),
      purchasedChapters: unlocks.reduce((sum, row) => sum + row.count, 0),
      unlockCoins: unlocks.reduce((sum, row) => sum + row.coins, 0),
      authorCoins: allocation.find(row => row._id === 'author-earnings')?.coins ?? 0,
      platformCoins: allocation.find(row => row._id === 'system-earnings')?.coins ?? 0,
      topUpCoins: topUps[0]?.coins ?? 0,
    }
    assertReportAmounts([
      ...Object.values(summary),
      ...bank.map(row => row.amountVnd),
      ...balances.map(row => row.balanceCoins),
      ...payouts.map(row => row.coins),
    ])
    return {
      from,
      to,
      groupBy,
      summary,
      registrations: registrations.map(row => ({ ...row._id, count: row.count })),
      bank: bank.map(row => ({ status: row._id, count: row.count, amountVnd: row.amountVnd })),
      balances: balances.map(row => ({
        purpose: row._id,
        count: row.count,
        balanceCoins: row.balanceCoins,
      })),
      payouts: payouts.map(row => ({ ...row._id, count: row.count, coins: row.coins })),
      unlocks: (all ? unlocks : unlocks.slice((page - 1) * 20, page * 20)).map(row => ({
        id: String(row._id ?? 'unknown'),
        label: row.label ?? '—',
        count: row.count,
        coins: row.coins,
      })),
      items: all
        ? unlocks.map(row => ({ label: row.label ?? '—', count: row.count, coins: row.coins }))
        : [],
      page,
      hasMore: page * 20 < unlocks.length,
      totalGroups: unlocks.length,
    }
  })
}
