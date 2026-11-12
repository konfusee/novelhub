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

async function submit(reporter, targetType, targetId, reason = 'spam', details) {
  const response = await api.write(reporter.cookie, '/api/community/reports', {
    targetType,
    targetId,
    reason,
    ...(details ? { details } : {}),
  })
  expect(response.status).toBe(201)
  return response.body.report.id
}

const listOf = async (moderator, query = '') =>
  (await api.get(moderator.cookie, `/api/moderator/reports${query}`)).body
const detailOf = (moderator, id) => api.get(moderator.cookie, `/api/moderator/reports/${id}`)
const versionOf = async id => (await ContentReport.findById(id)).version
const tokenOf = async id => String((await ContentReport.findById(id)).claimToken)
const claim = async (moderator, id) =>
  api.write(moderator.cookie, `/api/moderator/reports/${id}/claim`, {
    expectedVersion: await versionOf(id),
  })
const release = async (moderator, id, overrides = {}) =>
  api.write(moderator.cookie, `/api/moderator/reports/${id}/release`, {
    expectedVersion: await versionOf(id),
    claimToken: await tokenOf(id),
    ...overrides,
  })
const resolve = async (moderator, id, action, overrides = {}) =>
  api.write(moderator.cookie, `/api/moderator/reports/${id}/resolution`, {
    action,
    reason: 'Vi phạm quy định cộng đồng.',
    expectedVersion: await versionOf(id),
    claimToken: await tokenOf(id),
    ...overrides,
  })
async function claimAndResolve(moderator, id, action) {
  expect((await claim(moderator, id)).status).toBe(200)
  const resolved = await resolve(moderator, id, action)
  expect(resolved.status).toBe(200)
  return resolved.body
}

async function expectRecords(reportId, { outcome, action, contentChanged, moderator }) {
  const report = await ContentReport.findById(reportId).lean()
  const resolution = await ReportResolution.findOne({ reportId }).lean()
  expect(resolution).toMatchObject({
    outcome,
    contentAction: action,
    contentChanged,
    targetHash: report.targetHash,
  })
  expect(String(report.resolutionId)).toBe(String(resolution._id))
  expect(report.claimOwnerAccountId).toBeUndefined()
  expect(report.claimToken).toBeUndefined()
  const history = await ModerationHistory.findById(resolution.historyId).lean()
  expect(history).toMatchObject({
    aggregateType: 'ContentReport',
    action: 'report.resolved',
    outcome,
  })
  expect(history.claimAcquiredAt).toBeInstanceOf(Date)
  expect(history.claimAcquiredAt.getTime()).toBe(
    report.claimReleaseHistory.at(-1).acquiredAt.getTime(),
  )
  expect(String(history.aggregateId)).toBe(reportId)
  expect(String(history.actorAccountId)).toBe(String(moderator.account._id))
  const audit = await AuditEvent.find({ targetId: reportId, action: 'report.resolved' }).lean()
  expect(audit).toHaveLength(1)
  expect(audit[0].result).toBe(outcome)
  return report
}

