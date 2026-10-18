import { LedgerEntry, Story, Wallet } from '../models/index.js';
import { authorEarningsPeriod } from './author-earnings-period.js';
import { currentAuthorAgreement } from './author-agreement.js';
import { authorChapterSales } from './author-chapter-sales.js';

export async function authorEarnings(accountId, period = 'month', now = new Date()) {
  const { start, labels } = authorEarningsPeriod(period, now);
  const [wallet, stories, agreement] = await Promise.all([
    Wallet.findOne({ ownerType: 'account', ownerId: accountId, purpose: 'author-earnings' })
      .select('availableBalance')
      .lean(),
    Story.find({ authorAccountId: accountId }).sort({ updatedAt: -1 }).select('title').lean(),
    currentAuthorAgreement(accountId, now),
  ]);
  const credits = wallet
    ? await LedgerEntry.aggregate([
        {
          $match: {
            walletId: wallet._id,
            ledgerType: 'allocation-credit',
            direction: 'credit',
            occurredAt: { $gte: start, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                date: '$occurredAt',
                format: '%Y-%m-%d',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
            amount: { $sum: '$amount' },
          },
        },
      ])
    : [];
  const bars = labels.map((day) => credits.find((item) => item._id === day)?.amount ?? 0);
  const allocationCredits = bars.reduce((sum, value) => sum + value, 0);
  const sales = await authorChapterSales(accountId, wallet?._id, start, now);
  const salesCoverageIncomplete = sales.linkedCoins !== allocationCredits;
  return {
    balance: String(wallet?.availableBalance ?? 0),
    allocationCredits,
    bars,
    labels,
    stories: stories.map((story) => ({ id: String(story._id), title: story.title })),
    buyers: salesCoverageIncomplete ? null : sales.buyers,
    subscriptions: null,
    sales: sales.sales,
    salesHasMore: sales.salesHasMore,
    salesCoverageIncomplete,
    payout: null,
    creatorShare: null,
    pricing: null,
    agreement,
  };
}
