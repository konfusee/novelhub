import { notifyMany } from '../../accounts-administration/notifications.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  AuditEvent,
  Chapter,
  Comment,
  ContentReport,
  ModerationHistory,
  ReportResolution,
  Story,
} from '../../../models/index.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { lockModerator } from './moderator-access.js'
import {
  ACTIVE_REPORT_STATUSES,
  REPORT_ACTIONS,
  claimRequired,
  ownsLiveClaim,
  reportChanged,
  reportRow,
} from './report-queue.js'

const OUTCOMES = {
  dismiss: 'dismissed',
  'hide-comment': 'hidden',
  'unpublish-chapter': 'unpublished',
  'unpublish-story': 'unpublished',
  'warn-author': 'warned',
}
const transition = (account, now) => ({
  actorAccountId: account._id,
  occurredAt: now,
  from: 'published',
  to: 'unpublished',
  result: 'moderator-report-unpublished',
})

/** Story id behind any report target (comments resolve through their own target). */
async function reportStoryId(report, session) {
  if (report.targetType === 'story') return report.targetId
  if (report.targetType === 'chapter')
    return (await Chapter.findById(report.targetId).select('storyId').session(session).lean())
      ?.storyId
  const comment = await Comment.findById(report.targetId)
    .select('targetType targetId')
    .session(session)
    .lean()
  if (!comment) return null
  if (comment.targetType === 'story') return comment.targetId
  return (await Chapter.findById(comment.targetId).select('storyId').session(session).lean())
    ?.storyId
}

/**
 * Applies the content action; already-unavailable content is left untouched.
 * Returns the notifications owed to the content's people besides the reporter.
 */
async function applyAction(report, action, input, account, session, now) {
  const notices = []
  const storyId = await reportStoryId(report, session)
  const story = storyId ? await Story.findById(storyId).session(session) : null
  const snapshot = report.targetSnapshot ?? {}
  const chapterId = report.targetType === 'chapter' ? String(report.targetId) : null
  const authorNotice = eventType =>
    story &&
    notices.push({
      recipientAccountId: story.authorAccountId,
      role: 'author',
      eventType,
      payload: {
        storyId: String(story._id),
        chapterId,
        title: snapshot.title ?? '',
        reason: input.reason,
      },
    })
  let changed = false
  if (action === 'hide-comment') {
    const comment = await Comment.findById(report.targetId).session(session)
    if (comment?.status === 'visible') {
      changed = true
      comment.status = 'hidden'
      await comment.save({ session })
      notices.push({
        recipientAccountId: comment.authorAccountId,
        role: 'commenter',
        eventType: 'comment.hidden',
        payload: {
          storyId: storyId ? String(storyId) : null,
          chapterId: comment.targetType === 'chapter' ? String(comment.targetId) : null,
          title: 'Bình luận của bạn đã bị ẩn',
          reason: input.reason,
        },
      })
    }
  } else if (action === 'unpublish-chapter') {
    const chapter = await Chapter.findById(report.targetId).session(session)
    if (chapter?.status === 'published') {
      chapter.status = 'unpublished'
      chapter.publicationTransition = transition(account, now)
      await chapter.save({ session })
      changed = true
      authorNotice('author.content-unpublished')
    }
  } else if (action === 'unpublish-story') {
    if (story?.publicationStatus === 'published') {
      story.publicationStatus = 'unpublished'
      story.publicationTransition = {
        ...transition(account, now),
        revisionId: story.publishedRevisionId ? String(story.publishedRevisionId) : undefined,
      }
      await story.save({ session })
      changed = true
      authorNotice('author.content-unpublished')
    }
  } else if (action === 'warn-author') {
    changed = Boolean(story)
    authorNotice('author.content-warning')
  }
  return { changed, notices }
}

/** Resolves a claimed report in one transaction: content action, history, audit, notifications. */
export async function resolveReport(
  account,
  reportId,
  input,
  { correlationId, now = new Date() } = {},
) {
  const report = await withTransaction(async session => {
    await lockModerator(account, session)
    const report = await ContentReport.findById(reportId).session(session)
    if (!report) throw new HttpError(404, 'not_found', 'Không tìm thấy báo cáo.')
    if (!ACTIVE_REPORT_STATUSES.includes(report.status)) throw reportChanged()
    if (!REPORT_ACTIONS[report.targetType].includes(input.action))
      throw new HttpError(400, 'invalid_action', 'Hành động không áp dụng cho loại nội dung này.')
    if (!ownsLiveClaim(report, account, now)) throw claimRequired()
    if (report.version !== input.expectedVersion) throw reportChanged()

    const outcome = OUTCOMES[input.action]
    const contentAction = ['hide-comment', 'unpublish-chapter', 'unpublish-story'].includes(
      input.action,
    )
      ? input.action
      : 'none'
    const { changed, notices } =
      input.action === 'dismiss'
        ? { changed: false, notices: [] }
        : await applyAction(report, input.action, input, account, session, now)

    const [history] = await ModerationHistory.create(
      [
        {
          aggregateType: 'ContentReport',
          aggregateId: report._id,
          action: 'report.resolved',
          outcome,
          revisionId: report.targetRevisionId,
          actorAccountId: account._id,
          actorAuthorizationEpoch: account.authorizationEpoch,
          reason: input.reason,
          beforeStateDigest: report.targetHash,
          afterStateDigest: digest({ outcome, contentAction, changed }),
          occurredAt: now,
          correlationId,
        },
      ],
      { session },
    )
    const [resolution] = await ReportResolution.create(
      [
        {
          reportId: report._id,
          moderatorAccountId: account._id,
          outcome,
          contentAction,
          reason: input.reason,
          targetSnapshot: report.targetSnapshot,
          targetHash: report.targetHash,
          resolvedAt: now,
          historyId: history._id,
        },
      ],
      { session },
    )
    report.claimReleaseHistory.push({
      ownerAccountId: report.claimOwnerAccountId,
      claimVersion: report.claimVersion,
      expiresAt: report.claimExpiresAt,
      releasedAt: now,
      reason: 'resolved',
      actorAccountId: account._id,
    })
    report.status = input.action === 'dismiss' ? 'dismissed' : 'actioned'
    report.resolvedAt = now
    report.resolutionId = resolution._id
    report.claimOwnerAccountId = undefined
    report.claimExpiresAt = undefined
    report.claimVersion += 1
    await report.save({ session })

    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'report.resolved',
          targetType: 'ContentReport',
          targetId: report._id,
          targetVersion: report.version,
          result: outcome,
          reason: input.reason,
          occurredAt: now,
          correlationId,
          dataDigest: report.targetHash,
        },
      ],
      { session },
    )
    await notifyMany(
      [
        ...notices.map(({ role, ...notice }) => ({
          ...notice,
          sourceEventKey: `content-report:${report._id}:${role}`,
          deliveryState: 'available',
        })),
        {
          recipientAccountId: report.reporterAccountId,
          eventType: 'report.resolved',
          sourceEventKey: `content-report:${report._id}:reporter`,
          payload: {
            title: report.targetSnapshot?.title || 'Bình luận bạn đã báo cáo',
            outcome,
          },
          deliveryState: 'available',
        },
      ],
      { session, ordered: true },
    )
    return report
  })
  return reportRow(report.toObject(), account, now)
}
