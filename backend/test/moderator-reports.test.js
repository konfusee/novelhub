import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Chapter,
  Comment,
  ContentReport,
  ModerationHistory,
  Notification,
  ReportResolution,
  Story,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { publishedStory } from './fixtures/community.js'
import { apiClient, origin } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)

async function fixture() {
  const published = await publishedStory({
    chapters: [
      { title: 'Chương một', paragraphs: ['Mở đầu.'] },
      { title: 'Chương hai', paragraphs: ['Tiếp theo.'] },
    ],
  })
  const commenter = await authenticatedAccount()
  const reporter = await authenticatedAccount()
  const moderator = await authenticatedAccount('moderator')
  const comment = (
    await api.write(commenter.cookie, `/api/community/stories/${published.storyId}/comments`, {
      body: 'Bình luận xấu',
    })
  ).body.comment
  return { ...published, commenter, reporter, moderator, comment }
}

async function submit(reporter, targetType, targetId, reason = 'spam') {
  const response = await api.write(reporter.cookie, '/api/community/reports', {
    targetType,
    targetId,
    reason,
  })
  expect(response.status).toBe(201)
  return response.body.report.id
}

const versionOf = async id => (await ContentReport.findById(id)).version
const claim = async (moderator, id) =>
  api.write(moderator.cookie, `/api/moderator/reports/${id}/claim`, {
    expectedVersion: await versionOf(id),
  })
const resolve = async (moderator, id, action, reason = 'Vi phạm quy định cộng đồng.') =>
  api.write(moderator.cookie, `/api/moderator/reports/${id}/resolve`, {
    action,
    reason,
    expectedVersion: await versionOf(id),
  })
async function claimAndResolve(moderator, id, action) {
  expect((await claim(moderator, id)).status).toBe(200)
  const resolved = await resolve(moderator, id, action)
  expect(resolved.status).toBe(200)
  return resolved.body.report
}

async function expectRecords(reportId, { outcome, contentAction, moderator }) {
  const report = await ContentReport.findById(reportId).lean()
  const resolution = await ReportResolution.findOne({ reportId }).lean()
  expect(resolution).toMatchObject({ outcome, contentAction, targetHash: report.targetHash })
  expect(String(report.resolutionId)).toBe(String(resolution._id))
  expect(report.claimOwnerAccountId).toBeUndefined()
  const history = await ModerationHistory.findById(resolution.historyId).lean()
  expect(history).toMatchObject({
    aggregateType: 'ContentReport',
    action: 'report.resolved',
    outcome,
  })
  expect(String(history.aggregateId)).toBe(reportId)
  expect(String(history.actorAccountId)).toBe(String(moderator.account._id))
  const audit = await AuditEvent.find({ targetId: reportId, action: 'report.resolved' }).lean()
  expect(audit).toHaveLength(1)
  expect(audit[0].result).toBe(outcome)
  return report
}

