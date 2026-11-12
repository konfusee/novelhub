import mongoose from 'mongoose'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  ContentReport,
  ContentRevision,
  LlmReview,
  ModerationHistory,
  PublicationSubmission,
  ReportResolution,
} from '../src/models/index.js'
import { moderationStatistics } from '../src/modules/moderation-ai/moderation/dashboard.js'
import { vietnamDayStart } from '../src/modules/moderation-ai/moderation/period-stats.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import {
  apiClient,
  approvedStory,
  claim,
  markEvidenceReady,
  origin,
  submitStory,
} from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)

const id = () => new mongoose.Types.ObjectId()
const at = iso => new Date(iso)
const iso = dates => dates.map(date => new Date(date).toISOString())
const vietnamDay = date => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10)
const ROUTES = [
  '/api/moderator/overview',
  '/api/moderator/statistics',
  '/api/moderator/history',
  `/api/moderator/history/${'a'.repeat(24)}`,
]

function decision(actor, occurredAt, outcome, extra = {}) {
  return {
    aggregateType: 'story',
    aggregateId: id(),
    action: 'manual-review.decided',
    outcome,
    submissionId: id(),
    revisionId: id(),
    evidenceBatchId: id(),
    actorAccountId: actor.account._id,
    occurredAt,
    ...extra,
  }
}

describe('moderation dashboard role guard', () => {
  it('requires a signed-in moderator on every dashboard route', async () => {
    const reader = await authenticatedAccount()
    const author = await authenticatedAccount('author')
    for (const route of ROUTES) {
      expect((await request(app).get(route)).status).toBe(401)
      expect((await api.get(reader.cookie, route)).status).toBe(403)
      expect((await api.get(author.cookie, route)).status).toBe(403)
    }
  })
})

describe('GET /api/moderator/overview (UC-MOD-08)', () => {
  it('returns zero counters and empty lists when nothing waits (AF1)', async () => {
    const moderator = await authenticatedAccount('moderator')
    const response = await api.get(moderator.cookie, '/api/moderator/overview')
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.body).toMatchObject({
      counters: { claimable: 0, mine: 0, processing: 0, decidedToday: 0, claimableReports: 0 },
      oldestWaiting: [],
      nextItems: [],
      recentDecisions: [],
    })
    expect(Date.parse(response.body.computedAt)).not.toBeNaN()
  })

  it('counts live work, lists waiting age and puts my live claims first', async () => {
    const me = await authenticatedAccount('moderator')
    const other = await authenticatedAccount('moderator')
    const author = await authenticatedAccount('author')
    const ready = []
    for (const title of ['Hồ sơ lâu nhất', 'Hồ sơ tôi giữ', 'Hồ sơ người khác giữ']) {
      const { submissionId } = await submitStory(api, { author, title })
      await markEvidenceReady(submissionId)
      ready.push(submissionId)
    }
    await submitStory(api, { author, title: 'Đang chờ AI' })
    const suspended = await submitStory(api, { title: 'Tác giả bị khóa' })
    await markEvidenceReady(suspended.submissionId)
    await Account.updateOne({ _id: suspended.author.account._id }, { status: 'suspended' })
    const now = Date.now()
    for (const [index, submissionId] of ready.entries())
      await PublicationSubmission.updateOne(
        { _id: submissionId },
        { submittedAt: new Date(now - (3 - index) * 3600000) },
      )
    const [oldest, mine, others] = ready
    expect((await claim(api, other, oldest)).status).toBe(200)
    await PublicationSubmission.updateOne(
      { _id: oldest },
      { claimExpiresAt: new Date(now - 60000) },
    )
    expect((await claim(api, me, mine)).status).toBe(200)
    expect((await claim(api, other, others)).status).toBe(200)

    const dayStart = vietnamDayStart(new Date())
    const revisionId = (await PublicationSubmission.findById(oldest)).revisionId
    await ModerationHistory.create([
      decision(me, dayStart, 'approved', { revisionId }),
      decision(me, new Date(dayStart.getTime() - 1), 'rejected', { revisionId }),
      decision(other, dayStart, 'approved'),
    ])
    const reporter = await authenticatedAccount()
    const report = (status, claimed) => ({
      reporterAccountId: reporter.account._id,
      targetType: 'story',
      targetId: id(),
      reason: 'spam',
      status,
      ...(claimed
        ? { claimOwnerAccountId: other.account._id, claimExpiresAt: new Date(now + claimed) }
        : {}),
    })
    await ContentReport.create([
      report('open'),
      report('under-review', 3600000),
      report('under-review', -60000),
      report('dismissed'),
    ])

    const response = await api.get(me.cookie, '/api/moderator/overview')
    expect(response.status).toBe(200)
    const body = response.body
    expect(body.counters).toEqual({
      claimable: 1,
      mine: 1,
      processing: 1,
      decidedToday: 1,
      claimableReports: 2,
    })
    expect(body.oldestWaiting).toHaveLength(1)
    expect(body.oldestWaiting[0]).toMatchObject({
      submissionId: oldest,
      targetType: 'story',
      title: 'Hồ sơ lâu nhất',
      evidenceStatus: 'ready',
      claimState: 'expired',
    })
    expect(Math.abs(body.oldestWaiting[0].waitingSeconds - 3 * 3600)).toBeLessThan(30)
    expect(body.nextItems.map(item => [item.submissionId, item.claimState])).toEqual([
      [mine, 'mine'],
      [oldest, 'expired'],
    ])
    expect(Date.parse(body.nextItems[0].claimExpiresAt)).toBeGreaterThan(now)
    expect(body.recentDecisions.map(item => [item.outcome, item.targetTitle])).toEqual([
      ['approved', 'Hồ sơ lâu nhất'],
      ['rejected', 'Hồ sơ lâu nhất'],
    ])
    // The claimable-report counter matches the Reports queue when I hold no report claim.
    const queue = await api.get(me.cookie, '/api/moderator/reports?view=queue')
    expect(queue.status).toBe(200)
    expect(queue.body.total).toBe(body.counters.claimableReports)
  })
})

