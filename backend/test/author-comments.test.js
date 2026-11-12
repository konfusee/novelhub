import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Comment } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { publishedStory } from './fixtures/community.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session' }))

describe('author comment workspace', () => {
  it('lists owned published story and chapter comments and supports reply/status', async () => {
    const author = await authenticatedAccount('author')
    const reader = await authenticatedAccount()
    const { storyId, chapterIds } = await publishedStory({
      author,
      title: 'Truyện tác giả',
      chapters: [{ title: 'Chương mở đầu', paragraphs: ['Mở đầu.'] }],
    })
    const storyComment = await request(app)
      .post(`/api/community/stories/${storyId}/comments`)
      .set('Cookie', reader.cookie)
      .send({ body: 'Bình luận truyện rất hay' })
    const chapterComment = await request(app)
      .post(`/api/community/chapters/${chapterIds[0]}/comments`)
      .set('Cookie', reader.cookie)
      .send({ body: 'Bình luận chương mở đầu' })
    expect(storyComment.status).toBe(201)
    expect(chapterComment.status).toBe(201)

    const listed = await request(app)
      .get('/api/author/comments?search=mo%20dau&sort=az')
      .set('Cookie', author.cookie)
    expect(listed.status).toBe(200)
    expect(listed.body.stories).toEqual([{ id: storyId, title: 'Truyện tác giả' }])
    expect(listed.body.chapters[0]).toMatchObject({ storyId, title: 'Chương mở đầu' })
    expect(listed.body.total).toBe(1)
    expect(listed.body.items[0]).toMatchObject({
      id: chapterComment.body.comment.id,
      targetType: 'chapter',
    })

    const replied = await request(app)
      .post(`/api/author/comments/${chapterComment.body.comment.id}/reply`)
      .set('Cookie', author.cookie)
      .send({ body: 'Cảm ơn bạn đã đọc!' })
    expect(replied.status).toBe(201)

    const hidden = await request(app)
      .patch(`/api/author/comments/${storyComment.body.comment.id}/status`)
      .set('Cookie', author.cookie)
      .send({ status: 'hidden' })
    expect(hidden.status).toBe(200)
    expect((await Comment.findById(storyComment.body.comment.id)).status).toBe('hidden')

    const visibleOnly = await request(app)
      .get('/api/author/comments?status=visible')
      .set('Cookie', author.cookie)
    expect(visibleOnly.body.items.some(item => item.id === storyComment.body.comment.id)).toBe(
      false,
    )
  })
})
