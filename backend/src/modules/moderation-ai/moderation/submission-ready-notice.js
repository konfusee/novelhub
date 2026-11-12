import {
  Account,
  ContentRevision,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../../../models/index.js'
import { notifyMany } from '../../accounts-administration/notifications.js'

export const SUBMISSION_READY_EVENT = 'moderation.submission-ready'

/**
 * Tells every active Moderator that a submission became claimable. Runs inside the transaction
 * that moved it to pending-review, so a rolled-back promotion leaves no notice; the per-recipient
 * source key keeps a repeated promotion from notifying twice.
 */
export async function notifyModeratorsSubmissionReady(submissionId, session) {
  const submission = await PublicationSubmission.findById(submissionId)
    .select('storyId chapterId revisionId authorAccountId')
    .session(session)
    .lean()
  if (!submission) return []
  const [moderatorIds, author] = await Promise.all([
    RoleAssignment.distinct('accountId', { role: 'moderator', status: 'active' }).session(session),
    Account.findById(submission.authorAccountId).select('status').session(session).lean(),
  ])
  // Inactive authors' submissions are hidden from the queue; announcing them would mislead.
  if (!moderatorIds.length || author?.status !== 'active') return []
  const [recipients, revision, story] = await Promise.all([
    Account.find({ _id: { $in: moderatorIds }, status: 'active' })
      .select('_id')
      .session(session)
      .lean(),
    ContentRevision.findById(submission.revisionId).select('content.title').session(session).lean(),
    submission.chapterId
      ? Story.findById(submission.storyId).select('title').session(session).lean()
      : null,
  ])
  const target = revision?.content?.title ?? ''
  const title = submission.chapterId && story?.title ? `${story.title} – ${target}` : target
  return notifyMany(
    recipients.map(({ _id }) => ({
      recipientAccountId: _id,
      sourceEventKey: `submission:${submissionId}:ready`,
      eventType: SUBMISSION_READY_EVENT,
      payload: {
        submissionId: String(submissionId),
        targetType: submission.chapterId ? 'chapter' : 'story',
        title,
      },
    })),
    { session },
  )
}