describe('moderation statistics (UC-MOD-09)', () => {
  // Wednesday 2026-11-11 12:00 in Vietnam; last7 covers 5–11 November (Vietnam days).
  const NOW = at('2026-11-11T05:00:00Z')
  const base = { period: 'last7', bucket: 'day', moderator: 'all' }

  async function seed() {
    const a = await authenticatedAccount('moderator')
    const b = await authenticatedAccount('moderator')
    const author = await authenticatedAccount('author')
    const blocked = await authenticatedAccount('author', { status: 'suspended' })
    const waiting = (account, status, hoursAgo) => ({
      storyId: id(),
      revisionId: id(),
      authorAccountId: account.account._id,
      status,
      submittedAt: new Date(NOW.getTime() - hoursAgo * 3600000),
    })
    await PublicationSubmission.create([
      waiting(author, 'pending-review', 1),
      waiting(author, 'decision-pending', 2),
      waiting(author, 'pending-review', 3),
      waiting(author, 'pending-review', 10),
      waiting(author, 'validated', 50),
      waiting(author, 'approved', 70),
      waiting(blocked, 'pending-review', 100),
    ])
    const claimedBefore = (date, seconds) => new Date(date.getTime() - seconds * 1000)
    const d1 = at('2026-11-10T16:59:59Z') // 10 Nov 23:59:59 in Vietnam
    const d2 = at('2026-11-10T17:00:00Z') // 11 Nov 00:00 in Vietnam
    const d3 = at('2026-11-04T17:00:00Z') // 5 Nov 00:00, first instant of the period
    const d4 = at('2026-11-04T16:59:59Z') // 4 Nov, outside the period
    const d5 = at('2026-11-06T03:00:00Z') // 6 Nov 10:00
    const rows = [
      decision(a, d1, 'approved', { claimAcquiredAt: claimedBefore(d1, 600) }),
      decision(a, d2, 'rejected', {
        aggregateType: 'chapter',
        claimAcquiredAt: claimedBefore(d2, 1800),
      }),
      decision(b, d3, 'approved'),
      decision(b, d4, 'approved'),
      decision(b, d5, 'rejected', { claimAcquiredAt: claimedBefore(d5, 3600) }),
      {
        ...decision(b, d5, 'cancelled'),
        action: 'submission.cancelled',
      },
    ]
    await ModerationHistory.create(rows)
    const review = (row, status, riskLevel) => ({
      batchId: row.evidenceBatchId,
      revisionId: row.revisionId,
      status,
      ...(riskLevel ? { riskLevel } : {}),
    })
    await LlmReview.create([
      review(rows[0], 'succeeded', 'low'),
      review(rows[1], 'succeeded', 'high'),
      review(rows[2], 'failed'),
      review(rows[4], 'succeeded', 'low'),
    ])
    const reporter = await authenticatedAccount()
    const report = (targetType, reason, submittedAt) => ({
      _id: id(),
      reporterAccountId: reporter.account._id,
      targetType,
      targetId: id(),
      reason,
      status: 'open',
      submittedAt: at(submittedAt),
    })
    const reports = [
      report('story', 'spam', '2026-11-10T16:59:59Z'),
      report('comment', 'harassment', '2026-11-10T17:00:00Z'),
      report('comment', 'harassment', '2026-11-10T18:00:00Z'),
      report('chapter', 'spam', '2026-11-04T16:00:00Z'),
    ]
    await ContentReport.create(reports)
    await ReportResolution.create({
      reportId: reports[1]._id,
      moderatorAccountId: a.account._id,
      outcome: 'comment-hidden',
      contentAction: 'hide-comment',
      reason: 'Ngôn từ quấy rối.',
      contentChanged: true,
      resolvedAt: at('2026-11-10T17:30:00Z'),
      historyId: id(),
    })
    // Resolutions recorded before the current literals (append-only, never rewritten).
    await ReportResolution.collection.insertMany([
      {
        reportId: reports[0]._id,
        moderatorAccountId: b.account._id,
        outcome: 'unpublished',
        contentAction: 'unpublish-story',
        reason: 'Vi phạm quy định.',
        resolvedAt: at('2026-11-10T10:00:00Z'),
        historyId: id(),
      },
      {
        reportId: reports[2]._id,
        moderatorAccountId: b.account._id,
        outcome: 'hidden',
        contentAction: 'hide-comment',
        reason: 'Ngôn từ quấy rối.',
        resolvedAt: at('2026-11-10T18:00:00Z'),
        historyId: id(),
      },
    ])
    return { a, b }
  }

  it('computes queue age, decision buckets at Vietnam midnight, rates and moderators', async () => {
    const { a, b } = await seed()
    const stats = await moderationStatistics(a.account, base, NOW)
    expect(stats.period.from.toISOString()).toBe('2026-11-04T17:00:00.000Z')
    expect(stats.period.to).toBe(NOW)
    expect(iso(stats.period.buckets)).toHaveLength(7)
    expect(stats.queueAge).toEqual({ count: 4, oldest: 36000, median: 9000, p90: 36000 })
    const byDay = Object.fromEntries(
      stats.decisionBuckets.map(row => [new Date(row.start).toISOString().slice(0, 10), row]),
    )
    expect(Object.keys(byDay)).toHaveLength(7)
    expect(byDay['2026-11-04']).toMatchObject({ approved: 1, rejected: 0, approvedRate: 100 })
    expect(byDay['2026-11-05']).toMatchObject({ approved: 0, rejected: 1, rejectedRate: 100 })
    expect(byDay['2026-11-09']).toMatchObject({ approved: 1, rejected: 0 })
    expect(byDay['2026-11-10']).toMatchObject({ approved: 0, rejected: 1 })
    expect(byDay['2026-11-07']).toEqual({
      start: at('2026-11-07T17:00:00Z'),
      group: null,
      approved: 0,
      rejected: 0,
      approvedRate: null,
      rejectedRate: null,
    })
    const moderators = Object.fromEntries(
      stats.moderatorDecisions.map(row => [row.moderator.id, row]),
    )
    expect(moderators[String(a.account._id)]).toMatchObject({
      decisions: 2,
      medianClaimToDecision: 1200,
    })
    expect(moderators[String(b.account._id)]).toMatchObject({
      decisions: 2,
      medianClaimToDecision: 3600,
    })
    expect(stats.aiAgreement).toEqual({
      overall: 66.7,
      byRiskLevel: { low: 50, medium: null, high: 100 },
      qualifying: 3,
      agreeing: 2,
      succeededWithoutRiskLevel: 0,
      withoutLlmReview: 1,
    })
    expect(Object.keys(stats.definitions).sort()).toEqual([
      'aiAgreement',
      'decisionBuckets',
      'moderatorDecisions',
      'queueAge',
      'reportBuckets',
      'resolutionBuckets',
    ])
  })

  it('rates each outcome against every decision of the bucket, grouped or not (M3)', async () => {
    const { a, b } = await seed()
    const rates = rows =>
      rows.map(row => [row.group, row.approved, row.rejected, row.approvedRate, row.rejectedRate])
    // Each week holds one approval and one rejection: 50% each.
    const weekly = await moderationStatistics(a.account, { ...base, bucket: 'week' }, NOW)
    expect(iso(weekly.period.buckets)).toEqual([
      '2026-11-01T17:00:00.000Z',
      '2026-11-08T17:00:00.000Z',
    ])
    expect(rates(weekly.decisionBuckets)).toEqual([
      [null, 1, 1, 50, 50],
      [null, 1, 1, 50, 50],
    ])
    const byOutcome = await moderationStatistics(
      a.account,
      { ...base, bucket: 'week', groupBy: 'outcome' },
      NOW,
    )
    expect(rates(byOutcome.decisionBuckets)).toEqual([
      ['approved', 1, 0, 50, 0],
      ['rejected', 0, 1, 0, 50],
      ['approved', 1, 0, 50, 0],
      ['rejected', 0, 1, 0, 50],
    ])
    // The outcome filter keeps the bucket total as the denominator; the other outcome has no rate.
    const approvedOnly = await moderationStatistics(
      a.account,
      { ...base, bucket: 'week', groupBy: 'outcome', outcome: 'approved' },
      NOW,
    )
    expect(rates(approvedOnly.decisionBuckets)).toEqual([
      ['approved', 1, 0, 50, null],
      ['approved', 1, 0, 50, null],
    ])
    const byRisk = await moderationStatistics(
      a.account,
      { ...base, bucket: 'week', groupBy: 'riskLevel' },
      NOW,
    )
    expect(
      byRisk.decisionBuckets
        .filter(row => row.approved + row.rejected)
        .map(row => [new Date(row.start).toISOString(), ...rates([row])[0]]),
    ).toEqual([
      ['2026-11-01T17:00:00.000Z', 'low', 0, 1, 0, 50],
      ['2026-11-01T17:00:00.000Z', null, 1, 0, 50, 0],
      ['2026-11-08T17:00:00.000Z', 'low', 1, 0, 50, 0],
      ['2026-11-08T17:00:00.000Z', 'high', 0, 1, 0, 50],
    ])
    // One month bucket holds the four decisions; each moderator made one of each.
    const byModerator = await moderationStatistics(
      a.account,
      { ...base, bucket: 'month', groupBy: 'moderator' },
      NOW,
    )
    expect(
      Object.fromEntries(
        rates(byModerator.decisionBuckets).map(([group, ...rest]) => [group, rest]),
      ),
    ).toEqual({
      [String(a.account._id)]: [1, 1, 25, 25],
      [String(b.account._id)]: [1, 1, 25, 25],
    })
  })

  it('keeps succeeded LLM reviews without a valid risk level in the agreement denominator', async () => {
    const moderator = await authenticatedAccount('moderator')
    const when = at('2026-11-10T03:00:00Z')
    const rows = [
      decision(moderator, when, 'approved'),
      decision(moderator, when, 'rejected'),
      decision(moderator, when, 'rejected'),
      decision(moderator, when, 'approved'),
    ]
    await ModerationHistory.create(rows)
    const review = (row, status, extra = {}) => ({
      batchId: row.evidenceBatchId,
      revisionId: row.revisionId,
      status,
      ...extra,
    })
    await LlmReview.create([
      review(rows[0], 'succeeded', { riskLevel: 'low' }),
      review(rows[1], 'succeeded'),
      review(rows[3], 'failed'),
    ])
    // A stored level outside the enumeration, written before validation existed.
    await LlmReview.collection.insertOne(review(rows[2], 'succeeded', { riskLevel: 'critical' }))
    const stats = await moderationStatistics(moderator.account, base, NOW)
    expect(stats.aiAgreement).toEqual({
      overall: 33.3,
      byRiskLevel: { low: 100, medium: null, high: null },
      qualifying: 3,
      agreeing: 1,
      succeededWithoutRiskLevel: 2,
      withoutLlmReview: 1,
    })
    const byRisk = await moderationStatistics(
      moderator.account,
      { ...base, groupBy: 'riskLevel' },
      NOW,
    )
    expect(
      byRisk.decisionBuckets
        .filter(row => row.approved + row.rejected)
        .map(row => [row.group, row.approved, row.rejected]),
    ).toEqual([
      ['low', 1, 0],
      [null, 1, 2],
    ])
  })

  it('filters decisions by moderator, outcome and risk level', async () => {
    const { a, b } = await seed()
    const mine = await moderationStatistics(a.account, { ...base, moderator: 'mine' }, NOW)
    expect(mine.moderatorDecisions.map(row => row.moderator.id)).toEqual([String(a.account._id)])
    expect(mine.aiAgreement).toMatchObject({ overall: 100, qualifying: 2, withoutLlmReview: 0 })
    const one = await moderationStatistics(
      a.account,
      { ...base, moderator: 'one', moderatorId: String(b.account._id) },
      NOW,
    )
    expect(one.moderatorDecisions.map(row => row.moderator.id)).toEqual([String(b.account._id)])
    expect(one.aiAgreement).toMatchObject({ overall: 0, qualifying: 1, withoutLlmReview: 1 })
    const rejected = await moderationStatistics(
      a.account,
      { ...base, bucket: 'week', outcome: 'rejected' },
      NOW,
    )
    expect(
      rejected.decisionBuckets.map(row => [
        row.approved,
        row.rejected,
        row.approvedRate,
        row.rejectedRate,
      ]),
    ).toEqual([
      [0, 1, null, 50],
      [0, 1, null, 50],
    ])
    expect(rejected.aiAgreement).toMatchObject({ qualifying: 2, agreeing: 1 })
    const low = await moderationStatistics(a.account, { ...base, riskLevel: 'low' }, NOW)
    expect(low.aiAgreement).toMatchObject({ qualifying: 2, agreeing: 1, withoutLlmReview: 0 })
  })

  it('counts reports received by target and reason, and resolutions by outcome', async () => {
    const { a } = await seed()
    const stats = await moderationStatistics(a.account, base, NOW)
    expect(stats.reportBuckets).toEqual([
      { start: at('2026-11-09T17:00:00Z'), targetType: 'story', reason: 'spam', received: 1 },
      {
        start: at('2026-11-10T17:00:00Z'),
        targetType: 'comment',
        reason: 'harassment',
        received: 2,
      },
    ])
    // Legacy 'unpublished' and 'hidden' rows count under the current outcomes.
    expect(stats.resolutionBuckets).toEqual([
      { start: at('2026-11-09T17:00:00Z'), outcome: 'story-unpublished', resolved: 1 },
      { start: at('2026-11-10T17:00:00Z'), outcome: 'comment-hidden', resolved: 2 },
    ])
    const comments = await moderationStatistics(a.account, { ...base, targetType: 'comment' }, NOW)
    expect(comments.reportBuckets.map(row => row.targetType)).toEqual(['comment'])
    expect(comments.resolutionBuckets.map(row => row.outcome)).toEqual(['comment-hidden'])
    const hidden = await moderationStatistics(
      a.account,
      { ...base, resolution: 'comment-hidden', moderator: 'mine' },
      NOW,
    )
    expect(hidden.resolutionBuckets).toEqual([
      { start: at('2026-11-10T17:00:00Z'), outcome: 'comment-hidden', resolved: 1 },
    ])
    const spam = await moderationStatistics(a.account, { ...base, reason: 'spam' }, NOW)
    expect(spam.reportBuckets.map(row => row.reason)).toEqual(['spam'])
    expect(spam.resolutionBuckets.map(row => row.outcome)).toEqual(['story-unpublished'])
  })

  it('shows zero counts and an unavailable agreement rate for an idle period (AF2)', async () => {
    const moderator = await authenticatedAccount('moderator')
    const response = await api.get(
      moderator.cookie,
      '/api/moderator/statistics?period=last7&bucket=week',
    )
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.body.queueAge).toEqual({ count: 0, oldest: null, median: null, p90: null })
    expect(response.body.decisionBuckets.length).toBeGreaterThan(0)
    for (const row of response.body.decisionBuckets)
      expect(row).toMatchObject({ approved: 0, rejected: 0, approvedRate: null })
    expect(response.body.aiAgreement).toMatchObject({ overall: null, qualifying: 0 })
    expect(response.body.reportBuckets).toEqual([])
    expect(response.body.resolutionBuckets).toEqual([])
    expect(typeof response.body.definitions.aiAgreement).toBe('string')
  })

  it('rejects invalid periods and filters with 422', async () => {
    const moderator = await authenticatedAccount('moderator')
    const today = vietnamDay(new Date())
    const tomorrow = vietnamDay(new Date(Date.now() + 86400000))
    const get = query => api.get(moderator.cookie, `/api/moderator/statistics?${query}`)
    for (const query of [
      'period=custom&from=2026-11-05&to=2026-11-01',
      `period=custom&from=${today}&to=${tomorrow}`,
    ]) {
      const response = await get(query)
      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('invalid_period')
    }
    for (const query of [
      'period=custom&from=2026-11-01',
      'period=last7&from=2026-11-01&to=2026-11-02',
      'period=custom&from=2026-02-30&to=2026-03-01',
      'period=yesterday',
      'bucket=year',
      'moderator=one',
      `moderator=all&moderatorId=${'a'.repeat(24)}`,
      'riskLevel=extreme',
      'resolution=hidden',
      'groupBy=author',
      'groupBy=reason',
      'groupBy=resolution',
      'unknown=1',
    ]) {
      const response = await get(query)
      expect(response.status, query).toBe(422)
      expect(response.body.error.code).toBe('validation_error')
    }
    expect((await get(`period=custom&from=${today}&to=${today}`)).status).toBe(200)
  })
})

