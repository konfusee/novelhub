import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  ContentReport,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  PublicationSubmission,
  ReportResolution,
  RESOLUTION_OUTCOMES,
} from '../../../models/index.js'
import { publicName } from '../../reading-community/community/common.js'
import { terminalEvidenceReady } from '../review-evidence.js'
import { vietnamDate, vietnamDayAfter } from './period-stats.js'
import { resolutionLiterals } from './report-queue.js'
import { snapshotTitle } from './report-targets.js'

/**
 * ModerationHistoryService (SDS 3.1, UC-MOD-07): the read-only history of publication decisions,
 * submission cancellations and report resolutions. moderationHistory is a shared, append-only
 * event log, so the case type is derived from the stored action.
 */
export const HISTORY_PAGE_SIZE = 20
export const DECIDED_ACTION = 'manual-review.decided'
export const CASE_ACTIONS = {
  publication: [DECIDED_ACTION, 'submission.cancelled'],
  report: ['report.resolved'],
}
export const CASE_OUTCOMES = {
  publication: ['approved', 'rejected', 'cancelled'],
  report: RESOLUTION_OUTCOMES,
}
const MODERATION_ACTIONS = [...CASE_ACTIONS.publication, ...CASE_ACTIONS.report]

/**
 * History filter for an outcome. Resolutions written before the SDS literals keep their legacy
 * history outcome (append-only); those entries are matched through their mapped resolution.
 */
async function outcomeFilter(outcome) {
  if (!outcome) return {}
  if (!CASE_OUTCOMES.report.includes(outcome)) return { outcome }
  const legacy = await ReportResolution.find({ outcome: { $nin: RESOLUTION_OUTCOMES } })
    .select('historyId outcome contentAction')
    .lean()
  const legacyIds = legacy
    .filter(resolution => resolutionLiterals(resolution).outcome === outcome)
    .map(resolution => resolution.historyId)
  return legacyIds.length ? { $or: [{ outcome }, { _id: { $in: legacyIds } }] } : { outcome }
}

const byId = docs => new Map(docs.map(doc => [String(doc._id), doc]))
const caseOf = entry => (CASE_ACTIONS.report.includes(entry.action) ? 'report' : 'publication')

/**
 * Case type, target, outcome and the records behind each entry, read in batches:
 * publication entries through their submission and revision, report entries through their
 * resolution (reportResolutions.historyId) and report.
 */
export async function describeEntries(entries) {
  const publication = entries.filter(entry => caseOf(entry) === 'publication')
  const reports = entries.filter(entry => caseOf(entry) === 'report')
  const [submissions, resolutions] = await Promise.all([
    PublicationSubmission.find({ _id: { $in: publication.map(entry => entry.submissionId) } })
      .select('chapterId revisionId currentEvidenceBatchId')
      .lean(),
    ReportResolution.find({ historyId: { $in: reports.map(entry => entry._id) } }).lean(),
  ])
  const submissionById = byId(submissions)
  const resolutionByHistory = new Map(
    resolutions.map(resolution => [String(resolution.historyId), resolution]),
  )
  const revisionIdOf = entry =>
    entry.revisionId ?? submissionById.get(String(entry.submissionId))?.revisionId
  const reportIdOf = entry =>
    resolutionByHistory.get(String(entry._id))?.reportId ??
    (entry.aggregateType === 'ContentReport' ? entry.aggregateId : null)
  const [revisions, contentReports] = await Promise.all([
    ContentRevision.find({ _id: { $in: publication.map(revisionIdOf).filter(Boolean) } })
      .select('revisionNumber status content.title')
      .lean(),
    ContentReport.find({ _id: { $in: reports.map(reportIdOf).filter(Boolean) } })
      .select('targetType reason details targetSnapshot')
      .lean(),
  ])
  const revisionById = byId(revisions)
  const reportById = byId(contentReports)
  return new Map(
    entries.map(entry => {
      const base = {
        caseType: caseOf(entry),
        feedbackOrReason: entry.feedback || entry.reason || null,
      }
      if (base.caseType === 'publication') {
        const submission = submissionById.get(String(entry.submissionId))
        const revision = revisionById.get(String(revisionIdOf(entry)))
        return [
          String(entry._id),
          {
            ...base,
            targetType: submission?.chapterId ? 'chapter' : 'story',
            targetTitle: revision?.content?.title ?? '',
            outcome: entry.outcome,
            submission,
            revision,
          },
        ]
      }
      const resolution = resolutionByHistory.get(String(entry._id))
      const report = reportById.get(String(reportIdOf(entry)))
      return [
        String(entry._id),
        {
          ...base,
          targetType: report?.targetType ?? null,
          targetTitle: snapshotTitle(report ?? resolution ?? {}),
          outcome: resolution ? resolutionLiterals(resolution).outcome : entry.outcome,
          resolution,
          report,
        },
      ]
    }),
  )
}

