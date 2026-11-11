import { policy } from '../../accounts-administration/service.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  Chapter,
  Comment,
  ContentReport,
  ReportResolution,
  Story,
} from '../../../models/index.js'
import { publicName } from '../../reading-community/community/common.js'
import { lockModerator } from './moderator-access.js'

export const REPORT_PAGE_SIZE = 20
export const ACTIVE_REPORT_STATUSES = ['open', 'under-review']
export const RESOLVED_REPORT_STATUSES = ['dismissed', 'actioned', 'closed']
export const REPORT_ACTIONS = {
  comment: ['dismiss', 'hide-comment'],
  chapter: ['dismiss', 'unpublish-chapter', 'unpublish-story', 'warn-author'],
  story: ['dismiss', 'unpublish-story', 'warn-author'],
}

const liveClaim = (report, now) =>
  report.status === 'under-review' && report.claimOwnerAccountId && report.claimExpiresAt > now
export const ownsLiveClaim = (report, account, now) =>
  liveClaim(report, now) && String(report.claimOwnerAccountId) === String(account._id)

/** Reports a moderator can take now: open, or under review with an expired claim. */
export const claimableReportFilter = now => ({
  $or: [{ status: 'open' }, { status: 'under-review', claimExpiresAt: { $lte: now } }],
})
const tabFilters = (account, now) => ({
  // Everything still unresolved except my own live claims; others' live claims show as claimed.
  open: {
    $or: [
      { status: 'open' },
      {
        status: 'under-review',
        $or: [{ claimOwnerAccountId: { $ne: account._id } }, { claimExpiresAt: { $lte: now } }],
      },
    ],
  },
  mine: { status: 'under-review', claimOwnerAccountId: account._id, claimExpiresAt: { $gt: now } },
  resolved: { status: { $in: RESOLVED_REPORT_STATUSES } },
})

export const reportChanged = () =>
  new HttpError(409, 'report_changed', 'Báo cáo đã thay đổi. Hãy tải lại.')
export const claimRequired = () =>
  new HttpError(409, 'claim_required', 'Bạn cần giữ claim còn hạn của báo cáo này.')

/** Current state of the reported content, for the moderator's side-by-side view. */
async function targetState(report) {
  const snapshot = report.targetSnapshot ?? {}
  let storyId = snapshot.storyId ?? null
  let chapterId = null
  let currentStatus = 'missing'
  let available = false
  if (report.targetType === 'comment') {
    const comment = await Comment.findById(report.targetId).select('status').lean()
    currentStatus = comment?.status ?? 'missing'
    available = currentStatus === 'visible'
  } else if (report.targetType === 'chapter') {
    chapterId = String(report.targetId)
    const chapter = await Chapter.findById(report.targetId).select('status storyId').lean()
    storyId = chapter ? String(chapter.storyId) : storyId
    currentStatus = chapter?.status ?? 'missing'
  } else {
    storyId = String(report.targetId)
  }
  const story = storyId
    ? await Story.findById(storyId).select('publicationStatus authorAccountId').lean()
    : null
  const author = story
    ? await Account.findById(story.authorAccountId).select('displayName status').lean()
    : null
  const storyVisible =
    story?.publicationStatus === 'published' &&
    !['suspended', 'anonymized'].includes(author?.status)
  if (report.targetType === 'story') {
    currentStatus = story?.publicationStatus ?? 'missing'
    available = storyVisible
  } else if (report.targetType === 'chapter')
    available = storyVisible && currentStatus === 'published'
  return {
    available,
    storyId,
    chapterId,
    title: snapshot.title ?? '',
    authorName: author ? publicName(author) : '',
    currentStatus,
  }
}