describe('a real decision across overview, statistics and history', () => {
  it('records the claim time so the claim-to-decision median is available', async () => {
    const moderator = await authenticatedAccount('moderator')
    await approvedStory(api, moderator, { title: 'Truyện đã duyệt thật' })
    const overview = (await api.get(moderator.cookie, '/api/moderator/overview')).body
    expect(overview.counters.decidedToday).toBe(1)
    expect(overview.recentDecisions).toMatchObject([
      { outcome: 'approved', targetTitle: 'Truyện đã duyệt thật' },
    ])
    const stats = await api.get(moderator.cookie, '/api/moderator/statistics?period=last7')
    expect(stats.status).toBe(200)
    expect(stats.body.moderatorDecisions).toEqual([
      {
        moderator: { id: String(moderator.account._id), displayName: 'Test moderator' },
        decisions: 1,
        medianClaimToDecision: expect.any(Number),
      },
    ])
    expect(stats.body.aiAgreement).toMatchObject({ qualifying: 0, withoutLlmReview: 1 })
    const history = await api.get(moderator.cookie, '/api/moderator/history?scope=mine')
    expect(history.body.items).toMatchObject([
      { caseType: 'publication', outcome: 'approved', targetTitle: 'Truyện đã duyệt thật' },
    ])
  })
})

