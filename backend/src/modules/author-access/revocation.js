import { withTransaction } from '../../db/connection.js'
import { HttpError } from '../../middleware/errors.js'
import {
  Account,
  AuditEvent,
  Chapter,
  ModerationHistory,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../../models/index.js'
import { digest } from '../submission-digests.js'

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
    const stories = await Story.find({ authorAccountId: accountId }).session(session)
    const storyIds = stories.map(story => story._id)
    const chapters = await Chapter.find({ storyId: { $in: storyIds } }).session(session)
    const published = [...stories, ...chapters]
      .map(item => item.publishedRevisionId)
      .filter(Boolean)
    let cancelledChapters = 0
    for (const story of stories) {
      story.authoringFrozen = true
      story.publicationTransition = {
        actorAccountId: admin._id,
        occurredAt: now,
        from: story.publicationStatus,
        to: story.publicationStatus,
        result: 'author-role-removed',
      }
      await story.save({ session })
    }
    for (const chapter of chapters) {
      if (chapter.publicationTransition?.result === 'author-draft-deleted') continue
      if (
        !['draft', 'submitted', 'approved', 'scheduled', 'due', 'archived'].includes(chapter.status)
      )
        continue
      const from = chapter.status
      chapter.status = 'cancelled'
      chapter.cancelledAt = now
      chapter.cancellationReason = 'author-role-removed'
      chapter.publicationTransition = {
        actorAccountId: admin._id,
        occurredAt: now,
        from,
        to: 'cancelled',
        result: 'author-role-removed',
      }
      await chapter.save({ session })
      await audit('chapter.cancelled', 'Chapter', chapter, {
        from,
        revisionId: chapter.draftRevisionId ?? chapter.currentRevisionId,
      })
      cancelledChapters++
    }
    const submissions = await PublicationSubmission.find({
      authorAccountId: accountId,
      status: { $in: ['validated', 'pending-review', 'decision-pending', 'approved'] },
      revisionId: { $nin: published },
    }).session(session)
    for (const submission of submissions) {
      const before = submission.status
      submission.status = 'cancelled'
      submission.cancelledAt = now
      submission.cancellationReason = 'author-role-removed'
      if (submission.claimOwnerAccountId)
        submission.claimReleaseHistory.push({
          ownerAccountId: submission.claimOwnerAccountId,
          claimVersion: submission.claimVersion,
          expiresAt: submission.claimExpiresAt ?? null,
          releasedAt: now,
          reason: 'author-role-removed',
          actorAccountId: admin._id,
        })
      submission.claimOwnerAccountId = undefined
      submission.claimExpiresAt = undefined
      submission.claimVersion++
      await submission.save({ session })
      await ModerationHistory.create(
        [
          {
            aggregateType: 'PublicationSubmission',
            aggregateId: submission._id,
            submissionId: submission._id,
            revisionId: submission.revisionId,
            action: 'submission.cancelled',
            outcome: 'cancelled',
            reason: 'author-role-removed',
            actorAccountId: admin._id,
            actorAuthorizationEpoch: admin.authorizationEpoch,
            occurredAt: now,
            beforeStateDigest: digest({ status: before }),
            afterStateDigest: digest({ status: 'cancelled' }),
          },
        ],
        { session },
      )
      await audit('submission.cancelled', 'PublicationSubmission', submission, {
        from: before,
        revisionId: submission.revisionId,
      })
    }
    await audit('author-role.revoked', 'Account', target, {
      roleId: role._id,
      frozenStories: stories.length,
      cancelledChapters,
      cancelledSubmissions: submissions.length,
    })
    return {
      accountId: String(target._id),
      roleId: String(role._id),
      status: 'revoked',
      accountVersion: target.version,
      roleVersion: role.version,
      frozenStories: stories.length,
      cancelledChapters,
      cancelledSubmissions: submissions.length,
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
