import { withTransaction } from '../../db/connection.js'
import { HttpError } from '../../middleware/errors.js'
import {
  Account,
  ContentReport,
  ContentRevision,
  EvidenceBatch,
  LlmReview,
  ModerationHistory,
  PublicationSubmission,
  SimilarityFinding,
  Story,
} from '../../models/index.js'
import { terminalEvidenceReady } from '../review-evidence.js'
import { lockModerator } from './moderator-access.js'
import { claimableReportFilter } from './report-queue.js'

export const PAGE_SIZE = 20

// Asia/Ho_Chi_Minh is UTC+7 without daylight saving time.
export function startOfVietnamDay(now) {
  const shifted = new Date(now.getTime() + 7 * 3600000)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 7 * 3600000,
  )
}

const queueFilter = now => ({
  $or: [
    { status: 'pending-review' },
    { status: 'decision-pending', claimExpiresAt: { $lte: now } },
  ],
})
const mineFilter = (account, now) => ({
  status: 'decision-pending',
  claimOwnerAccountId: account._id,
  claimExpiresAt: { $gt: now },
})
const processingFilter = { status: 'validated' }

// Submissions of suspended, closed or otherwise inactive authors are neither listed nor counted.
async function activeAuthorScope() {
  return {
    authorAccountId: { $nin: await Account.distinct('_id', { status: { $ne: 'active' } }) },
  }
}

const evidencePending = () =>
  new HttpError(409, 'evidence_pending', 'AI đang xử lý bằng chứng; chưa thể nhận hồ sơ.')
const submissionChanged = () =>
  new HttpError(409, 'submission_changed', 'Hồ sơ đã thay đổi. Hãy tải lại.')

function pageEnvelope(items, page, total) {
  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export function claimView(submission, account, now) {
  const owner = submission.claimOwnerAccountId
  if (!owner) return null
  return {
    ownerAccountId: String(owner),
    ownedByMe: String(owner) === String(account._id),
    expiresAt: submission.claimExpiresAt,
    expired: !(submission.claimExpiresAt > now),
  }
}

export async function evidenceSummaries(batchIds) {
  const [batches, findings, reviews] = await Promise.all([
    EvidenceBatch.find({ _id: { $in: batchIds } }).lean(),
    SimilarityFinding.aggregate([
      { $match: { batchId: { $in: batchIds } } },
      { $group: { _id: '$batchId', count: { $sum: 1 }, maxScore: { $max: '$score' } } },
    ]),
    LlmReview.find({ batchId: { $in: batchIds }, status: 'succeeded' })
      .select('batchId')
      .lean(),
  ])
  const findingsByBatch = new Map(findings.map(row => [String(row._id), row]))
  const reviewed = new Set(reviews.map(review => String(review.batchId)))
  return new Map(
    batches.map(batch => {
      const key = String(batch._id)
      const found = findingsByBatch.get(key)
      const llmStatus = reviewed.has(key)
        ? 'succeeded'
        : batch.status === 'failed'
          ? batch.failedStage === 'llm'
            ? 'failed'
            : 'skipped'
          : 'pending'
      return [
        key,
        {
          batchId: key,
          batchVersion: batch.version,
          status: batch.status,
          stage: batch.stage ?? null,
          failedStage: batch.failedStage ?? null,
          findingsCount: found?.count ?? 0,
          maxScore: found?.maxScore ?? null,
          llmStatus,
        },
      ]
    }),
  )
}

export async function moderatorSummary(account, now = new Date()) {
  const scope = await activeAuthorScope()
  const [queue, mine, processing, decidedToday, openReports] = await Promise.all([
    PublicationSubmission.countDocuments({ ...queueFilter(now), ...scope }),
    PublicationSubmission.countDocuments({ ...mineFilter(account, now), ...scope }),
    PublicationSubmission.countDocuments({ ...processingFilter, ...scope }),
    ModerationHistory.countDocuments({
      action: 'manual-review.decided',
      actorAccountId: account._id,
      occurredAt: { $gte: startOfVietnamDay(now) },
    }),
    ContentReport.countDocuments(claimableReportFilter(now)),
  ])
  return { queue, mine, processing, decidedToday, openReports }
}

export async function listModeratorSubmissions(account, { view, page }, now = new Date()) {
  const base =
    view === 'mine'
      ? mineFilter(account, now)
      : view === 'processing'
        ? processingFilter
        : queueFilter(now)
  const filter = { ...base, ...(await activeAuthorScope()) }
  const [total, rows] = await Promise.all([
    PublicationSubmission.countDocuments(filter),
    PublicationSubmission.find(filter)
      .sort({ submittedAt: 1, _id: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ])
  const [revisions, stories, authors, summaries] = await Promise.all([
    ContentRevision.find({ _id: { $in: rows.map(row => row.revisionId) } })
      .select('content.title revisionNumber')
      .lean(),
    Story.find({ _id: { $in: rows.map(row => row.storyId) } })
      .select('title')
      .lean(),
    Account.find({ _id: { $in: rows.map(row => row.authorAccountId) } })
      .select('displayName')
      .lean(),
    evidenceSummaries(rows.map(row => row.currentEvidenceBatchId).filter(Boolean)),
  ])
  const byId = list => new Map(list.map(doc => [String(doc._id), doc]))
  const revisionById = byId(revisions)
  const storyById = byId(stories)
  const authorById = byId(authors)
  const items = rows.map(row => {
    const revision = revisionById.get(String(row.revisionId))
    const story = storyById.get(String(row.storyId))
    const author = authorById.get(String(row.authorAccountId))
    return {
      id: String(row._id),
      version: row.version,
      status: row.status,
      submittedAt: row.submittedAt,
      type: row.chapterId ? 'chapter' : 'story',
      storyId: String(row.storyId),
      chapterId: row.chapterId ? String(row.chapterId) : null,
      title: revision?.content?.title ?? '',
      storyTitle: story?.title ?? '',
      revisionNumber: revision?.revisionNumber ?? null,
      author: { id: String(row.authorAccountId), displayName: author?.displayName ?? '' },
      claim: claimView(row, account, now),
      evidence: summaries.get(String(row.currentEvidenceBatchId)) ?? null,
    }
  })
  return pageEnvelope(items, page, total)
}

export async function claimSubmission(
  account,
  submissionId,
  { expectedVersion },
  config,
  now = new Date(),
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const submission = await PublicationSubmission.findById(submissionId).session(session)
    if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.')
    if (
      submission.status === 'decision-pending' &&
      String(submission.claimOwnerAccountId) === String(account._id) &&
      submission.claimExpiresAt > now
    )
      return {
        id: String(submission._id),
        version: submission.version,
        status: submission.status,
        claimExpiresAt: submission.claimExpiresAt,
        replayed: true,
      }
    if (submission.status === 'validated') throw evidencePending()
    const expired = submission.status === 'decision-pending' && !(submission.claimExpiresAt > now)
    if (submission.status === 'decision-pending' && !expired)
      throw new HttpError(409, 'claim_held', 'Hồ sơ đang được kiểm duyệt viên khác giữ.')
    if (
      (submission.status !== 'pending-review' && !expired) ||
      submission.version !== expectedVersion
    )
      throw submissionChanged()
    const author = await Account.findById(submission.authorAccountId)
      .select('status')
      .session(session)
      .lean()
    if (author?.status !== 'active')
      throw new HttpError(409, 'author_unavailable', 'Tài khoản tác giả không còn hoạt động.')
    const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
      .session(session)
      .lean()
    if (!terminalEvidenceReady(batch)) throw evidencePending()
    if (expired)
      submission.claimReleaseHistory.push({
        ownerAccountId: submission.claimOwnerAccountId,
        claimVersion: submission.claimVersion,
        expiresAt: submission.claimExpiresAt,
        releasedAt: now,
        reason: 'expired',
        actorAccountId: account._id,
      })
    submission.status = 'decision-pending'
    submission.claimOwnerAccountId = account._id
    submission.claimExpiresAt = new Date(now.getTime() + config.moderationClaimHours * 3600000)
    submission.claimVersion += 1
    await submission.save({ session })
    return {
      id: String(submission._id),
      version: submission.version,
      status: submission.status,
      claimExpiresAt: submission.claimExpiresAt,
      replayed: false,
    }
  })
}

export async function releaseSubmission(
  account,
  submissionId,
  { expectedVersion },
  now = new Date(),
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const submission = await PublicationSubmission.findById(submissionId).session(session)
    if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.')
    // An expired claim can only be taken over through claimSubmission, which records the expiry.
    if (
      submission.status !== 'decision-pending' ||
      String(submission.claimOwnerAccountId) !== String(account._id) ||
      !(submission.claimExpiresAt > now)
    )
      throw new HttpError(409, 'claim_required', 'Bạn cần giữ claim còn hạn của hồ sơ này.')
    if (submission.version !== expectedVersion) throw submissionChanged()
    submission.claimReleaseHistory.push({
      ownerAccountId: submission.claimOwnerAccountId,
      claimVersion: submission.claimVersion,
      expiresAt: submission.claimExpiresAt,
      releasedAt: now,
      reason: 'released',
      actorAccountId: account._id,
    })
    submission.status = 'pending-review'
    submission.claimOwnerAccountId = undefined
    submission.claimExpiresAt = undefined
    submission.claimVersion += 1
    await submission.save({ session })
    return { id: String(submission._id), version: submission.version, status: submission.status }
  })
}

