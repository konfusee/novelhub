import {
  AuditEvent,
  Chapter,
  ModerationHistory,
  PublicationSubmission,
  Story,
} from '../../models/index.js'
import { digest } from './submissions/submission-digests.js'

/** Runs only inside Accounts' transaction. Published revisions remain immutable. */
export async function cancelAuthorWork({ accountId, actorAccountId, session, now, reason }) {
  const deleted = reason === 'account-deleted'
  const stories = await Story.find({ authorAccountId: accountId }).session(session)
  const chapters = await Chapter.find({
    storyId: { $in: stories.map(story => story._id) },
  }).session(session)
  const published = [...stories, ...chapters].map(item => item.publishedRevisionId).filter(Boolean)
  let cancelledChapters = 0
  for (const story of stories) {
    const from = story.publicationStatus
    story.authoringFrozen = true
    if (
      deleted &&
      (story.publishedRevisionId || ['submitted', 'under-review', 'approved'].includes(from))
    )
      story.publicationStatus = 'unpublished'
    story.publicationTransition = {
      actorAccountId,
      occurredAt: now,
      from,
      to: story.publicationStatus,
      result: reason,
    }
    await story.save({ session })
  }
  for (const chapter of chapters) {
    if (
      chapter.publicationTransition?.result === 'author-draft-deleted' ||
      !['draft', 'submitted', 'approved', 'scheduled', 'due', 'archived'].includes(chapter.status)
    )
      continue
    const from = chapter.status
    chapter.status = 'cancelled'
    chapter.cancelledAt = now
    chapter.cancellationReason = reason
    chapter.publicationTransition = {
      actorAccountId,
      occurredAt: now,
      from,
      to: 'cancelled',
      result: reason,
    }
    await chapter.save({ session })
    await audit('chapter.cancelled', 'Chapter', chapter)
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
    submission.cancellationReason = reason
    if (submission.claimOwnerAccountId)
      submission.claimReleaseHistory.push({
        ownerAccountId: submission.claimOwnerAccountId,
        claimVersion: submission.claimVersion,
        expiresAt: submission.claimExpiresAt ?? null,
        releasedAt: now,
        reason,
        actorAccountId,
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
          reason,
          actorAccountId,
          occurredAt: now,
          beforeStateDigest: digest({ status: before }),
          afterStateDigest: digest({ status: 'cancelled' }),
        },
      ],
      { session },
    )
    await audit('submission.cancelled', 'PublicationSubmission', submission)
  }
  return {
    frozenStories: stories.length,
    cancelledChapters,
    cancelledSubmissions: submissions.length,
  }

  async function audit(action, targetType, entity) {
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: actorAccountId,
          action,
          targetType,
          targetId: entity._id,
          targetVersion: entity.version,
          result: 'accepted',
          reason,
          occurredAt: now,
        },
      ],
      { session },
    )
  }
}
