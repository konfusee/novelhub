import mongoose from 'mongoose'
import {
  Account,
  ContentReport,
  ContentRevision,
  EvidenceBatch,
  LlmReview,
  ModerationHistory,
  PublicationSubmission,
  ReportResolution,
  Story,
} from '../../../models/index.js'
import { publicName } from '../../reading-community/community/common.js'
import { claimState } from './claim-lease.js'
import { DECIDED_ACTION, describeEntries, evidenceStatus } from './history.js'
import {
  RISK_LEVELS,
  agreement,
  buckets,
  median,
  percentile,
  range,
  rate,
  truncateExpression,
  vietnamDayStart,
} from './period-stats.js'
import { claimableReportFilter, resolutionLiterals } from './report-queue.js'
import {
  activeAuthorScope,
  claimableSubmissionFilter,
  ownLiveSubmissionFilter,
  processingSubmissionFilter,
} from './review-queue.js'

/**
 * ModerationDashboardService (SDS 3.1): read-only overview counters and lists (UC-MOD-08) and
 * statistics over a selected period (UC-MOD-09), each computed with one request time.
 */
const LIST_SIZE = 5
// Ready for review: waiting unclaimed, or claimed (live or expired) but not yet decided.
const WAITING_STATUSES = ['pending-review', 'decision-pending']
const DECISION_OUTCOMES = ['approved', 'rejected']
const PUBLICATION_TARGETS = ['story', 'chapter']

export const STATISTICS_DEFINITIONS = {
  queueAge:
    'Tuổi hàng đợi tính trên mọi hồ sơ đang chờ duyệt (đã nhận hoặc chưa) của tác giả còn hoạt động, tại thời điểm yêu cầu, không phụ thuộc kỳ đã chọn. Tuổi = thời điểm hiện tại trừ thời điểm gửi; trung vị và phân vị 90 (theo hạng gần nhất).',
  decisionBuckets:
    'Quyết định xuất bản (phê duyệt, từ chối) trong kỳ, theo ô thời gian giờ Việt Nam (UTC+7, tuần bắt đầu thứ Hai) và nhóm đã chọn. Tỷ lệ = số quyết định loại đó của dòng / tổng mọi quyết định trong ô thời gian × 100, làm tròn một chữ số thập phân; khi nhóm theo kết quả, kiểm duyệt viên, loại nội dung hoặc mức rủi ro AI, mẫu số vẫn là tổng của cả ô. Bộ lọc kiểm duyệt viên và mức rủi ro AI giới hạn tập quyết định được tính; bộ lọc kết quả chỉ chọn loại quyết định được hiển thị, không thu hẹp mẫu số, và tỷ lệ của loại bị lọc bỏ là không có dữ liệu.',
  moderatorDecisions:
    'Số quyết định xuất bản của từng kiểm duyệt viên trong kỳ và trung vị thời gian từ lúc nhận hồ sơ đến lúc quyết định. Quyết định không lưu thời điểm nhận không được tính vào trung vị.',
  reportBuckets:
    'Báo cáo nội dung nhận được trong kỳ, theo thời điểm gửi báo cáo, luôn được chia theo loại nội dung và lý do báo cáo.',
  resolutionBuckets:
    'Báo cáo đã xử lý trong kỳ, theo thời điểm xử lý, luôn được chia theo kết quả xử lý.',
  aiAgreement:
    'Tỷ lệ đồng thuận AI = (phê duyệt khi AI đánh giá rủi ro thấp + từ chối khi rủi ro trung bình hoặc cao) / số quyết định có đánh giá LLM thành công. Đánh giá thành công nhưng thiếu mức rủi ro hợp lệ vẫn nằm trong mẫu số, không được tính là đồng thuận và được đếm riêng. Quyết định có đánh giá LLM thất bại hoặc chưa có được đếm riêng, ngoài mẫu số. Đây là chỉ số mô tả, không đo độ chính xác của AI.',
}

const byId = docs => new Map(docs.map(doc => [String(doc._id), doc]))
const seconds = ms => Math.max(0, Math.floor(ms / 1000))

