import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { Account, AuditEvent, RoleAssignment } from '../../../models/index.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { runLifecycleHooks } from '../lifecycle.js'

export async function listActiveAuthors({ page, pageSize, query }) {
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const [result] = await RoleAssignment.aggregate([
    { $match: { role: 'author', status: 'active' } },
    { $lookup: { from: 'accounts', localField: 'accountId', foreignField: '_id', as: 'account' } },
    { $unwind: '$account' },
    {
      $match: {
        'account.status': { $in: ['active', 'suspended'] },
        ...(query
          ? {
              $or: [
                { 'account.displayName': { $regex: literal, $options: 'i' } },
                { 'account.email': { $regex: literal, $options: 'i' } },
              ],
            }
          : {}),
      },
    },
    { $sort: { grantedAt: -1, _id: -1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $project: {
              _id: 0,
              accountId: { $toString: '$account._id' },
              displayName: '$account.displayName',
              status: '$account.status',
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ])
  return { items: result.items, total: result.total[0]?.count ?? 0, page, pageSize }
}

export async function authorRoleView(accountId) {
  const account = await Account.findById(accountId).select('displayName status version').lean()
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản.')
  const role = await RoleAssignment.findOne({ accountId, role: 'author', status: 'active' }).lean()
  return {
    accountId: String(account._id),
    displayName: account.displayName,
    status: account.status,
    accountVersion: account.version,
    role: role ? { id: String(role._id), version: role.version } : null,
  }
}

export async function revokeAuthorRole(admin, accountId, input) {
  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        authorizationEpoch: admin.authorizationEpoch,
        credentialVersion: admin.credentialVersion,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    )
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!actor || !allowed)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    const target = await Account.findOneAndUpdate(
      {
        _id: accountId,
        version: input.expectedAccountVersion,
        status: { $in: ['active', 'suspended'] },
      },
      { $inc: { version: 1, authorizationEpoch: 1 } },
      { session, returnDocument: 'after' },
    )
    if (!target) throw new HttpError(409, 'account_changed', 'Tài khoản đã thay đổi. Hãy tải lại.')
    const role = await RoleAssignment.findOne({
      _id: input.roleId,
      accountId,
      role: 'author',
      status: 'active',
      version: input.expectedRoleVersion,
    }).session(session)
    if (!role) throw new HttpError(409, 'role_changed', 'Quyền tác giả đã thay đổi. Hãy tải lại.')
    const now = new Date()
    role.status = 'revoked'
    role.revokedAt = now
    await role.save({ session })
    const results = await runLifecycleHooks('onAuthorRoleRevoked', {
      accountId: target._id,
      actorAccountId: admin._id,
      session,
      now,
      reason: 'author-role-removed',
    })
    const { frozenStories, cancelledChapters, cancelledSubmissions } =
      results['authoring-publishing']
    await audit('author-role.revoked', 'Account', target, {
      roleId: role._id,
      frozenStories,
      cancelledChapters,
      cancelledSubmissions,
    })
    return {
      accountId: String(target._id),
      roleId: String(role._id),
      status: 'revoked',
      accountVersion: target.version,
      roleVersion: role.version,
      frozenStories,
      cancelledChapters,
      cancelledSubmissions,
    }

    async function audit(action, targetType, entity, data) {
      await AuditEvent.create(
        [
          {
            actorType: 'account',
            actorId: admin._id,
            action,
            targetType,
            targetId: entity._id,
            targetVersion: entity.version,
            result: 'accepted',
            reason: input.reason,
            occurredAt: now,
            dataDigest: digest(data),
          },
        ],
        { session },
      )
    }
  })
}
