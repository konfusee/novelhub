import {
  Account,
  AuthorRevenueRate,
  PolicyVersion,
  RoleAssignment,
  AuditEvent,
} from '../models/index.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';
import { digest } from './submission-digests.js';

/** A current view only: future rates never replace the rate effective today. */
export async function authorAgreement(accountId, now = new Date()) {
  const account = await Account.findOne({
    _id: accountId,
    everAuthor: true,
    status: { $ne: 'anonymized' },
  })
    .select('displayName status version')
    .lean();
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tác giả.');
  const [rate, policy, history, role, latest] = await Promise.all([
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
    RoleAssignment.exists({ accountId, role: 'author', status: 'active' }),
    AuthorRevenueRate.findOne({ authorAccountId: accountId })
      .sort({ createdAt: -1, _id: -1 })
      .select('_id')
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
    accountVersion: account.version,
    latestRateId: latest ? String(latest._id) : null,
    canEdit: Boolean(role && ['active', 'suspended'].includes(account.status)),
  };
}

/** Append a new immediate agreement; existing rates and allocations remain immutable. */
export async function saveAuthorAgreement(admin, accountId, input) {
  return withTransaction(async (session) => {
    const self = String(admin._id) === String(accountId);
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        authorizationEpoch: admin.authorizationEpoch,
        credentialVersion: admin.credentialVersion,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    );
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session);
    if (!actor || !allowed)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.');
    const account = await Account.findOneAndUpdate(
      {
        _id: accountId,
        everAuthor: true,
        version: input.expectedAccountVersion + (self ? 1 : 0),
        status: { $in: ['active', 'suspended'] },
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!account)
      throw new HttpError(409, 'account_changed', 'Tài khoản đã thay đổi. Hãy tải lại.');
    const authorRole = await RoleAssignment.exists({
      accountId,
      role: 'author',
      status: 'active',
    }).session(session);
    if (!authorRole)
      throw new HttpError(409, 'role_changed', 'Quyền tác giả đã thay đổi. Hãy tải lại.');
    const latest = await AuthorRevenueRate.findOne({ authorAccountId: accountId })
      .sort({ createdAt: -1, _id: -1 })
      .session(session);
    if ((latest ? String(latest._id) : null) !== input.expectedLatestRateId)
      throw new HttpError(409, 'agreement_changed', 'Thỏa thuận đã thay đổi. Hãy tải lại.');
    // A server timestamp prevents backdating and changes to already recorded earnings.
    const effectiveAt = new Date();
    const [rate] = await AuthorRevenueRate.create(
      [
        {
          authorAccountId: accountId,
          percentage: input.percentage,
          actorAccountId: admin._id,
          effectiveAt,
        },
      ],
      { session },
    );
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'author-agreement.created',
          targetType: 'account',
          targetId: account._id,
          targetVersion: account.version,
          result: 'accepted',
          reason: input.reason,
          occurredAt: effectiveAt,
          dataDigest: digest({
            rateId: String(rate._id),
            percentage: rate.percentage,
            effectiveAt: effectiveAt.toISOString(),
            previousRateId: input.expectedLatestRateId,
          }),
        },
      ],
      { session },
    );
    return {
      authorId: String(account._id),
      rate: { id: String(rate._id), percentage: rate.percentage, effectiveAt },
    };
  });
}
