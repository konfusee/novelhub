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
import { endClaim, requireLiveClaim } from './claim-lease.js'
import { lockModerator, lockSubmissionAuthor, submissionChanged } from './moderator-access.js'

/**
 * Applies a moderator's approve or reject decision to a claimed submission in one transaction:
 * content state, claim release, history, audit and the author's in-app notification.
 * The checks follow UC-MOD-04 step 4: role, author, submission version, live claim, reviewed
 * revision, evidence batch and the draft pointer; any change other than the claim is
 * submission_changed (SYS-MSG-PUB-06).
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
    const author = await lockSubmissionAuthor(submission.authorAccountId, session)
    if (
      submission.version !== input.expectedVersion ||
      !['pending-review', 'decision-pending'].includes(submission.status)
    )
      throw submissionChanged()
    requireLiveClaim(submission, account, input.claimToken, now)

    const revision = await ContentRevision.findOne({
      _id: submission.revisionId,
      storyId: submission.storyId,
      chapterId: submission.chapterId ?? null,
      status: 'submitted',
      immutableAt: { $ne: null },
    }).session(session)
    if (
      !revision ||
      String(revision._id) !== input.revisionId ||
      revision.version !== input.revisionVersion ||
      revision.packageDigest !== submission.packageDigest
    )
      throw submissionChanged()

    const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
      .session(session)
      .lean()
    if (
      !batch ||
      String(batch._id) !== input.evidenceBatchId ||
      batch.version !== input.evidenceVersion ||
      !terminalEvidenceReady(batch) ||
      String(batch.submissionId) !== String(submission._id) ||
      String(batch.revisionId) !== String(revision._id) ||
      batch.packageDigest !== submission.packageDigest
    )
      throw submissionChanged()

    const story = await Story.findOne({
      _id: submission.storyId,
      authorAccountId: submission.authorAccountId,
    }).session(session)
    const target = submission.chapterId
      ? await Chapter.findOne({ _id: submission.chapterId, storyId: submission.storyId }).session(
          session,
        )
      : story
    if (
      !story ||
      !target ||
      String(target.draftRevisionId ?? target.currentRevisionId) !== String(revision._id)
    )
      throw submissionChanged()

    const outcome = input.outcome === 'approve' ? 'approved' : 'rejected'
    let draftRevisionId = null
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
      draftRevisionId = draft._id
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

    const claimAcquiredAt = submission.claimAcquiredAt
    endClaim(submission, 'decided', account._id, now)
    submission.status = outcome
    submission.decisionSummary = input.feedback || undefined
    await submission.save({ session })

    const [history] = await ModerationHistory.create(
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
          claimAcquiredAt,
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
      submissionId: String(submission._id),
      status: outcome,
      decidedAt: now,
      revisionId: String(revision._id),
      draftRevisionId: draftRevisionId ? String(draftRevisionId) : null,
      historyId: String(history._id),
      messageId: outcome === 'approved' ? 'SYS-MSG-PUB-07' : 'SYS-MSG-PUB-08',
    }
  })
}
