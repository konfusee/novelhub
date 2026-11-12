import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  ContentReport,
  RESOLUTION_OUTCOMES,
  ReportResolution,
} from '../../../models/index.js'
import { publicName } from '../../reading-community/community/common.js'
import {
  acquireClaim,
  adoptOwnClaim,
  claimFields,
  claimState,
  claimSummary,
  endClaim,
  holdsClaimToken,
  policyTtlHours,
  requireLiveClaim,
} from './claim-lease.js'
import { lockModerator } from './moderator-access.js'
import {
  ALLOWED_REPORT_ACTIONS,
  currentTarget,
  reportSnapshot,
  snapshotTitle,
} from './report-targets.js'

/** Report queue, review detail, claim and release (UC-MOD-05, SDS ReportReviewService). */

export const REPORT_PAGE_SIZE = 20
export const ACTIVE_REPORT_STATUSES = ['open', 'under-review']
const EARLIER_CASES_LIMIT = 50

/** Open reports without a live claim: what a Moderator can claim now (BR-NEW-S01). */
export const claimableReportFilter = now => ({
  status: { $in: ACTIVE_REPORT_STATUSES },
  $or: [{ claimOwnerAccountId: null }, { claimExpiresAt: { $lte: now } }],
})

const VIEW_FILTERS = {
  // Open reports without another moderator's live claim, the account's own claims included.
  queue: (account, now) => ({
    status: { $in: ACTIVE_REPORT_STATUSES },
    $or: [
      { claimOwnerAccountId: null },
      { claimExpiresAt: { $lte: now } },
      { claimOwnerAccountId: account._id },
    ],
  }),
  mine: (account, now) => ({
    status: 'under-review',
    claimOwnerAccountId: account._id,
    claimExpiresAt: { $gt: now },
  }),
}

export const reportChanged = () =>
  new HttpError(
    409,
    'report_changed',
    'Báo cáo đã thay đổi hoặc không còn phù hợp với thao tác đã chọn. Hãy tải lại.',
  )
const reportNotFound = () => new HttpError(404, 'not_found', 'Không tìm thấy báo cáo.')

const reportStatus = report =>
  ACTIVE_REPORT_STATUSES.includes(report.status) ? 'open' : 'resolved'

// Literals of resolutions written before ReportAction/ResolutionOutcome (contentAction 'none').
const LEGACY_OUTCOMES = { hidden: 'comment-hidden', warned: 'author-warned' }
const LEGACY_ACTIONS = { dismissed: 'dismiss', hidden: 'hide-comment', warned: 'warn-author' }
/**
 * Action and outcome of a stored resolution. Resolutions are append-only, so legacy rows are
 * mapped on read instead of being rewritten.
 */
export function resolutionLiterals({ outcome, contentAction }) {
  if (RESOLUTION_OUTCOMES.includes(outcome) && contentAction !== 'none')
    return { outcome, action: contentAction }
  if (outcome === 'unpublished')
    return {
      outcome: contentAction === 'unpublish-chapter' ? 'chapter-unpublished' : 'story-unpublished',
      action: contentAction,
    }
  return {
    outcome: LEGACY_OUTCOMES[outcome] ?? outcome,
    action: LEGACY_ACTIONS[outcome] ?? contentAction,
  }
}

export async function listModeratorReports(account, { view, targetType, page }, now = new Date()) {
  const filter = {
    ...VIEW_FILTERS[view](account, now),
    ...(targetType ? { targetType } : {}),
  }
  const [total, rows] = await Promise.all([
    ContentReport.countDocuments(filter),
    ContentReport.find(filter)
      .sort({ submittedAt: 1, _id: 1 })
      .skip((page - 1) * REPORT_PAGE_SIZE)
      .limit(REPORT_PAGE_SIZE)
      .lean(),
  ])
  const reporters = await Account.find({ _id: { $in: rows.map(row => row.reporterAccountId) } })
    .select('displayName status')
    .lean()
  const reporterById = new Map(reporters.map(reporter => [String(reporter._id), reporter]))
  return {
    view,
    items: rows.map(report => ({
      reportId: String(report._id),
      version: report.version,
      targetType: report.targetType,
      targetTitle: snapshotTitle(report),
      reason: report.reason ?? 'other',
      reporter: {
        id: String(report.reporterAccountId),
        displayName: publicName(reporterById.get(String(report.reporterAccountId))),
      },
      reportedAt: report.submittedAt,
      ...claimSummary(report, account, now),
    })),
    page,
    pageSize: REPORT_PAGE_SIZE,
    total,
    pageCount: Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE)),
  }
}