/** QueueItem rows with batched reads of revision, story, author and evidence batch. */
async function queueItems(submissions, account, now) {
  const [revisions, stories, authors, batches] = await Promise.all([
    ContentRevision.find({ _id: { $in: submissions.map(row => row.revisionId) } })
      .select('content.title')
      .lean(),
    Story.find({ _id: { $in: submissions.map(row => row.storyId) } })
      .select('title')
      .lean(),
    Account.find({ _id: { $in: submissions.map(row => row.authorAccountId) } })
      .select('displayName')
      .lean(),
    EvidenceBatch.find({
      _id: { $in: submissions.map(row => row.currentEvidenceBatchId).filter(Boolean) },
    })
      .select('status stage failedStage')
      .lean(),
  ])
  const revisionById = byId(revisions)
  const storyById = byId(stories)
  const authorById = byId(authors)
  const batchById = byId(batches)
  return submissions.map(row => {
    const state = claimState(row, account._id, now)
    return {
      submissionId: String(row._id),
      version: row.version,
      targetType: row.chapterId ? 'chapter' : 'story',
      title: revisionById.get(String(row.revisionId))?.content?.title ?? '',
      storyTitle: row.chapterId ? (storyById.get(String(row.storyId))?.title ?? '') : null,
      author: {
        id: String(row.authorAccountId),
        displayName: authorById.get(String(row.authorAccountId))?.displayName ?? '',
      },
      submittedAt: row.submittedAt,
      waitingSeconds: seconds(now - row.submittedAt),
      evidenceStatus: evidenceStatus(batchById.get(String(row.currentEvidenceBatchId))),
      claimState: state,
      claimExpiresAt: state === 'unclaimed' ? null : row.claimExpiresAt,
    }
  })
}

/** Live counters and short lists as of `now` (UC-MOD-08); zero counts are valid (AF1). */
export async function moderationOverview(account, now = new Date()) {
  const scope = await activeAuthorScope()
  const claimable = { ...claimableSubmissionFilter(now), ...scope }
  const ownLive = { ...ownLiveSubmissionFilter(account._id, now), ...scope }
  const decided = { action: DECIDED_ACTION, actorAccountId: account._id }
  const [counters, oldest, owned, recent] = await Promise.all([
    Promise.all([
      PublicationSubmission.countDocuments(claimable),
      PublicationSubmission.countDocuments(ownLive),
      PublicationSubmission.countDocuments({ ...processingSubmissionFilter, ...scope }),
      ModerationHistory.countDocuments({
        ...decided,
        occurredAt: { $gte: vietnamDayStart(now) },
      }),
      ContentReport.countDocuments(claimableReportFilter(now)),
    ]),
    PublicationSubmission.find(claimable).sort({ submittedAt: 1, _id: 1 }).limit(LIST_SIZE).lean(),
    PublicationSubmission.find(ownLive).sort({ claimExpiresAt: 1, _id: 1 }).limit(LIST_SIZE).lean(),
    ModerationHistory.find(decided).sort({ occurredAt: -1, _id: -1 }).limit(LIST_SIZE).lean(),
  ])
  const [items, described] = await Promise.all([
    queueItems([...owned, ...oldest], account, now),
    describeEntries(recent),
  ])
  const [claimableCount, mine, processing, decidedToday, claimableReports] = counters
  const oldestWaiting = items.slice(owned.length)
  return {
    counters: { claimable: claimableCount, mine, processing, decidedToday, claimableReports },
    oldestWaiting,
    nextItems: items.slice(0, LIST_SIZE),
    recentDecisions: recent.map(entry => ({
      historyId: String(entry._id),
      occurredAt: entry.occurredAt,
      outcome: entry.outcome,
      targetTitle: described.get(String(entry._id)).targetTitle,
    })),
    computedAt: now,
  }
}

/** Ages in seconds of every submission still waiting for review (design decision 7). */
async function queueAge(now) {
  const waiting = await PublicationSubmission.find({
    status: { $in: WAITING_STATUSES },
    ...(await activeAuthorScope()),
  })
    .select('submittedAt')
    .lean()
  const ages = waiting.map(row => seconds(now - row.submittedAt))
  return {
    count: ages.length,
    oldest: ages.length ? Math.max(...ages) : null,
    median: median(ages),
    p90: percentile(ages, 90),
  }
}