describe('moderation history (UC-MOD-07)', () => {
  async function seed() {
    const a = await authenticatedAccount('moderator', { displayName: 'Kiểm duyệt viên A' })
    const b = await authenticatedAccount('moderator', { displayName: 'Kiểm duyệt viên B' })
    const admin = await authenticatedAccount('admin')
    const reporter = await authenticatedAccount()
    const { submissionId } = await submitStory(api)
    const { submission } = await markEvidenceReady(submissionId, { failedStage: 'llm' })
    const publication = {
      aggregateType: 'story',
      aggregateId: submission.storyId,
      submissionId: submission._id,
      revisionId: submission.revisionId,
      evidenceBatchId: submission.currentEvidenceBatchId,
    }
    const comment = await ContentReport.create({
      reporterAccountId: reporter.account._id,
      targetType: 'comment',
      targetId: id(),
      reason: 'harassment',
      details: 'Lời lẽ xúc phạm',
      status: 'actioned',
      targetSnapshot: { body: 'Bình luận xấu', authorId: String(id()) },
    })
    const chapter = await ContentReport.create({
      reporterAccountId: reporter.account._id,
      targetType: 'chapter',
      targetId: id(),
      reason: 'spam',
      status: 'actioned',
      targetSnapshot: { title: 'Chương một', excerpt: 'Mở đầu.' },
    })
    const [approved, rejected, cancelled, hidden, unpublished] = await ModerationHistory.create([
      {
        ...publication,
        action: 'manual-review.decided',
        outcome: 'approved',
        actorAccountId: a.account._id,
        occurredAt: at('2026-11-09T17:00:00Z'), // 10 Nov 00:00 in Vietnam
      },
      {
        ...publication,
        action: 'manual-review.decided',
        outcome: 'rejected',
        feedback: 'Cần sửa phần tóm tắt.',
        reason: 'Cần sửa phần tóm tắt.',
        actorAccountId: b.account._id,
        occurredAt: at('2026-11-10T16:59:59Z'), // 10 Nov 23:59:59
      },
      {
        ...publication,
        aggregateType: 'PublicationSubmission',
        aggregateId: submission._id,
        action: 'submission.cancelled',
        outcome: 'cancelled',
        reason: 'account-deleted',
        actorAccountId: admin.account._id,
        occurredAt: at('2026-11-08T10:00:00Z'),
      },
      {
        aggregateType: 'ContentReport',
        aggregateId: comment._id,
        action: 'report.resolved',
        outcome: 'comment-hidden',
        reason: 'Ngôn từ quấy rối.',
        actorAccountId: a.account._id,
        occurredAt: at('2026-11-10T17:00:00Z'), // 11 Nov 00:00
      },
      {
        aggregateType: 'ContentReport',
        aggregateId: chapter._id,
        action: 'report.resolved',
        outcome: 'unpublished',
        reason: 'Nội dung rác.',
        actorAccountId: b.account._id,
        occurredAt: at('2026-11-07T05:00:00Z'),
      },
    ])
    await ReportResolution.create({
      reportId: comment._id,
      moderatorAccountId: a.account._id,
      outcome: 'comment-hidden',
      contentAction: 'hide-comment',
      reason: 'Ngôn từ quấy rối.',
      contentChanged: true,
      resolvedAt: hidden.occurredAt,
      historyId: hidden._id,
    })
    await ReportResolution.collection.insertOne({
      reportId: chapter._id,
      moderatorAccountId: b.account._id,
      outcome: 'unpublished',
      contentAction: 'unpublish-chapter',
      reason: 'Nội dung rác.',
      resolvedAt: unpublished.occurredAt,
      historyId: unpublished._id,
    })
    return { a, submission, comment, chapter, approved, rejected, cancelled, hidden, unpublished }
  }
  const list = (account, query = '') => api.get(account.cookie, `/api/moderator/history${query}`)
  const ids = response => response.body.items.map(item => item.historyId)

  it('lists decisions, cancellations and resolutions of all moderators, newest first', async () => {
    const f = await seed()
    const response = await list(f.a)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 5 })
    expect(ids(response)).toEqual(
      [f.hidden, f.rejected, f.approved, f.cancelled, f.unpublished].map(entry =>
        String(entry._id),
      ),
    )
    const [hidden, rejected] = response.body.items
    expect(hidden).toMatchObject({
      caseType: 'report',
      targetType: 'comment',
      targetTitle: 'Bình luận xấu',
      outcome: 'comment-hidden',
      feedbackOrReason: 'Ngôn từ quấy rối.',
      moderator: { id: String(f.a.account._id), displayName: 'Kiểm duyệt viên A' },
    })
    expect(rejected).toMatchObject({
      caseType: 'publication',
      targetType: 'story',
      targetTitle: 'Truyện chờ kiểm duyệt',
      outcome: 'rejected',
      feedbackOrReason: 'Cần sửa phần tóm tắt.',
    })
  })

  it('filters by case type, outcome, scope and Vietnam date range', async () => {
    const f = await seed()
    const reports = await list(f.a, '?caseType=report')
    expect(ids(reports)).toEqual([String(f.hidden._id), String(f.unpublished._id)])
    expect(reports.body.items[1]).toMatchObject({
      targetType: 'chapter',
      targetTitle: 'Chương một',
      outcome: 'chapter-unpublished',
    })
    const cancelled = await list(f.a, '?caseType=publication&outcome=cancelled')
    expect(ids(cancelled)).toEqual([String(f.cancelled._id)])
    expect(cancelled.body.items[0].feedbackOrReason).toBe('account-deleted')
    expect(ids(await list(f.a, '?outcome=chapter-unpublished'))).toEqual([
      String(f.unpublished._id),
    ])
    expect(ids(await list(f.a, '?outcome=comment-hidden'))).toEqual([String(f.hidden._id)])
    expect(ids(await list(f.a, '?scope=mine'))).toEqual([
      String(f.hidden._id),
      String(f.approved._id),
    ])
    expect(ids(await list(f.a, '?from=2026-11-10&to=2026-11-10'))).toEqual([
      String(f.rejected._id),
      String(f.approved._id),
    ])
    const empty = await list(f.a, '?outcome=author-warned')
    expect(empty.status).toBe(200)
    expect(empty.body).toMatchObject({ items: [], total: 0 })
    expect((await list(f.a, '?page=2')).body).toMatchObject({ items: [], total: 5, page: 2 })
  })

  it('rejects invalid filters with 422 (EX1)', async () => {
    const moderator = await authenticatedAccount('moderator')
    for (const query of [
      '?caseType=publication&outcome=dismissed',
      '?caseType=report&outcome=approved',
      '?from=2026-11-10&to=2026-11-09',
      '?from=2026-13-01',
      '?page=0',
      '?scope=team',
      '?outcome=hidden',
      '?sort=asc',
    ]) {
      const response = await list(moderator, query)
      expect(response.status, query).toBe(422)
      expect(response.body.error.code).toBe('validation_error')
    }
  })

  it('shows the reviewed revision and evidence state of a publication entry', async () => {
    const f = await seed()
    const response = await api.get(f.a.cookie, `/api/moderator/history/${f.approved._id}`)
    const revision = await ContentRevision.findById(f.submission.revisionId)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      historyId: String(f.approved._id),
      caseType: 'publication',
      outcome: 'approved',
      targetTitle: 'Truyện chờ kiểm duyệt',
      report: null,
      publication: {
        submissionId: String(f.submission._id),
        revisionId: String(f.submission.revisionId),
        revisionNumber: revision.revisionNumber,
        revisionStatus: 'submitted',
        evidenceStatus: 'failed',
        failedStage: 'llm',
      },
    })
  })

  it('shows the snapshot, action and content change of report entries, legacy rows included', async () => {
    const f = await seed()
    const hidden = await api.get(f.a.cookie, `/api/moderator/history/${f.hidden._id}`)
    expect(hidden.status).toBe(200)
    expect(hidden.body).toMatchObject({
      caseType: 'report',
      publication: null,
      report: {
        reportId: String(f.comment._id),
        reason: 'harassment',
        details: 'Lời lẽ xúc phạm',
        snapshot: { body: 'Bình luận xấu' },
        action: 'hide-comment',
        contentChanged: true,
      },
    })
    const legacy = await api.get(f.a.cookie, `/api/moderator/history/${f.unpublished._id}`)
    expect(legacy.body).toMatchObject({
      outcome: 'chapter-unpublished',
      report: {
        reportId: String(f.chapter._id),
        action: 'unpublish-chapter',
        contentChanged: null,
      },
    })
  })

  it('returns 404 for unknown or non-moderation entries and 422 for a malformed id', async () => {
    const f = await seed()
    const submitted = await ModerationHistory.findOne({ action: 'submitted' })
    expect(submitted).toBeTruthy()
    for (const historyId of [String(submitted._id), String(id())]) {
      const response = await api.get(f.a.cookie, `/api/moderator/history/${historyId}`)
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('not_found')
    }
    expect((await api.get(f.a.cookie, '/api/moderator/history/not-an-id')).status).toBe(422)
  })
})