const moderatorView = account => ({
  id: account ? String(account._id) : null,
  displayName: publicName(account),
})

/** Paged history, newest first (UC-MOD-07); an empty page is a valid result (AF1). */
export async function listHistory(account, { scope, caseType, outcome, from, to, page }) {
  const occurredAt = {
    ...(from ? { $gte: vietnamDate(from) } : {}),
    ...(to ? { $lt: vietnamDayAfter(to) } : {}),
  }
  const filter = {
    action: { $in: caseType ? CASE_ACTIONS[caseType] : MODERATION_ACTIONS },
    ...(await outcomeFilter(outcome)),
    ...(scope === 'mine' ? { actorAccountId: account._id } : {}),
    ...(from || to ? { occurredAt } : {}),
  }
  const [total, entries] = await Promise.all([
    ModerationHistory.countDocuments(filter),
    ModerationHistory.find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * HISTORY_PAGE_SIZE)
      .limit(HISTORY_PAGE_SIZE)
      .lean(),
  ])
  const [described, moderators] = await Promise.all([
    describeEntries(entries),
    Account.find({ _id: { $in: entries.map(entry => entry.actorAccountId) } })
      .select('displayName status')
      .lean(),
  ])
  const moderatorById = byId(moderators)
  return {
    items: entries.map(entry => {
      const { caseType, targetType, targetTitle, outcome, feedbackOrReason } = described.get(
        String(entry._id),
      )
      return {
        historyId: String(entry._id),
        occurredAt: entry.occurredAt,
        moderator: moderatorView(moderatorById.get(String(entry.actorAccountId))),
        caseType,
        targetType,
        targetTitle,
        outcome,
        feedbackOrReason,
      }
    }),
    page,
    pageSize: HISTORY_PAGE_SIZE,
    total,
  }
}

/** Evidence state of a batch as moderators see it: processing, ready or failed. */
export const evidenceStatus = batch =>
  batch?.status === 'failed' ? 'failed' : terminalEvidenceReady(batch) ? 'ready' : 'processing'

/**
 * One history entry with what it decided (UC-MOD-07 step 6): the reviewed revision and its
 * evidence state, or the reported snapshot, applied action and whether content changed.
 * Reads stored records only and starts no AI request (BR-REV-07).
 */
export async function historyEntryDetail(historyId) {
  const entry = await ModerationHistory.findOne({
    _id: historyId,
    action: { $in: MODERATION_ACTIONS },
  }).lean()
  if (!entry)
    throw new HttpError(404, 'not_found', 'Mục lịch sử không còn tồn tại hoặc không thể truy cập.')
  const [described, moderator] = await Promise.all([
    describeEntries([entry]),
    Account.findById(entry.actorAccountId).select('displayName status').lean(),
  ])
  const item = described.get(String(entry._id))
  const detail = {
    historyId: String(entry._id),
    occurredAt: entry.occurredAt,
    moderator: moderatorView(moderator),
    caseType: item.caseType,
    targetType: item.targetType,
    targetTitle: item.targetTitle,
    outcome: item.outcome,
    feedbackOrReason: item.feedbackOrReason,
    publication: null,
    report: null,
  }
  if (item.caseType === 'publication') {
    const batchId = entry.evidenceBatchId ?? item.submission?.currentEvidenceBatchId
    const batch = batchId
      ? await EvidenceBatch.findById(batchId).select('status stage failedStage').lean()
      : null
    detail.publication = {
      submissionId: entry.submissionId ? String(entry.submissionId) : null,
      revisionId: item.revision ? String(item.revision._id) : null,
      revisionNumber: item.revision?.revisionNumber ?? null,
      revisionStatus: item.revision?.status ?? null,
      evidenceStatus: batch ? evidenceStatus(batch) : null,
      failedStage: batch?.status === 'failed' ? (batch.failedStage ?? null) : null,
    }
  } else {
    detail.report = {
      reportId: item.report ? String(item.report._id) : null,
      reason: item.report ? (item.report.reason ?? 'other') : null,
      details: item.report?.details ?? '',
      snapshot: item.report?.targetSnapshot ?? item.resolution?.targetSnapshot ?? null,
      action: item.resolution ? resolutionLiterals(item.resolution).action : null,
      contentChanged: item.resolution?.contentChanged ?? null,
    }
  }
  return detail
}
