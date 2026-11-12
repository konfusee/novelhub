import { notifyMany } from '../../accounts-administration/notifications.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  AuditEvent,
  Chapter,
  ContentReport,
  ModerationHistory,
  ReportResolution,
  Story,
} from '../../../models/index.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { endClaim, requireLiveClaim } from './claim-lease.js'
import { lockModerator } from './moderator-access.js'
import { ACTIVE_REPORT_STATUSES, reportChanged } from './report-queue.js'
import {
  ALLOWED_REPORT_ACTIONS,
  RESTRICTING_ACTIONS,
  actionTarget,
  restrictTarget,
} from './report-targets.js'

/** ResolutionOutcome recorded for each ReportAction. */
const OUTCOMES = {
  dismiss: 'dismissed',
  'hide-comment': 'comment-hidden',
  'unpublish-chapter': 'chapter-unpublished',
  'unpublish-story': 'story-unpublished',
  'warn-author': 'author-warned',
}

/**
 * Applies the action (SDS ReportResolutionService.applyAction). Dismiss and Warn Author never
 * write content; a restricting action changes content only when the target still exists and is
 * not already restricted (UC-MOD-06 AF1-AF3). Returns whether content changed and the
 * notifications owed to the commenter or author besides the reporter.
 */
async function applyAction(report, input, account, session, now) {
  const unchanged = { contentChanged: false, notices: [] }
  if (input.action === 'dismiss') return unchanged
  const target = await actionTarget(report, input.action, session)
  if (!target) return unchanged
  const contentChanged = RESTRICTING_ACTIONS.includes(input.action)
    ? await restrictTarget(target, input.action, account, now, session)
    : false
  // Warn Author always notifies; a restriction notifies only when it changed the content.
  if (input.action !== 'warn-author' && !contentChanged) return unchanged
  if (input.action === 'hide-comment') {
    const storyId =
      target.targetType === 'story'
        ? target.targetId
        : (await Chapter.findById(target.targetId).select('storyId').session(session).lean())
            ?.storyId
    return {
      contentChanged,
      notices: [
        {
          recipientAccountId: target.authorAccountId,
          role: 'commenter',
          eventType: 'comment.hidden',
          payload: {
            storyId: storyId ? String(storyId) : null,
            chapterId: target.targetType === 'chapter' ? String(target.targetId) : null,
            title: 'Bình luận của bạn đã bị ẩn',
            reason: input.reason,
          },
        },
      ],
    }
  }
  const story =
    input.action === 'unpublish-chapter'
      ? await Story.findById(target.storyId).select('authorAccountId').session(session).lean()
      : target
  if (!story) return { contentChanged, notices: [] }
  return {
    contentChanged,
    notices: [
      {
        recipientAccountId: story.authorAccountId,
        role: 'author',
        eventType:
          input.action === 'warn-author' ? 'author.content-warning' : 'author.content-unpublished',
        payload: {
          storyId: String(story._id),
          chapterId: report.targetType === 'chapter' ? String(report.targetId) : null,
          title: report.targetSnapshot?.title ?? '',
          reason: input.reason,
        },
      },
    ],
  }
}

/**
 * Resolves a claimed report in one transaction (UC-MOD-06): content action, resolution with
 * contentChanged, report state, claim release, history, audit and notifications.
 */
export async function resolveReport(
  account,
  reportId,
  input,
  { correlationId, now = new Date() } = {},
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const report = await ContentReport.findById(reportId).session(session)
    if (!report) throw new HttpError(404, 'not_found', 'Không tìm thấy báo cáo.')
    requireLiveClaim(report, account, input.claimToken, now)
    if (
      report.version !== input.expectedVersion ||
      !ACTIVE_REPORT_STATUSES.includes(report.status) ||
      !ALLOWED_REPORT_ACTIONS[report.targetType].includes(input.action)
    )
      throw reportChanged()

    const outcome = OUTCOMES[input.action]
    const { contentChanged, notices } = await applyAction(report, input, account, session, now)

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
          claimAcquiredAt: report.claimAcquiredAt,
          reason: input.reason,
          beforeStateDigest: report.targetHash,
          afterStateDigest: digest({ outcome, action: input.action, contentChanged }),
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
          contentAction: input.action,
          contentChanged,
          reason: input.reason,
          targetSnapshot: report.targetSnapshot,
          targetHash: report.targetHash,
          resolvedAt: now,
          historyId: history._id,
        },
      ],
      { session },
    )
    endClaim(report, 'resolved', account._id, now)
    report.status = input.action === 'dismiss' ? 'dismissed' : 'actioned'
    report.resolvedAt = now
    report.resolutionId = resolution._id
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
    return {
      reportId: String(report._id),
      status: 'resolved',
      action: input.action,
      outcome,
      contentChanged,
      resolvedAt: now,
      historyId: String(history._id),
      messageId: 'SYS-MSG-RPT-02',
    }
  })
}
