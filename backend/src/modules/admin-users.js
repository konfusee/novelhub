import { Account, AuditEvent, Story, Wallet } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';

const literal = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const identity = {
  _id: 0,
  id: { $toString: '$_id' },
  name: '$displayName',
  email: { $cond: [{ $eq: ['$status', 'anonymized'] }, null, '$email'] },
  status: 1,
  createdAt: 1,
  roles: 1,
  storyCount: 1,
  readerBalance: { $ifNull: [{ $first: '$wallet.availableBalance' }, null] },
};
export async function adminUsers({ page, pageSize, query, role, status, sort }) {
  const filter = {
    ...(status !== 'all' ? { status } : {}),
    ...(role === 'reader' ? { roles: { $size: 0 } } : role !== 'all' ? { roles: role } : {}),
    ...(query
      ? {
          $or: [
            { displayName: { $regex: literal(query), $options: 'i' } },
            { email: { $regex: literal(query), $options: 'i' }, status: { $ne: 'anonymized' } },
            ...(/^[a-f\d]{24}$/i.test(query)
              ? [{ _id: new Account.base.Types.ObjectId(query) }]
              : []),
          ],
        }
      : {}),
  };
  const ordering = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    stories: { storyCount: -1, _id: -1 },
    coins: { 'wallet.availableBalance': -1, _id: -1 },
  }[sort];
  const [data] = await Account.aggregate([
    {
      $lookup: {
        from: 'roleAssignments',
        let: { id: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$accountId', '$$id'] }, status: 'active' } },
          { $project: { role: 1 } },
        ],
        as: 'assignments',
      },
    },
    { $set: { roles: { $cond: [{ $eq: ['$status', 'anonymized'] }, [], '$assignments.role'] } } },
    {
      $facet: {
        items: [
          { $match: filter },
          {
            $lookup: {
              from: 'stories',
              localField: '_id',
              foreignField: 'authorAccountId',
              pipeline: [{ $count: 'count' }],
              as: 'stories',
            },
          },
          { $set: { storyCount: { $ifNull: [{ $first: '$stories.count' }, 0] } } },
          {
            $lookup: {
              from: 'wallets',
              localField: '_id',
              foreignField: 'ownerId',
              pipeline: [
                { $match: { ownerType: 'account', purpose: 'reader-coins' } },
                { $project: { availableBalance: 1 } },
              ],
              as: 'wallet',
            },
          },
          { $sort: ordering },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          { $project: identity },
        ],
        total: [{ $match: filter }, { $count: 'count' }],
        summary: [
          {
            $group: {
              _id: null,
              accounts: { $sum: 1 },
              readers: { $sum: { $cond: [{ $eq: [{ $size: '$roles' }, 0] }, 1, 0] } },
              authors: { $sum: { $cond: [{ $in: ['author', '$roles'] }, 1, 0] } },
              moderators: { $sum: { $cond: [{ $in: ['moderator', '$roles'] }, 1, 0] } },
              admins: { $sum: { $cond: [{ $in: ['admin', '$roles'] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ]);
  const { _id: _ignored, ...summary } = data.summary[0] ?? {
    accounts: 0,
    readers: 0,
    authors: 0,
    moderators: 0,
    admins: 0,
  };
  void _ignored;
  return { items: data.items, total: data.total[0]?.count ?? 0, summary, page, pageSize };
}

export async function adminUserDetail(id) {
  const account = await Account.findById(id)
    .select('displayName email status createdAt emailVerifiedAt')
    .lean();
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản.');
  const [wallets, stories, audit] = await Promise.all([
    Wallet.find({ ownerType: 'account', ownerId: id }).select('purpose availableBalance').lean(),
    Story.find({ authorAccountId: id })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(5)
      .select('title publicationStatus')
      .lean(),
    AuditEvent.find({ targetType: { $in: ['Account', 'account'] }, targetId: id })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(10)
      .select('action result occurredAt')
      .lean(),
  ]);
  return {
    account: {
      id: String(account._id),
      name: account.displayName,
      email: account.status === 'anonymized' ? null : (account.email ?? null),
      createdAt: account.createdAt,
      emailVerified: Boolean(account.emailVerifiedAt),
    },
    wallets: wallets.map((wallet) => ({
      purpose: wallet.purpose,
      balance: wallet.availableBalance,
    })),
    stories: stories.map((story) => ({
      id: String(story._id),
      title: story.title,
      status: story.publicationStatus,
    })),
    audit: audit.map((item) => ({
      id: String(item._id),
      action: item.action,
      result: item.result,
      occurredAt: item.occurredAt,
    })),
  };
}
