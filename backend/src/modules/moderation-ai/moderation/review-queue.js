import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  ContentRevision,
  EvidenceBatch,
  LlmReview,
  PublicationSubmission,
  SimilarityFinding,
  Story,
} from '../../../models/index.js'
import { evidenceState, terminalEvidenceReady } from '../review-evidence.js'
import {
  acquireClaim,
  adoptOwnClaim,
  claimState,
  claimSummary,
  endClaim,
  policyTtlHours,
  requireLiveClaim,
} from './claim-lease.js'
import { lockModerator, submissionChanged } from './moderator-access.js'
import { moderatorSubmissionDetail } from './review-detail.js'

/** Submission queue, claim and release (UC-MOD-01, UC-MOD-02; SDS SubmissionReviewService). */

export const PAGE_SIZE = 20

/** Ready submissions without a live claim (BR-NEW-S04 "claimable"). */
export const claimableSubmissionFilter = now => ({
  $or: [
    { status: 'pending-review' },
    { status: 'decision-pending', claimExpiresAt: { $lte: now } },
  ],
})
/** Submissions under the account's live claim. */
export const ownLiveSubmissionFilter = (accountId, now) => ({
  status: 'decision-pending',
  claimOwnerAccountId: accountId,
  claimExpiresAt: { $gt: now },
})
/** Submissions whose AI evidence is still running. */
export const processingSubmissionFilter = { status: 'validated' }

// Submissions of suspended, closed or otherwise inactive authors are neither listed nor counted.
export async function activeAuthorScope() {
  return {
    authorAccountId: { $nin: await Account.distinct('_id', { status: { $ne: 'active' } }) },
  }
}

const VIEW_FILTERS = {
  available: (account, now) => claimableSubmissionFilter(now),
  mine: (account, now) => ownLiveSubmissionFilter(account._id, now),
  processing: () => processingSubmissionFilter,
}

const analysisRunning = () =>
  new HttpError(
    409,
    'analysis_running',
    'AI vẫn đang phân tích hồ sơ. Chưa thể kiểm duyệt chính thức.',
  )
const submissionNotFound = () => new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.')

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
          state: evidenceState(batch),
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

/** One view of the queue, oldest first, 20 per page (UC-MOD-01 steps 2-5). */
export async function listModeratorSubmissions(account, { view, page }, now = new Date()) {
  const filter = { ...VIEW_FILTERS[view](account, now), ...(await activeAuthorScope()) }
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
      .select('content.title')
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
    const evidence = summaries.get(String(row.currentEvidenceBatchId)) ?? null
    return {
      submissionId: String(row._id),
      version: row.version,
      status: row.status,
      targetType: row.chapterId ? 'chapter' : 'story',
      title: revisionById.get(String(row.revisionId))?.content?.title ?? '',
      storyTitle: storyById.get(String(row.storyId))?.title ?? '',
      author: {
        id: String(row.authorAccountId),
        displayName: authorById.get(String(row.authorAccountId))?.displayName ?? '',
      },
      submittedAt: row.submittedAt,
      waitingSeconds: Math.max(0, Math.floor((now - row.submittedAt) / 1000)),
      evidenceStatus: evidence?.state ?? 'processing',
      evidence,
      ...claimSummary(row, account, now),
    }
  })
  return {
    view,
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

/**
 * Claims a Ready submission in one transaction, checks in the order of UC-MOD-02 step 4: role,
 * version, Ready (not processing), active author, no other live claim. The holder re-opening its
 * own live claim takes no new claim (AF1).
 */
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
    if (!submission) throw submissionNotFound()
    if (
      submission.status === 'decision-pending' &&
      claimState(submission, account._id, now) === 'mine'
    ) {
      if (adoptOwnClaim(submission)) await submission.save({ session })
    } else {
      if (submission.version !== expectedVersion) throw submissionChanged()
      if (submission.status === 'validated') throw analysisRunning()
      if (!['pending-review', 'decision-pending'].includes(submission.status))
        throw submissionChanged()
      const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
        .session(session)
        .lean()
      if (!terminalEvidenceReady(batch)) throw analysisRunning()
      const author = await Account.findById(submission.authorAccountId)
        .select('status')
        .session(session)
        .lean()
      if (author?.status !== 'active') throw submissionChanged()
      acquireClaim(submission, account, await policyTtlHours(config, now, session), now)
      submission.status = 'decision-pending'
      await submission.save({ session })
    }
    return {
      ...(await moderatorSubmissionDetail(account, submission._id, now, session)),
      messageId: 'SYS-MSG-MOD-01',
    }
  })
}

/** Releases the account's own live claim (UC-MOD-02 AF2). */
export async function releaseSubmission(
  account,
  submissionId,
  { expectedVersion, claimToken },
  now = new Date(),
) {
  return withTransaction(async session => {
    await lockModerator(account, session)
    const submission = await PublicationSubmission.findById(submissionId).session(session)
    if (!submission) throw submissionNotFound()
    requireLiveClaim(submission, account, claimToken, now)
    if (submission.version !== expectedVersion) throw submissionChanged()
    endClaim(submission, 'released', account._id, now)
    submission.status = 'pending-review'
    await submission.save({ session })
    return {
      ...(await moderatorSubmissionDetail(account, submission._id, now, session)),
      messageId: 'SYS-MSG-MOD-03',
    }
  })
}