describe('moderator report queue', () => {
  it('guards the routes by role', async () => {
    const reader = await authenticatedAccount()
    expect((await request(app).get('/api/moderator/reports')).status).toBe(401)
    expect((await api.get(reader.cookie, '/api/moderator/reports')).status).toBe(403)
  })

  it('lists reports by tab and keeps claims exclusive until they expire', async () => {
    const f = await fixture()
    const other = await authenticatedAccount('moderator')
    const id = await submit(f.reporter, 'comment', f.comment.id, 'harassment')
    await submit(await authenticatedAccount(), 'comment', f.comment.id)

    const summary = await api.get(f.moderator.cookie, '/api/moderator/summary')
    expect(summary.body.openReports).toBe(2)
    const open = (await api.get(f.moderator.cookie, '/api/moderator/reports?status=open')).body
    expect(open.counts).toEqual({ open: 2, mine: 0, resolved: 0 })
    const row = open.items.find(item => item.id === id)
    expect(row).toMatchObject({
      targetType: 'comment',
      reason: 'harassment',
      status: 'open',
      reporter: { displayName: 'Test reader' },
      snapshot: { body: 'Bình luận xấu' },
      target: { available: true, storyId: f.storyId, currentStatus: 'visible' },
      sameTargetOpen: 1,
      claim: null,
      resolution: null,
      allowedActions: ['dismiss', 'hide-comment'],
    })

    const claimed = await claim(f.moderator, id)
    expect(claimed.status).toBe(200)
    expect(claimed.body.report).toMatchObject({
      status: 'under-review',
      claim: { mine: true, owner: 'Test moderator' },
    })
    const taken = await claim(other, id)
    expect(taken.status).toBe(409)
    expect(taken.body.error.code).toBe('claimed')
    expect((await resolve(other, id, 'dismiss')).body.error.code).toBe('claim_required')

    const mine = (await api.get(f.moderator.cookie, '/api/moderator/reports?status=mine')).body
    expect(mine.counts).toEqual({ open: 1, mine: 1, resolved: 0 })
    const othersView = (await api.get(other.cookie, '/api/moderator/reports')).body
    expect(othersView.counts.open).toBe(2)
    expect(othersView.items.find(item => item.id === id).claim).toMatchObject({ mine: false })
    expect((await api.get(other.cookie, '/api/moderator/summary')).body.openReports).toBe(1)

    await ContentReport.updateOne({ _id: id }, { claimExpiresAt: new Date(Date.now() - 1000) })
    const reclaimed = await claim(other, id)
    expect(reclaimed.status).toBe(200)
    expect(reclaimed.body.report.claim).toMatchObject({ mine: true })
    const history = (await ContentReport.findById(id)).claimReleaseHistory
    expect(history.at(-1)).toMatchObject({ reason: 'expired' })
    expect(
      (
        await api.write(f.moderator.cookie, `/api/moderator/reports/${id}/release`, {
          expectedVersion: await versionOf(id),
        })
      ).body.error.code,
    ).toBe('claim_required')
    const stale = await api.write(other.cookie, `/api/moderator/reports/${id}/release`, {
      expectedVersion: 0,
    })
    expect(stale.body.error.code).toBe('report_changed')
    const released = await api.write(other.cookie, `/api/moderator/reports/${id}/release`, {
      expectedVersion: await versionOf(id),
    })
    expect(released.status).toBe(200)
    expect(released.body.report).toMatchObject({ status: 'open', claim: null })
  })

  it('hides a reported comment and notifies its author and the reporter', async () => {
    const f = await fixture()
    const id = await submit(f.reporter, 'comment', f.comment.id)
    const report = await claimAndResolve(f.moderator, id, 'hide-comment')
    expect(report).toMatchObject({
      status: 'actioned',
      claim: null,
      allowedActions: [],
      target: { available: false, currentStatus: 'hidden' },
      resolution: { outcome: 'hidden', contentAction: 'hide-comment', moderator: 'Test moderator' },
    })
    await expectRecords(id, {
      outcome: 'hidden',
      contentAction: 'hide-comment',
      moderator: f.moderator,
    })
    expect((await Comment.findById(f.comment.id)).status).toBe('hidden')
    const listed = await request(app).get(`/api/community/stories/${f.storyId}/comments`)
    expect(listed.body.total).toBe(0)

    const commenterNotes = (await api.get(f.commenter.cookie, '/api/reader/notifications')).body
    expect(commenterNotes.items[0]).toMatchObject({ href: `/stories/${f.storyId}` })
    const reporterNotes = (await api.get(f.reporter.cookie, '/api/reader/notifications')).body
    expect(reporterNotes.items[0]).toMatchObject({
      href: '/reader/notifications',
      status: 'hidden',
    })
    const resolved = (await api.get(f.moderator.cookie, '/api/moderator/reports?status=resolved'))
      .body
    expect(resolved.counts).toEqual({ open: 0, mine: 0, resolved: 1 })
    expect((await resolve(f.moderator, id, 'dismiss')).body.error.code).toBe('report_changed')
  })

  it('unpublishes a chapter or the whole story so the catalogue no longer serves it', async () => {
    const f = await fixture()
    const chapterUrl = `/api/catalog/stories/${f.storyId}/chapters/${f.chapterIds[1]}`
    expect((await api.get(f.reporter.cookie, chapterUrl)).status).toBe(200)
    const chapterReport = await submit(f.reporter, 'chapter', f.chapterIds[1])
    await claimAndResolve(f.moderator, chapterReport, 'unpublish-chapter')
    await expectRecords(chapterReport, {
      outcome: 'unpublished',
      contentAction: 'unpublish-chapter',
      moderator: f.moderator,
    })
    const chapter = await Chapter.findById(f.chapterIds[1]).lean()
    expect(chapter.status).toBe('unpublished')
    expect(chapter.publicationTransition.result).toBe('moderator-report-unpublished')
    expect((await api.get(f.reporter.cookie, chapterUrl)).status).toBe(404)
    const notice = await Notification.findOne({
      recipientAccountId: f.author.account._id,
      eventType: 'author.content-unpublished',
    }).lean()
    expect(notice.payload).toMatchObject({
      storyId: f.storyId,
      chapterId: f.chapterIds[1],
      title: 'Chương hai',
      reason: 'Vi phạm quy định cộng đồng.',
    })
    const authorNotes = (await api.get(f.author.cookie, '/api/reader/notifications')).body
    expect(authorNotes.items[0].href).toBe(`/author/stories/${f.storyId}`)

    const storyReport = await submit(f.reporter, 'chapter', f.chapterIds[0])
    const sameStory = await submit(await authenticatedAccount(), 'story', f.storyId)
    await claimAndResolve(f.moderator, storyReport, 'unpublish-story')
    const story = await Story.findById(f.storyId).lean()
    expect(story.publicationStatus).toBe('unpublished')
    expect(story.publicationTransition.result).toBe('moderator-report-unpublished')
    expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(404)
    expect(
      (await api.get(f.reporter.cookie, chapterUrl.replace(f.chapterIds[1], f.chapterIds[0])))
        .status,
    ).toBe(404)

    // Already-unavailable content: the action is still recorded, nothing changes.
    const before = await Story.findById(f.storyId).lean()
    const late = await claimAndResolve(f.moderator, sameStory, 'unpublish-story')
    expect(late).toMatchObject({ status: 'actioned', target: { available: false } })
    await expectRecords(sameStory, {
      outcome: 'unpublished',
      contentAction: 'unpublish-story',
      moderator: f.moderator,
    })
    expect((await Story.findById(f.storyId).lean()).version).toBe(before.version)
    expect(
      await Notification.countDocuments({
        recipientAccountId: f.author.account._id,
        eventType: 'author.content-unpublished',
      }),
    ).toBe(2)
  })

  it('warns the author or dismisses while leaving the content published', async () => {
    const f = await fixture()
    const warned = await submit(f.reporter, 'story', f.storyId, 'copyright')
    const report = await claimAndResolve(f.moderator, warned, 'warn-author')
    expect(report).toMatchObject({
      status: 'actioned',
      resolution: { outcome: 'warned', contentAction: 'none' },
      target: { available: true, currentStatus: 'published' },
    })
    await expectRecords(warned, {
      outcome: 'warned',
      contentAction: 'none',
      moderator: f.moderator,
    })
    const warning = await Notification.findOne({
      recipientAccountId: f.author.account._id,
      eventType: 'author.content-warning',
    }).lean()
    expect(warning.sourceEventKey).toBe(`content-report:${warned}:author`)
    expect(warning.payload).toMatchObject({ storyId: f.storyId, title: 'Truyện cộng đồng' })
    expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(200)

    const dismissed = await submit(f.reporter, 'comment', f.comment.id)
    const result = await claimAndResolve(f.moderator, dismissed, 'dismiss')
    expect(result).toMatchObject({ status: 'dismissed', resolution: { outcome: 'dismissed' } })
    await expectRecords(dismissed, {
      outcome: 'dismissed',
      contentAction: 'none',
      moderator: f.moderator,
    })
    expect((await Comment.findById(f.comment.id)).status).toBe('visible')
    expect(await Notification.countDocuments({ recipientAccountId: f.commenter.account._id })).toBe(
      0,
    )
    const reporterNote = await Notification.findOne({
      sourceEventKey: `content-report:${dismissed}:reporter`,
    }).lean()
    expect(reporterNote.payload.outcome).toBe('dismissed')
  })

  it('rejects actions that do not fit the target type and short reasons', async () => {
    const f = await fixture()
    const commentReport = await submit(f.reporter, 'comment', f.comment.id)
    const storyReport = await submit(f.reporter, 'story', f.storyId)
    expect((await claim(f.moderator, commentReport)).status).toBe(200)
    expect((await claim(f.moderator, storyReport)).status).toBe(200)
    for (const action of ['unpublish-story', 'unpublish-chapter', 'warn-author']) {
      const response = await resolve(f.moderator, commentReport, action)
      expect(response.status, action).toBe(400)
      expect(response.body.error.code).toBe('invalid_action')
    }
    for (const action of ['hide-comment', 'unpublish-chapter'])
      expect((await resolve(f.moderator, storyReport, action)).status, action).toBe(400)
    expect((await resolve(f.moderator, storyReport, 'dismiss', 'ngắn')).status).toBe(400)
    expect((await resolve(f.moderator, storyReport, 'escalate')).status).toBe(400)
    expect(await ReportResolution.countDocuments()).toBe(0)
    expect((await Story.findById(f.storyId)).publicationStatus).toBe('published')
  })
})