export async function listModeratorDecisions(account, { outcome, scope, page }) {
  const filter = {
    action: 'manual-review.decided',
    ...(outcome === 'all' ? {} : { outcome }),
    ...(scope === 'mine' ? { actorAccountId: account._id } : {}),
  }
  const [total, rows] = await Promise.all([
    ModerationHistory.countDocuments(filter),
    ModerationHistory.find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ])
  const [submissions, moderators] = await Promise.all([
    PublicationSubmission.find({ _id: { $in: rows.map(row => row.submissionId) } })
      .select('revisionId chapterId')
      .lean(),
    Account.find({ _id: { $in: rows.map(row => row.actorAccountId) } })
      .select('displayName')
      .lean(),
  ])
  const revisions = await ContentRevision.find({
    _id: { $in: submissions.map(submission => submission.revisionId) },
  })
    .select('content.title')
    .lean()
  const byId = list => new Map(list.map(doc => [String(doc._id), doc]))
  const submissionById = byId(submissions)
  const revisionById = byId(revisions)
  const moderatorById = byId(moderators)
  const items = rows.map(row => {
    const submission = submissionById.get(String(row.submissionId))
    const revision = revisionById.get(String(submission?.revisionId))
    return {
      id: String(row._id),
      submissionId: String(row.submissionId),
      revisionId: String(submission?.revisionId ?? row.revisionId),
      title: revision?.content?.title ?? '',
      type: submission?.chapterId ? 'chapter' : 'story',
      outcome: row.outcome,
      feedback: row.feedback ?? '',
      occurredAt: row.occurredAt,
      moderator: {
        id: String(row.actorAccountId),
        displayName: moderatorById.get(String(row.actorAccountId))?.displayName ?? '',
      },
      mine: String(row.actorAccountId) === String(account._id),
    }
  })
  return pageEnvelope(items, page, total)
}
