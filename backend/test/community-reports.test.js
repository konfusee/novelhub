import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Chapter, ContentReport, Story } from '../src/models/index.js'
import { digest } from '../src/modules/authoring-publishing/submissions/submission-digests.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { publishedStory } from './fixtures/community.js'
import { apiClient, origin } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)
const report = (reader, body) => api.write(reader.cookie, '/api/community/reports', body)

describe('content reports', () => {
  it('stores frozen snapshots, revision and hash for each target type', async () => {
    const longText = 'Đoạn văn dài. '.repeat(60)
    const { author, storyId, chapterIds } = await publishedStory({
      chapters: [{ title: 'Chương một', paragraphs: [longText, 'Đoạn hai.'] }],
    })
    const reader = await authenticatedAccount()
    const comment = (
      await api.write(reader.cookie, `/api/community/chapters/${chapterIds[0]}/comments`, {
        body: 'Bình luận bị báo cáo',
      })
    ).body.comment
    const reporter = await authenticatedAccount()

    const storyReport = await report(reporter, {
      targetType: 'story',
      targetId: storyId,
      reason: 'copyright',
      details: '  Sao chép từ nơi khác  ',
    })
    expect(storyReport.status).toBe(201)
    expect(storyReport.body.report).toEqual({ id: expect.any(String), status: 'open' })
    const storyDoc = await ContentReport.findById(storyReport.body.report.id).lean()
    const story = await Story.findById(storyId).lean()
    expect(storyDoc).toMatchObject({
      reason: 'copyright',
      details: 'Sao chép từ nơi khác',
      targetSnapshot: {
        storyId,
        title: 'Truyện cộng đồng',
        description: 'Tóm tắt truyện cộng đồng.',
        authorId: String(author.account._id),
      },
    })
    expect(String(storyDoc.targetRevisionId)).toBe(String(story.publishedRevisionId))
    expect(storyDoc.targetHash).toBe(digest(storyDoc.targetSnapshot))

    const chapterReport = await report(reporter, {
      targetType: 'chapter',
      targetId: chapterIds[0],
      reason: 'inappropriate',
    })
    expect(chapterReport.status).toBe(201)
    const chapterDoc = await ContentReport.findById(chapterReport.body.report.id).lean()
    const chapter = await Chapter.findById(chapterIds[0]).lean()
    expect(chapterDoc.targetSnapshot).toEqual({
      storyId,
      chapterId: chapterIds[0],
      title: 'Chương một',
      orderKey: 1,
      excerpt: `${longText}\nĐoạn hai.`.slice(0, 500),
      authorId: String(author.account._id),
    })
    expect(chapterDoc.targetSnapshot.excerpt).toHaveLength(500)
    expect(String(chapterDoc.targetRevisionId)).toBe(String(chapter.publishedRevisionId))

    const commentReport = await report(reporter, {
      targetType: 'comment',
      targetId: comment.id,
      reason: 'harassment',
    })
    expect(commentReport.status).toBe(201)
    const commentDoc = await ContentReport.findById(commentReport.body.report.id).lean()
    expect(commentDoc.targetSnapshot).toEqual({
      commentId: comment.id,
      body: 'Bình luận bị báo cáo',
      authorId: String(reader.account._id),
      targetType: 'chapter',
      targetId: chapterIds[0],
      storyId,
    })
    expect(commentDoc.targetHash).toBe(digest(commentDoc.targetSnapshot))
  })

  it('rejects duplicate open reports, guests, unknown targets and bad reasons', async () => {
    const { storyId } = await publishedStory()
    const [reporter, other] = [await authenticatedAccount(), await authenticatedAccount()]
    const body = { targetType: 'story', targetId: storyId, reason: 'spam' }
    expect((await report(reporter, body)).status).toBe(201)
    const duplicate = await report(reporter, { ...body, reason: 'other' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('already_reported')
    expect((await report(other, body)).status).toBe(201)

    await ContentReport.updateOne(
      { reporterAccountId: reporter.account._id },
      { status: 'dismissed' },
    )
    expect((await report(reporter, body)).status).toBe(201)

    const guest = await request(app).post('/api/community/reports').set('Origin', origin).send(body)
    expect(guest.status).toBe(401)
    expect((await report(other, { ...body, reason: 'boring' })).status).toBe(400)
    expect((await report(other, { ...body, details: 'x'.repeat(1001) })).status).toBe(400)
    expect(
      (await report(other, { ...body, targetType: 'comment', targetId: storyId })).status,
    ).toBe(404)
    expect(await ContentReport.countDocuments()).toBe(3)
  })
})