/** Moderator-facing row of one report. */
export async function reportRow(report, account, now = new Date()) {
  const active = ACTIVE_REPORT_STATUSES.includes(report.status)
  const [reporter, claimOwner, resolution, target, sameTargetOpen] = await Promise.all([
    Account.findById(report.reporterAccountId).select('displayName status').lean(),
    liveClaim(report, now)
      ? Account.findById(report.claimOwnerAccountId).select('displayName status').lean()
      : null,
    report.resolutionId ? ReportResolution.findById(report.resolutionId).lean() : null,
    targetState(report),
    ContentReport.countDocuments({
      _id: { $ne: report._id },
      targetType: report.targetType,
      targetId: report.targetId,
      status: { $in: ACTIVE_REPORT_STATUSES },
    }),
  ])
  const moderator = resolution
    ? await Account.findById(resolution.moderatorAccountId).select('displayName status').lean()
    : null
  return {
    id: String(report._id),
    version: report.version,
    targetType: report.targetType,
    targetId: String(report.targetId),
    reason: report.reason ?? 'other',
    details: report.details ?? '',
    status: report.status,
    submittedAt: report.submittedAt,
    reporter: { displayName: publicName(reporter) },
    snapshot: report.targetSnapshot ?? null,
    target,
    sameTargetOpen,
    claim: liveClaim(report, now)
      ? {
          mine: String(report.claimOwnerAccountId) === String(account._id),
          owner: publicName(claimOwner),
          expiresAt: report.claimExpiresAt,
        }
      : null,
    resolution: resolution
      ? {
          outcome: resolution.outcome,
          contentAction: resolution.contentAction,
          reason: resolution.reason,
          resolvedAt: resolution.resolvedAt,
          moderator: publicName(moderator),
        }
      : null,
    allowedActions: active ? REPORT_ACTIONS[report.targetType] : [],
  }
}

export async function listModeratorReports(
  account,
  { status, targetType, page },
  now = new Date(),
) {
  const filters = tabFilters(account, now)
  const scope = targetType ? { targetType } : {}
  const filter = { ...filters[status], ...scope }
  const [open, mine, resolved, rows] = await Promise.all([
    ContentReport.countDocuments({ ...filters.open, ...scope }),
    ContentReport.countDocuments({ ...filters.mine, ...scope }),
    ContentReport.countDocuments({ ...filters.resolved, ...scope }),
    ContentReport.find(filter)
      .sort(status === 'resolved' ? { resolvedAt: -1, _id: -1 } : { submittedAt: 1, _id: 1 })
      .skip((page - 1) * REPORT_PAGE_SIZE)
      .limit(REPORT_PAGE_SIZE)
      .lean(),
  ])
  const counts = { open, mine, resolved }
  return {
    items: await Promise.all(rows.map(row => reportRow(row, account, now))),
    total: counts[status],
    page,
    pageSize: REPORT_PAGE_SIZE,
    counts,
  }
}

export async function claimReport(
  account,
  reportId,
  { expectedVersion },
  config,
  now = new Date(),
) {
  const report = await withTransaction(async session => {
    await lockModerator(account, session)
    const report = await ContentReport.findById(reportId).session(session)
    if (!report) throw new HttpError(404, 'not_found', 'Không tìm thấy báo cáo.')
    if (ownsLiveClaim(report, account, now)) return report
    if (liveClaim(report, now))
      throw new HttpError(409, 'claimed', 'Báo cáo đang được kiểm duyệt viên khác xử lý.')
    if (!ACTIVE_REPORT_STATUSES.includes(report.status) || report.version !== expectedVersion)
      throw reportChanged()
    if (report.status === 'under-review' && report.claimOwnerAccountId)
      report.claimReleaseHistory.push({
        ownerAccountId: report.claimOwnerAccountId,
        claimVersion: report.claimVersion,
        expiresAt: report.claimExpiresAt,
        releasedAt: now,
        reason: 'expired',
        actorAccountId: account._id,
      })
    report.status = 'under-review'
    report.claimOwnerAccountId = account._id
    const effective = await policy.getEffective({ session, now, required: false })
    report.claimExpiresAt = new Date(
      now.getTime() + (effective?.claimExpiryHours ?? config.moderationClaimHours) * 3600000,
    )
    report.claimVersion += 1
    await report.save({ session })
    return report
  })
  return reportRow(report.toObject(), account, now)
}

export async function releaseReport(account, reportId, { expectedVersion }, now = new Date()) {
  const report = await withTransaction(async session => {
    await lockModerator(account, session)
    const report = await ContentReport.findById(reportId).session(session)
    if (!report) throw new HttpError(404, 'not_found', 'Không tìm thấy báo cáo.')
    if (!ownsLiveClaim(report, account, now)) throw claimRequired()
    if (report.version !== expectedVersion) throw reportChanged()
    report.claimReleaseHistory.push({
      ownerAccountId: report.claimOwnerAccountId,
      claimVersion: report.claimVersion,
      expiresAt: report.claimExpiresAt,
      releasedAt: now,
      reason: 'released',
      actorAccountId: account._id,
    })
    report.status = 'open'
    report.claimOwnerAccountId = undefined
    report.claimExpiresAt = undefined
    report.claimVersion += 1
    await report.save({ session })
    return report
  })
  return reportRow(report.toObject(), account, now)
}