const decisionGroupField = {
  outcome: '$outcome',
  moderator: '$actorAccountId',
  targetType: '$aggregateType',
  riskLevel: '$riskLevel',
}

/**
 * Publication decisions of the period joined to their LLM review (one aggregation, 4 facets).
 * The outcome filter applies after the bucket totals, so rates keep every decision of the bucket
 * as their denominator.
 */
async function decisionFacets(period, query, actorId) {
  const outcomeOnly = query.outcome ? [{ $match: { outcome: query.outcome } }] : []
  const [facets] = await ModerationHistory.aggregate([
    {
      $match: {
        action: DECIDED_ACTION,
        outcome: { $in: DECISION_OUTCOMES },
        occurredAt: { $gte: period.from, $lt: period.to },
        ...(actorId ? { actorAccountId: actorId } : {}),
      },
    },
    {
      $lookup: {
        from: LlmReview.collection.collectionName,
        localField: 'evidenceBatchId',
        foreignField: 'batchId',
        pipeline: [{ $match: { status: 'succeeded' } }, { $project: { riskLevel: 1 } }],
        as: 'llm',
      },
    },
    {
      $set: {
        // A missing or unknown stored risk level is no risk level.
        riskLevel: {
          $let: {
            vars: { level: { $ifNull: [{ $first: '$llm.riskLevel' }, null] } },
            in: { $cond: [{ $in: ['$$level', RISK_LEVELS] }, '$$level', null] },
          },
        },
        llmStatus: { $cond: [{ $gt: [{ $size: '$llm' }, 0] }, 'succeeded', 'missing'] },
      },
    },
    ...(query.riskLevel ? [{ $match: { riskLevel: query.riskLevel } }] : []),
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: truncateExpression('$occurredAt', period.bucket),
              decisions: { $sum: 1 },
            },
          },
        ],
        buckets: [
          ...outcomeOnly,
          {
            $group: {
              _id: {
                start: truncateExpression('$occurredAt', period.bucket),
                group: decisionGroupField[query.groupBy] ?? null,
              },
              approved: { $sum: { $cond: [{ $eq: ['$outcome', 'approved'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$outcome', 'rejected'] }, 1, 0] } },
            },
          },
        ],
        moderators: [
          ...outcomeOnly,
          {
            $group: {
              _id: '$actorAccountId',
              decisions: { $sum: 1 },
              claimToDecision: {
                $push: {
                  $cond: [
                    { $gt: ['$claimAcquiredAt', null] },
                    { $subtract: ['$occurredAt', '$claimAcquiredAt'] },
                    null,
                  ],
                },
              },
            },
          },
        ],
        agreement: [
          ...outcomeOnly,
          { $project: { _id: 0, outcome: 1, riskLevel: 1, llmStatus: 1 } },
        ],
      },
    },
  ])
  return facets
}

/** Decision groups shown for every bucket, so buckets without activity show zero. */
function decisionGroups(query, moderatorIds) {
  if (query.groupBy === 'outcome') return query.outcome ? [query.outcome] : DECISION_OUTCOMES
  if (query.groupBy === 'riskLevel')
    return query.riskLevel ? [query.riskLevel] : [...RISK_LEVELS, null]
  if (query.groupBy === 'targetType') return PUBLICATION_TARGETS
  if (query.groupBy === 'moderator') return moderatorIds
  return [null]
}

const groupKey = (start, group) => `${new Date(start).toISOString()}|${group ?? ''}`

/** Reports received in the period by target type and reason (only combinations with reports). */
async function reportBuckets(period, query) {
  const rows = await ContentReport.aggregate([
    {
      $match: {
        submittedAt: { $gte: period.from, $lt: period.to },
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.reason ? { reason: query.reason } : {}),
      },
    },
    {
      $group: {
        _id: {
          start: truncateExpression('$submittedAt', period.bucket),
          targetType: '$targetType',
          reason: { $ifNull: ['$reason', 'other'] },
        },
        received: { $sum: 1 },
      },
    },
    { $sort: { '_id.start': 1, '_id.targetType': 1, '_id.reason': 1 } },
  ])
  return rows.map(({ _id, received }) => ({ ..._id, received }))
}

/**
 * Resolutions in the period by outcome, restricted by report and moderator filters. Stored
 * literals are grouped in the database and mapped to the current outcome afterwards, so legacy
 * resolutions count under the outcome they stand for.
 */
