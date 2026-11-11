import { notifyMany } from '../../accounts-administration/notifications.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  AuditEvent,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  PublicationSubmission,
  Story,
} from '../../../models/index.js'
import { createEditableRevision } from '../../authoring-publishing/author/author-submissions.js'
import { terminalEvidenceReady } from '../review-evidence.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { lockModerator, lockSubmissionAuthor } from './moderator-access.js'

const submissionChanged = () =>
  new HttpError(409, 'submission_changed', 'Hồ sơ đã thay đổi. Hãy tải lại.')

/**
 * Applies a moderator's approve or reject decision to a claimed submission in one transaction:
 * content state, claim release, history, audit and the author's in-app notification.
 */
export async function decideSubmission(
  account,
  submissionId,
  input,
  { correlationId, now = new Date() } = {},
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const submission = await PublicationSubmission.findById(submissionId).session(session)
    if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.')
    if (['approved', 'superseded', 'rejected', 'cancelled'].includes(submission.status))
      throw submissionChanged()
    if (
      submission.status !== 'decision-pending' ||
      String(submission.claimOwnerAccountId) !== String(account._id) ||
      !(submission.claimExpiresAt > now)
    )
      throw new HttpError(409, 'claim_required', 'Bạn cần giữ claim còn hạn của hồ sơ này.')
    if (submission.version !== input.expectedVersion) throw submissionChanged()

    const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
      .session(session)
      .lean()
    if (
      String(submission.currentEvidenceBatchId) !== input.evidenceBatchId ||
      !batch ||
      batch.version !== input.evidenceBatchVersion ||
      !terminalEvidenceReady(batch) ||
      batch.packageDigest !== submission.packageDigest ||
      String(batch.submissionId) !== String(submission._id)
    )
      throw new HttpError(409, 'evidence_changed', 'Bằng chứng AI đã thay đổi. Hãy tải lại.')

    const author = await lockSubmissionAuthor(submission.authorAccountId, session)

    const story = await Story.findOne({
      _id: submission.storyId,
      authorAccountId: submission.authorAccountId,
    }).session(session)
    const target = submission.chapterId
      ? await Chapter.findOne({ _id: submission.chapterId, storyId: submission.storyId }).session(
          session,
        )
      : story
    const revision = await ContentRevision.findOne({
      _id: submission.revisionId,
      storyId: submission.storyId,
      chapterId: submission.chapterId ?? null,
      status: 'submitted',
      immutableAt: { $ne: null },
    }).session(session)
    if (
      !story ||
      !target ||
      !revision ||
      revision.packageDigest !== submission.packageDigest ||
      String(target.draftRevisionId ?? target.currentRevisionId) !== String(revision._id)
    )
      throw new HttpError(409, 'content_changed', 'Nội dung đã chuyển sang phiên bản khác.')

    const outcome = input.decision === 'approve' ? 'approved' : 'rejected'
    if (outcome === 'approved') {
      revision.status = 'approved'
      await revision.save({ session })
      if (submission.chapterId) {
        if (target.status !== 'published') target.status = 'approved'
        await target.save({ session })
      } else {
        story.authoringFrozen = false
        if (!['published', 'unpublished'].includes(story.publicationStatus))
          story.publicationStatus = 'approved'
        await story.save({ session })
      }
    } else {
      revision.status = 'rejected'
      await revision.save({ session })
      const draft = await createEditableRevision({
        current: revision,
        storyId: story._id,
        chapterId: submission.chapterId ?? null,
        authorAccountId: submission.authorAccountId,
        session,
      })
      target.draftRevisionId = draft._id
      target.currentRevisionId = draft._id
      if (submission.chapterId) {
        if (target.status !== 'published') target.status = 'draft'
        await target.save({ session })
      } else {
        // A freeze from author-role removal or account deletion outlives the review.
        if (
          !['author-role-removed', 'account-deleted'].includes(story.publicationTransition?.result)
        )
          story.authoringFrozen = false
        if (story.publicationStatus !== 'published')
          story.publicationStatus = story.publishedRevisionId ? 'unpublished' : 'draft'
        await story.save({ session })
      }
    }

    submission.claimReleaseHistory.push({
      ownerAccountId: submission.claimOwnerAccountId,
      claimVersion: submission.claimVersion,
      expiresAt: submission.claimExpiresAt,
      releasedAt: now,
      reason: 'decided',
      actorAccountId: account._id,
    })
    submission.claimOwnerAccountId = undefined
    submission.claimExpiresAt = undefined
    submission.claimVersion += 1
    submission.status = outcome
    submission.decisionSummary = input.feedback || undefined
    await submission.save({ session })

    await ModerationHistory.create(
      [
        {
          aggregateType: submission.chapterId ? 'chapter' : 'story',
          aggregateId: target._id,
          action: 'manual-review.decided',
          outcome,
          submissionId: submission._id,
          revisionId: revision._id,
          evidenceBatchId: batch._id,
          evidenceBatchVersion: batch.version,
          actorAccountId: account._id,
          actorAuthorizationEpoch: account.authorizationEpoch,
          reason: input.feedback || undefined,
          feedback: input.feedback || undefined,
          beforeStateDigest: submission.packageDigest,
          afterStateDigest: digest({
            outcome,
            revisionId: String(revision._id),
            evidenceBatchVersion: batch.version,
          }),
          occurredAt: now,
          correlationId,
        },
      ],
      { session },
    )
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'publication.decided',
          targetType: 'PublicationSubmission',
          targetId: submission._id,
          targetVersion: submission.version,
          result: outcome,
          reason: input.feedback || undefined,
          occurredAt: now,
          correlationId,
          dataDigest: submission.packageDigest,
        },
      ],
      { session },
    )
    await notifyMany(
      [
        {
          recipientAccountId: author._id,
          eventType: 'publication.decided',
          sourceEventKey: `publication-submission:${submission._id}:decided`,
          payload: {
            submissionId: String(submission._id),
            storyId: String(submission.storyId),
            chapterId: submission.chapterId ? String(submission.chapterId) : null,
            title: revision.content?.title ?? '',
            outcome,
            feedback: input.feedback ?? '',
          },
          deliveryState: 'available',
        },
      ],
      { session },
    )
    return {
      id: String(submission._id),
      version: submission.version,
      status: outcome,
      decisionSummary: submission.decisionSummary ?? '',
    }
  })
}
