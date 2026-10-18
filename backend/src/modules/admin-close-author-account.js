import {
  Account,
  AuditEvent,
  Chapter,
  EmailToken,
  ModerationHistory,
  PublicationSubmission,
  RoleAssignment,
  Session,
  Story,
  Wallet,
  WithdrawalRequest,
} from '../models/index.js'
import { withTransaction } from '../db/connection.js'
import { HttpError } from '../middleware/errors.js'
import { digest } from './submission-digests.js'

// Account closure never settles balances or creates financial records.
export async function closeAuthorAccount(admin, accountId, input) {
  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        authorizationEpoch: admin.authorizationEpoch,
        credentialVersion: admin.credentialVersion,
      },
      { $inc: { version: 1 } },
      { session },
    )
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!actor || !allowed)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    if (String(admin._id) === accountId)
      throw new HttpError(409, 'protected_account', 'Không thể tự đóng tài khoản.')
    const target = await Account.findById(accountId)
      .select('+password +bankDetails +retainedPayoutEmail +finalPayoutBankDetailsSnapshot')
      .session(session)
    if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản.')
    const staff = await RoleAssignment.exists({
      accountId,
      role: { $in: ['admin', 'moderator'] },
      status: 'active',
    }).session(session)
    if (!target.everAuthor || staff)
      throw new HttpError(
        409,
        'protected_account',
        'Chỉ đóng tài khoản Author không có quyền nhân viên.',
      )
    if (
      target.version !== input.expectedVersion ||
      !['active', 'suspended'].includes(target.status)
    )
      throw new HttpError(409, 'account_changed', 'Tài khoản đã thay đổi. Hãy tải lại.')
    const now = new Date()
    const stories = await Story.find({ authorAccountId: accountId }).session(session)
    const chapters = await Chapter.find({ storyId: { $in: stories.map(s => s._id) } }).session(
      session,
    )
    const published = [...stories, ...chapters].map(s => s.publishedRevisionId).filter(Boolean)
    for (const story of stories) {
      const from = story.publicationStatus
      story.authoringFrozen = true
      if (story.publishedRevisionId || ['submitted', 'under-review', 'approved'].includes(from))
        story.publicationStatus = 'unpublished'
      story.publicationTransition = {
        actorAccountId: admin._id,
        occurredAt: now,
        from,
        to: story.publicationStatus,
        result: 'account-deleted',
      }
      await story.save({ session })
    }
    for (const chapter of chapters) {
      if (
        !['draft', 'submitted', 'approved', 'scheduled', 'due', 'archived'].includes(
          chapter.status,
        ) ||
        chapter.publicationTransition?.result === 'author-draft-deleted'
      )
        continue
      const from = chapter.status
      chapter.status = 'cancelled'
      chapter.cancelledAt = now
      chapter.cancellationReason = 'account-deleted'
      chapter.publicationTransition = {
        actorAccountId: admin._id,
        occurredAt: now,
        from,
        to: 'cancelled',
        result: 'account-deleted',
      }
      await chapter.save({ session })
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
      submission.cancellationReason = 'account-deleted'
      if (submission.claimOwnerAccountId)
        submission.claimReleaseHistory.push({
          ownerAccountId: submission.claimOwnerAccountId,
          claimVersion: submission.claimVersion,
          expiresAt: submission.claimExpiresAt ?? null,
          releasedAt: now,
          reason: 'account-deleted',
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
            reason: 'account-deleted',
            actorAccountId: admin._id,
            actorAuthorizationEpoch: admin.authorizationEpoch,
            occurredAt: now,
            beforeStateDigest: digest({ status: before }),
            afterStateDigest: digest({ status: 'cancelled' }),
          },
        ],
        { session },
      )
    }
    const unsettledWallet = await Wallet.exists({
      ownerType: 'account',
      ownerId: accountId,
      availableBalance: { $gt: 0 },
    }).session(session)
    const pendingWithdrawal = await WithdrawalRequest.exists({
      accountId,
      status: 'pending',
    }).session(session)
    if (unsettledWallet || pendingWithdrawal)
      throw new HttpError(
        409,
        'financial_close_required',
        'Tài khoản còn số dư hoặc khoản chi trả chờ xử lý. Cần xử lý tài chính trước khi đóng tài khoản.',
      )
    target.status = 'anonymized'
    target.closedAt = now
    target.anonymizedAt = now
    target.displayName = 'Deleted user'
    target.profile = undefined
    target.preferences = undefined
    target.email = undefined
    target.password = undefined
    target.twoFactorEnabled = false
    target.credentialVersion++
    target.authorizationEpoch++
    await target.save({ session })
    await RoleAssignment.updateMany(
      { accountId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await Session.updateMany(
      { accountId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await EmailToken.updateMany(
      { accountId, usedAt: null, revokedAt: null },
      { $set: { revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'account.anonymized',
          targetType: 'Account',
          targetId: target._id,
          targetVersion: target.version,
          result: 'success',
          reason: input.reason,
          occurredAt: now,
          dataDigest: digest({
            stories: stories.length,
            cancelledSubmissions: submissions.length,
          }),
        },
      ],
      { session },
    )
    return {
      account: {
        id: String(target._id),
        status: target.status,
        version: target.version,
      },
    }
  })
}