async function resolutionBuckets(period, query, actorId) {
  const rows = await ReportResolution.aggregate([
    {
      $match: {
        resolvedAt: { $gte: period.from, $lt: period.to },
        ...(actorId ? { moderatorAccountId: actorId } : {}),
      },
    },
    {
      $lookup: {
        from: ContentReport.collection.collectionName,
        localField: 'reportId',
        foreignField: '_id',
        pipeline: [{ $project: { targetType: 1, reason: 1 } }],
        as: 'report',
      },
    },
    { $unwind: '$report' },
    {
      $match: {
        ...(query.targetType ? { 'report.targetType': query.targetType } : {}),
        ...(query.reason ? { 'report.reason': query.reason } : {}),
      },
    },
    {
      $group: {
        _id: {
          start: truncateExpression('$resolvedAt', period.bucket),
          outcome: '$outcome',
          contentAction: '$contentAction',
        },
        resolved: { $sum: 1 },
      },
    },
  ])
  const merged = new Map()
  for (const { _id, resolved } of rows) {
    const { outcome } = resolutionLiterals(_id)
    if (query.resolution && outcome !== query.resolution) continue
    const key = groupKey(_id.start, outcome)
    const row = merged.get(key) ?? { start: _id.start, outcome, resolved: 0 }
    row.resolved += resolved
    merged.set(key, row)
  }
  return [...merged.values()].sort(
    (left, right) => left.start - right.start || left.outcome.localeCompare(right.outcome),
  )
}

/** Statistics over the selected period (UC-MOD-09); an invalid period computes nothing (EX1). */
export async function moderationStatistics(account, query, now = new Date()) {
  const period = range(query, now)
  const starts = buckets(period, query.bucket)
  const actorId =
    query.moderator === 'mine'
      ? account._id
      : query.moderator === 'one'
        ? new mongoose.Types.ObjectId(query.moderatorId)
        : null
  const [age, decisions, reports, resolutions] = await Promise.all([
    queueAge(now),
    decisionFacets(period, query, actorId),
    reportBuckets(period, query),
    resolutionBuckets(period, query, actorId),
  ])
  const moderatorRows = [...decisions.moderators].sort(
    (left, right) =>
      right.decisions - left.decisions || String(left._id).localeCompare(String(right._id)),
  )
  const moderators = byId(
    await Account.find({ _id: { $in: moderatorRows.map(row => row._id) } })
      .select('displayName status')
      .lean(),
  )
  const counted = new Map(
    decisions.buckets.map(({ _id, approved, rejected }) => [
      groupKey(_id.start, _id.group),
      { approved, rejected },
    ]),
  )
  const bucketTotals = new Map(
    decisions.totals.map(({ _id, decisions: total }) => [new Date(_id).toISOString(), total]),
  )
  const groups = decisionGroups(
    query,
    moderatorRows.map(row => String(row._id)),
  )
  return {
    period: { from: period.from, to: period.to, bucket: query.bucket, buckets: starts },
    queueAge: age,
    decisionBuckets: starts.flatMap(start => {
      const total = bucketTotals.get(new Date(start).toISOString()) ?? 0
      // Share of every decision in the bucket; an outcome removed by the filter has none.
      const share = (outcome, count) =>
        query.outcome && query.outcome !== outcome ? null : rate(count, total)
      return groups.map(group => {
        const { approved, rejected } = counted.get(groupKey(start, group)) ?? {
          approved: 0,
          rejected: 0,
        }
        return {
          start,
          group,
          approved,
          rejected,
          approvedRate: share('approved', approved),
          rejectedRate: share('rejected', rejected),
        }
      })
    }),
    moderatorDecisions: moderatorRows.map(row => ({
      moderator: {
        id: String(row._id),
        displayName: publicName(moderators.get(String(row._id))),
      },
      decisions: row.decisions,
      medianClaimToDecision: median(
        row.claimToDecision.filter(value => value != null).map(seconds),
      ),
    })),
    reportBuckets: reports,
    resolutionBuckets: resolutions,
    aiAgreement: agreement(decisions.agreement),
    definitions: STATISTICS_DEFINITIONS,
  }
}