/** Other reports on the same target with their resolutions, newest first, and the open count. */
async function sameTargetCases(report, session) {
  const sameTarget = {
    _id: { $ne: report._id },
    targetType: report.targetType,
    targetId: report.targetId,
  }
  const [others, openDuplicates] = await Promise.all([
    ContentReport.find(sameTarget)
      .select('reason status submittedAt')
      .sort({ submittedAt: -1, _id: -1 })
      .limit(EARLIER_CASES_LIMIT)
      .session(session)
      .lean(),
    ContentReport.countDocuments({
      ...sameTarget,
      status: { $in: ACTIVE_REPORT_STATUSES },
    }).session(session),
  ])
  const resolutions = await ReportResolution.find({ reportId: { $in: others.map(row => row._id) } })
    .select('reportId outcome contentAction contentChanged resolvedAt')
    .session(session)
    .lean()
  const resolutionByReport = new Map(resolutions.map(row => [String(row.reportId), row]))
  return {
    openDuplicates,
    earlierCases: others.map(other => {
      const resolution = resolutionByReport.get(String(other._id))
      return {
        reportId: String(other._id),
        reason: other.reason ?? 'other',
        status: reportStatus(other),
        reportedAt: other.submittedAt,
        ...(resolution
          ? {
              ...resolutionLiterals(resolution),
              contentChanged: resolution.contentChanged ?? null,
              resolvedAt: resolution.resolvedAt,
            }
          : { outcome: null, action: null, contentChanged: null, resolvedAt: null }),
      }
    }),
  }
}

async function resolutionView(report, session) {
  if (!report.resolutionId) return null
  const resolution = await ReportResolution.findById(report.resolutionId).session(session).lean()
  if (!resolution) return null
  const moderator = await Account.findById(resolution.moderatorAccountId)
    .select('displayName status')
    .session(session)
    .lean()
  return {
    ...resolutionLiterals(resolution),
    contentChanged: resolution.contentChanged ?? null,
    reason: resolution.reason,
    resolvedAt: resolution.resolvedAt,
    moderator: { id: String(resolution.moderatorAccountId), displayName: publicName(moderator) },
  }
}

/**
 * Review detail: always the UC-MOD-05 step 3 summary; the snapshot, current state, earlier cases
 * and allowed actions only while the account holds the live claim with its token (step 6, AF2).
 * For a chapter report the parent story is named, since Unpublish Story applies to it.
 */
async function toDetail(report, account, now, session = null) {
  const [reporter, resolution] = await Promise.all([
    Account.findById(report.reporterAccountId).select('displayName status').session(session).lean(),
    resolutionView(report, session),
  ])
  const summary = {
    reportId: String(report._id),
    version: report.version,
    status: reportStatus(report),
    targetType: report.targetType,
    targetTitle: snapshotTitle(report),
    reason: report.reason ?? 'other',
    details: report.details ?? '',
    reporter: { id: String(report.reporterAccountId), displayName: publicName(reporter) },
    reportedAt: report.submittedAt,
    ...claimFields(report, account, now),
    resolution,
    allowedActions: [],
  }
  if (!holdsClaimToken(report, account, now)) return summary
  const [{ storyTitle, ...current }, cases] = await Promise.all([
    currentTarget(report, session),
    sameTargetCases(report, session),
  ])
  return {
    ...summary,
    snapshot: reportSnapshot(report),
    current,
    parentStory:
      report.targetType === 'chapter' && current.storyId
        ? { id: current.storyId, title: storyTitle }
        : null,
    ...cases,
    allowedActions: ALLOWED_REPORT_ACTIONS[report.targetType],
  }
}

export async function moderatorReportDetail(account, reportId, now = new Date()) {
  const report = await ContentReport.findById(reportId).lean()
  if (!report) throw reportNotFound()
  return toDetail(report, account, now)
}

/** Claims an open report in one transaction (UC-MOD-05 steps 4-5, EX1-EX3, AF2). */
export async function claimReport(
  account,
  reportId,
  { expectedVersion },
  config,
  now = new Date(),
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const report = await ContentReport.findById(reportId).session(session)
    if (!report) throw reportNotFound()
    if (claimState(report, account._id, now) !== 'mine') {
      if (report.version !== expectedVersion || !ACTIVE_REPORT_STATUSES.includes(report.status))
        throw reportChanged()
      acquireClaim(report, account, await policyTtlHours(config, now, session), now)
      report.status = 'under-review'
      await report.save({ session })
    } else if (adoptOwnClaim(report)) await report.save({ session })
    return {
      ...(await toDetail(report.toObject(), account, now, session)),
      messageId: 'SYS-MSG-MOD-01',
    }
  })
}

/** Releases the account's own live claim (UC-MOD-05 AF3). */
export async function releaseReport(
  account,
  reportId,
  { expectedVersion, claimToken },
  now = new Date(),
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const report = await ContentReport.findById(reportId).session(session)
    if (!report) throw reportNotFound()
    requireLiveClaim(report, account, claimToken, now)
    if (report.version !== expectedVersion) throw reportChanged()
    endClaim(report, 'released', account._id, now)
    report.status = 'open'
    await report.save({ session })
    return {
      ...(await toDetail(report.toObject(), account, now, session)),
      messageId: 'SYS-MSG-MOD-03',
    }
  })
}
