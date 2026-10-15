import { LedgerEntry, Story, Wallet } from '../models/index.js';

export async function authorEarnings(accountId, period = 'month', now = new Date()) {
  const shifted = new Date(now.getTime() + 7 * 3600000);
  const today = shifted.toISOString().slice(0, 10);
  const dayStart = Date.parse(`${today}T00:00:00Z`);
  const startDay =
    period === 'day'
      ? dayStart
      : period === 'week'
        ? dayStart - ((shifted.getUTCDay() + 6) % 7) * 86400000
        : Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  const labels = Array.from(
    { length: Math.round((dayStart - startDay) / 86400000) + 1 },
    (_, index) => new Date(startDay + index * 86400000).toISOString().slice(0, 10),
  );
  const [wallet, stories] = await Promise.all([
    Wallet.findOne({ ownerType: 'account', ownerId: accountId, purpose: 'author-earnings' })
      .select('availableBalance')
      .lean(),
    Story.find({ authorAccountId: accountId }).sort({ updatedAt: -1 }).select('title').lean(),
  ]);
  const credits = wallet
    ? await LedgerEntry.aggregate([
        {
          $match: {
            walletId: wallet._id,
            ledgerType: 'allocation-credit',
            direction: 'credit',
            occurredAt: { $gte: new Date(startDay - 7 * 3600000), $lte: now },
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
  return {
    balance: String(wallet?.availableBalance ?? 0),
    allocationCredits: bars.reduce((sum, value) => sum + value, 0),
    bars,
    labels,
    stories: stories.map((story) => ({ id: String(story._id), title: story.title })),
    buyers: null,
    subscriptions: null,
    sales: null,
    payout: null,
    creatorShare: null,
    pricing: null,
  };
}
