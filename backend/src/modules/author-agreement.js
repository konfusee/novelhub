import { Account, AuthorRevenueRate, PolicyVersion } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';

/** A current view only: future rates never replace the rate effective today. */
export async function authorAgreement(accountId, now = new Date()) {
  const account = await Account.findOne({
    _id: accountId,
    everAuthor: true,
    status: { $ne: 'anonymized' },
  })
    .select('displayName status')
    .lean();
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tác giả.');
  const [rate, policy, history] = await Promise.all([
    AuthorRevenueRate.findOne({ authorAccountId: accountId, effectiveAt: { $lte: now } })
      .sort({ effectiveAt: -1, _id: -1 })
      .select('percentage effectiveAt')
      .lean(),
    PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
      .sort({ effectiveAt: -1, _id: -1 })
      .select('authorSharePercent effectiveAt')
      .lean(),
    AuthorRevenueRate.find({ authorAccountId: accountId })
      .sort({ effectiveAt: -1, _id: -1 })
      .limit(20)
      .select('percentage effectiveAt')
      .lean(),
  ]);
  const authorShare = rate?.percentage ?? policy?.authorSharePercent ?? 70;
  return {
    author: { id: String(account._id), name: account.displayName, status: account.status },
    authorShare,
    platformShare: 100 - authorShare,
    source: rate ? 'agreement' : policy ? 'policy' : 'default',
    effectiveAt: rate?.effectiveAt ?? policy?.effectiveAt ?? null,
    history: history.map((item) => ({
      id: String(item._id),
      percentage: item.percentage,
      effectiveAt: item.effectiveAt,
      scheduled: item.effectiveAt > now,
    })),
    historyLimit: 20,
  };
}