describe('moderator report queue', () => {
  it('guards the routes by role and validates the input', async () => {
    const reader = await authenticatedAccount()
    const moderator = await authenticatedAccount('moderator')
    const id = 'a'.repeat(24)
    expect((await request(app).get('/api/moderator/reports')).status).toBe(401)
    expect((await api.get(reader.cookie, '/api/moderator/reports')).status).toBe(403)
    expect((await request(app).get(`/api/moderator/reports/${id}`)).status).toBe(401)
    expect((await detailOf(reader, id)).status).toBe(403)
    expect((await detailOf(moderator, id)).status).toBe(404)
    expect((await detailOf(moderator, 'not-an-id')).status).toBe(422)
    for (const query of ['?view=resolved', '?status=open', '?targetType=user', '?page=0'])
      expect((await api.get(moderator.cookie, `/api/moderator/reports${query}`)).status).toBe(422)
  })

  it('has no legacy resolve route', async () => {
    const f = await fixture()
    const id = await submit(f.reporter, 'comment', f.comment.id)
    expect((await claim(f.moderator, id)).status).toBe(200)
    const legacy = await api.write(f.moderator.cookie, `/api/moderator/reports/${id}/resolve`, {
      action: 'dismiss',
      reason: 'Vi phạm quy định cộng đồng.',
      expectedVersion: await versionOf(id),
    })
    expect(legacy.status).toBe(404)
    expect((await ContentReport.findById(id)).status).toBe('under-review')
  })

  it('lists claimable reports and own claims, never other moderators live claims', async () => {
    const f = await fixture()
    const other = await authenticatedAccount('moderator')
    const commentReport = await submit(f.reporter, 'comment', f.comment.id, 'harassment')
    const storyReport = await submit(await authenticatedAccount(), 'story', f.storyId)

    const queue = await listOf(f.moderator)
    expect(queue).toMatchObject({ view: 'queue', total: 2, page: 1, pageSize: 20 })
    expect(queue.items.map(item => item.reportId)).toEqual([commentReport, storyReport])
    expect(queue.items[0]).toEqual({
      reportId: commentReport,
      version: await versionOf(commentReport),
      targetType: 'comment',
      targetTitle: 'Bình luận xấu',
      reason: 'harassment',
      reporter: { id: String(f.reporter.account._id), displayName: 'Test reader' },
      reportedAt: expect.any(String),
      claimState: 'unclaimed',
      claimExpiresAt: null,
    })
    expect(queue.items[1].targetTitle).toBe('Truyện cộng đồng')
    const stories = await listOf(f.moderator, '?targetType=story')
    expect(stories.items.map(item => item.reportId)).toEqual([storyReport])

    expect((await claim(f.moderator, commentReport)).status).toBe(200)
    const mine = await listOf(f.moderator, '?view=mine')
    expect(mine.items.map(item => item.reportId)).toEqual([commentReport])
    expect(mine.items[0].claimState).toBe('mine')
    expect(mine.items[0].claimToken).toBeUndefined()
    // The holder still sees its own claim in the queue view (UC-MOD-05 step 1).
    expect((await listOf(f.moderator)).items.map(item => item.reportId)).toEqual([
      commentReport,
      storyReport,
    ])
    // Another moderator's live claim is excluded from the queue view.
    const othersQueue = await listOf(other)
    expect(othersQueue.total).toBe(1)
    expect(othersQueue.items.map(item => item.reportId)).toEqual([storyReport])
    expect((await listOf(other, '?view=mine')).items).toEqual([])

    await ContentReport.updateOne(
      { _id: commentReport },
      { claimExpiresAt: new Date(Date.now() - 1000) },
    )
    const afterExpiry = await listOf(other)
    expect(afterExpiry.items.map(item => item.reportId)).toEqual([commentReport, storyReport])
    expect(afterExpiry.items[0].claimState).toBe('expired')
    expect((await listOf(f.moderator, '?view=mine')).items).toEqual([])
  })

  it('shows the summary before a claim and the full review after it', async () => {
    const f = await fixture()
    const other = await authenticatedAccount('moderator')
    const earlier = await submit(f.reporter, 'comment', f.comment.id, 'spam')
    await claimAndResolve(f.moderator, earlier, 'dismiss')
    const duplicate = await submit(await authenticatedAccount(), 'comment', f.comment.id)
    const id = await submit(
      await authenticatedAccount(),
      'comment',
      f.comment.id,
      'harassment',
      'Lời lẽ xúc phạm người khác.',
    )

    const summary = await detailOf(f.moderator, id)
    expect(summary.status).toBe(200)
    expect(summary.headers['cache-control']).toBe('private, no-store')
    expect(summary.body).toMatchObject({
      reportId: id,
      status: 'open',
      targetType: 'comment',
      targetTitle: 'Bình luận xấu',
      reason: 'harassment',
      details: 'Lời lẽ xúc phạm người khác.',
      reporter: { displayName: 'Test reader' },
      claimState: 'unclaimed',
      claimExpiresAt: null,
      resolution: null,
      allowedActions: [],
    })
    for (const field of ['claimToken', 'snapshot', 'current', 'earlierCases', 'openDuplicates'])
      expect(summary.body[field], field).toBeUndefined()

    const claimed = await claim(f.moderator, id)
    expect(claimed.status).toBe(200)
    expect(claimed.body).toMatchObject({
      messageId: 'SYS-MSG-MOD-01',
      claimState: 'mine',
      claimToken: await tokenOf(id),
      snapshot: { targetType: 'comment', excerpt: 'Bình luận xấu' },
      current: { state: 'visible', excerpt: 'Bình luận xấu', storyId: f.storyId },
      openDuplicates: 1,
      allowedActions: ['dismiss', 'hide-comment'],
    })
    expect(
      Math.abs(new Date(claimed.body.claimExpiresAt) - (Date.now() + 24 * 3600000)),
    ).toBeLessThan(5000)
    expect(claimed.body.earlierCases).toEqual([
      expect.objectContaining({ reportId: duplicate, status: 'open', outcome: null }),
      expect.objectContaining({
        reportId: earlier,
        reason: 'spam',
        status: 'resolved',
        action: 'dismiss',
        outcome: 'dismissed',
        contentChanged: false,
      }),
    ])
    expect((await detailOf(f.moderator, id)).body.claimToken).toBe(await tokenOf(id))

    // UC-MOD-05 AF4: the current state is re-read; the snapshot stays the basis.
    await Comment.updateOne({ _id: f.comment.id }, { body: 'Đã sửa' })
    const changed = (await detailOf(f.moderator, id)).body
    expect(changed.current).toMatchObject({ state: 'changed', excerpt: 'Đã sửa' })
    expect(changed.snapshot.excerpt).toBe('Bình luận xấu')
    await Comment.updateOne({ _id: f.comment.id }, { status: 'soft-deleted' })
    expect((await detailOf(f.moderator, id)).body.current.state).toBe('deleted')

    const othersView = (await detailOf(other, id)).body
    expect(othersView.claimState).toBe('other')
    expect(othersView.claimToken).toBeUndefined()
    expect(othersView.snapshot).toBeUndefined()
  })

  it('names the parent story of a chapter report, which Unpublish Story applies to', async () => {
    const f = await fixture()
    const id = await submit(f.reporter, 'chapter', f.chapterIds[0])
    const summary = (await detailOf(f.moderator, id)).body
    expect(summary.parentStory).toBeUndefined()
    const claimed = await claim(f.moderator, id)
    expect(claimed.status).toBe(200)
    const story = await Story.findById(f.storyId).lean()
    expect(claimed.body.targetTitle).toBe('Chương một')
    expect(story.title).not.toBe(claimed.body.targetTitle)
    expect(claimed.body.parentStory).toEqual({ id: f.storyId, title: story.title })
    expect(claimed.body.current).toMatchObject({ title: 'Chương một', storyId: f.storyId })
    expect(claimed.body.current.storyTitle).toBeUndefined()
    expect(claimed.body.allowedActions).toContain('unpublish-story')

    const commentReport = await submit(f.reporter, 'comment', f.comment.id)
    expect((await claim(f.moderator, commentReport)).body.parentStory).toBeNull()
  })

  it('lets the holder resume a report claim recorded before claim tokens, keeping its expiry', async () => {
    const f = await fixture()
    const id = await submit(f.reporter, 'comment', f.comment.id)
    expect((await claim(f.moderator, id)).status).toBe(200)
    // The shape the previous code wrote: owner and expiry, no token or acquisition time.
    await ContentReport.updateOne({ _id: id }, { $unset: { claimToken: 1, claimAcquiredAt: 1 } })
    const legacy = await ContentReport.findById(id).lean()
    const summary = await detailOf(f.moderator, id)
    expect(summary.status).toBe(200)
    expect(summary.body).toMatchObject({
      claimState: 'mine',
      claimResumeRequired: true,
      claimExpiresAt: legacy.claimExpiresAt.toISOString(),
      allowedActions: [],
    })
    for (const field of ['claimToken', 'snapshot', 'current', 'earlierCases'])
      expect(summary.body[field], field).toBeUndefined()
    // A read never adopts the claim.
    const unchanged = await ContentReport.findById(id).lean()
    expect(unchanged.claimToken).toBeUndefined()
    expect(unchanged.version).toBe(legacy.version)

    const resumed = await claim(f.moderator, id)
    expect(resumed.status).toBe(200)
    expect(resumed.body).toMatchObject({
      messageId: 'SYS-MSG-MOD-01',
      claimState: 'mine',
      claimResumeRequired: false,
      claimToken: expect.any(String),
      claimExpiresAt: legacy.claimExpiresAt.toISOString(),
      allowedActions: ['dismiss', 'hide-comment'],
    })
    const adopted = await ContentReport.findById(id).lean()
    expect(String(adopted.claimToken)).toBe(resumed.body.claimToken)
    expect(adopted.claimExpiresAt.getTime()).toBe(legacy.claimExpiresAt.getTime())
    expect(adopted.claimAcquiredAt).toBeUndefined()
    expect(adopted.claimVersion).toBe(legacy.claimVersion)

    const resolved = await resolve(f.moderator, id, 'dismiss')
    expect(resolved.status).toBe(200)
    expect(resolved.body).toMatchObject({
      status: 'resolved',
      outcome: 'dismissed',
      contentChanged: false,
    })
  })

  it('keeps claims exclusive, fenced by version and token, until they expire', async () => {
    const f = await fixture()
    const other = await authenticatedAccount('moderator')
    const id = await submit(f.reporter, 'comment', f.comment.id)

    expect(
      (
        await api.write(f.moderator.cookie, `/api/moderator/reports/${id}/claim`, {
          expectedVersion: (await versionOf(id)) + 1,
        })
      ).body.error.code,
    ).toBe('report_changed')
    expect((await claim(f.moderator, id)).status).toBe(200)
    const taken = await claim(other, id)
    expect(taken.status).toBe(409)
    expect(taken.body.error.code).toBe('claim_conflict')
    expect((await resolve(other, id, 'dismiss')).body.error.code).toBe('claim_not_held')
    expect((await release(other, id)).body.error.code).toBe('claim_not_held')
    expect((await release(f.moderator, id, { claimToken: 'b'.repeat(24) })).body.error.code).toBe(
      'claim_not_held',
    )
    expect((await release(f.moderator, id, { claimToken: undefined })).status).toBe(422)

    const token = await tokenOf(id)
    await ContentReport.updateOne({ _id: id }, { claimExpiresAt: new Date(Date.now() - 1000) })
    expect((await resolve(f.moderator, id, 'dismiss')).body.error.code).toBe('claim_not_held')
    const reclaimed = await claim(other, id)
    expect(reclaimed.status).toBe(200)
    expect(reclaimed.body.claimState).toBe('mine')
    expect(reclaimed.body.claimToken).not.toBe(token)
    expect((await ContentReport.findById(id)).claimReleaseHistory.at(-1)).toMatchObject({
      reason: 'expired',
    })
    expect((await release(f.moderator, id, { claimToken: token })).body.error.code).toBe(
      'claim_not_held',
    )
    expect((await release(other, id, { expectedVersion: 0 })).body.error.code).toBe(
      'report_changed',
    )
    const released = await release(other, id)
    expect(released.status).toBe(200)
    expect(released.body).toMatchObject({
      messageId: 'SYS-MSG-MOD-03',
      status: 'open',
      claimState: 'unclaimed',
      claimExpiresAt: null,
    })
    expect(released.body.snapshot).toBeUndefined()
    const stored = await ContentReport.findById(id)
    expect(stored.status).toBe('open')
    expect(stored.claimToken).toBeUndefined()
  })

  it('hides a reported comment, records the change and notifies its author and the reporter', async () => {
    const f = await fixture()
    const id = await submit(f.reporter, 'comment', f.comment.id)
    const result = await claimAndResolve(f.moderator, id, 'hide-comment')
    expect(result).toMatchObject({
      reportId: id,
      status: 'resolved',
      action: 'hide-comment',
      outcome: 'comment-hidden',
      contentChanged: true,
      messageId: 'SYS-MSG-RPT-02',
    })
    await expectRecords(id, {
      outcome: 'comment-hidden',
      action: 'hide-comment',
      contentChanged: true,
      moderator: f.moderator,
    })
    expect((await Comment.findById(f.comment.id)).status).toBe('hidden')
    const listed = await request(app).get(`/api/community/stories/${f.storyId}/comments`)
    expect(listed.body.total).toBe(0)
    const resolved = (await detailOf(f.moderator, id)).body
    expect(resolved).toMatchObject({
      status: 'resolved',
      claimState: 'unclaimed',
      resolution: {
        action: 'hide-comment',
        outcome: 'comment-hidden',
        contentChanged: true,
        reason: 'Vi phạm quy định cộng đồng.',
        moderator: { displayName: 'Test moderator' },
      },
    })

    const commenterNotes = (await api.get(f.commenter.cookie, '/api/reader/notifications')).body
    expect(commenterNotes.items[0]).toMatchObject({ href: `/stories/${f.storyId}` })
    const reporterNotes = (await api.get(f.reporter.cookie, '/api/reader/notifications')).body
    expect(reporterNotes.items[0]).toMatchObject({
      href: '/reader/notifications',
      status: 'comment-hidden',
    })
    expect((await listOf(f.moderator)).items).toEqual([])
    expect((await claim(f.moderator, id)).body.error.code).toBe('report_changed')
  })

  it('unpublishes a chapter or the whole story and records no change when already restricted', async () => {
    const f = await fixture()
    const chapterUrl = `/api/catalog/stories/${f.storyId}/chapters/${f.chapterIds[1]}`
    expect((await api.get(f.reporter.cookie, chapterUrl)).status).toBe(200)
    const chapterReport = await submit(f.reporter, 'chapter', f.chapterIds[1])
    const chapterResult = await claimAndResolve(f.moderator, chapterReport, 'unpublish-chapter')
    expect(chapterResult).toMatchObject({ outcome: 'chapter-unpublished', contentChanged: true })
    await expectRecords(chapterReport, {
      outcome: 'chapter-unpublished',
      action: 'unpublish-chapter',
      contentChanged: true,
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
    const storyResult = await claimAndResolve(f.moderator, storyReport, 'unpublish-story')
    expect(storyResult).toMatchObject({ outcome: 'story-unpublished', contentChanged: true })
    const story = await Story.findById(f.storyId).lean()
    expect(story.publicationStatus).toBe('unpublished')
    expect(story.publicationTransition.result).toBe('moderator-report-unpublished')
    expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(404)
    expect(
      (await api.get(f.reporter.cookie, chapterUrl.replace(f.chapterIds[1], f.chapterIds[0])))
        .status,
    ).toBe(404)

    // UC-MOD-06 AF3: already unpublished, so the resolution records that nothing changed.
    const before = await Story.findById(f.storyId).lean()
    expect((await claim(f.moderator, sameStory)).body.current.state).toBe('unpublished')
    const late = await resolve(f.moderator, sameStory, 'unpublish-story')
    expect(late.status).toBe(200)
    expect(late.body).toMatchObject({ outcome: 'story-unpublished', contentChanged: false })
    await expectRecords(sameStory, {
      outcome: 'story-unpublished',
      action: 'unpublish-story',
      contentChanged: false,
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

  it('warns the author or dismisses without changing content', async () => {
    const f = await fixture()
    const warned = await submit(f.reporter, 'story', f.storyId, 'copyright')
    const before = await Story.findById(f.storyId).lean()
    const result = await claimAndResolve(f.moderator, warned, 'warn-author')
    expect(result).toMatchObject({
      action: 'warn-author',
      outcome: 'author-warned',
      contentChanged: false,
    })
    await expectRecords(warned, {
      outcome: 'author-warned',
      action: 'warn-author',
      contentChanged: false,
      moderator: f.moderator,
    })
    expect((await Story.findById(f.storyId).lean()).version).toBe(before.version)
    const warning = await Notification.findOne({
      recipientAccountId: f.author.account._id,
      eventType: 'author.content-warning',
    }).lean()
    expect(warning.sourceEventKey).toBe(`content-report:${warned}:author`)
    expect(warning.payload).toMatchObject({ storyId: f.storyId, title: 'Truyện cộng đồng' })
    expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(200)

    const dismissed = await submit(f.reporter, 'comment', f.comment.id)
    const dismissal = await claimAndResolve(f.moderator, dismissed, 'dismiss')
    expect(dismissal).toMatchObject({ outcome: 'dismissed', contentChanged: false })
    await expectRecords(dismissed, {
      outcome: 'dismissed',
      action: 'dismiss',
      contentChanged: false,
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

  it('rejects actions that do not fit the target type and invalid reasons', async () => {
    const f = await fixture()
    const commentReport = await submit(f.reporter, 'comment', f.comment.id)
    const storyReport = await submit(f.reporter, 'story', f.storyId)
    expect((await claim(f.moderator, commentReport)).status).toBe(200)
    expect((await claim(f.moderator, storyReport)).status).toBe(200)
    for (const action of ['unpublish-story', 'unpublish-chapter', 'warn-author']) {
      const response = await resolve(f.moderator, commentReport, action)
      expect(response.status, action).toBe(409)
      expect(response.body.error.code).toBe('report_changed')
    }
    for (const action of ['hide-comment', 'unpublish-chapter'])
      expect((await resolve(f.moderator, storyReport, action)).status, action).toBe(409)
    for (const reason of ['ngắn', '    a   ', 'a'.repeat(2001)])
      expect(
        (await resolve(f.moderator, storyReport, 'dismiss', { reason })).status,
        reason.length,
      ).toBe(422)
    expect((await resolve(f.moderator, storyReport, 'escalate')).status).toBe(422)
    expect(
      (await resolve(f.moderator, storyReport, 'dismiss', { claimToken: undefined })).status,
    ).toBe(422)
    expect(
      (await resolve(f.moderator, storyReport, 'dismiss', { expectedVersion: 0 })).body.error.code,
    ).toBe('report_changed')
    expect(await ReportResolution.countDocuments()).toBe(0)
    expect((await Story.findById(f.storyId)).publicationStatus).toBe('published')
    expect(
      (await resolve(f.moderator, storyReport, 'dismiss', { reason: 'a'.repeat(2000) })).status,
    ).toBe(200)
  })
})
