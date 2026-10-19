import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Category, ContentRevision, Story } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (method, path, cookie, body) =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body)
describe('owned story workspace and metadata edits', () => {
  it('uses exact stored chapter data and creates versioned metadata drafts without replacing the public snapshot', async () => {
    const author = await authenticatedAccount('author')
    const other = await authenticatedAccount('author')
    const reader = await authenticatedAccount()
    const category = await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'kỳ ảo',
      createdBy: author.account._id,
    })
    const created = await write('post', '/api/author/stories', author.cookie, {
      title: 'Original title',
      description: 'Original synopsis',
      categoryIds: [String(category._id)],
    })
    const storyId = created.body.story.id
    const base = `/api/author/stories/${storyId}`
    const chapter = await write('post', `${base}/chapters`, author.cookie, {
      title: 'Chương của tôi',
      paragraphs: ['Một hai ba'],
    })
    expect(chapter.status).toBe(201)
    const chapterPath = `${base}/chapters/${chapter.body.chapter.id}`
    const editor = await request(app).get(chapterPath).set('Cookie', author.cookie)
    expect(editor.status).toBe(200)
    expect(editor.body.chapter).toMatchObject({
      id: chapter.body.chapter.id,
      storyId,
      storyTitle: 'Original title',
      number: 1,
      canEdit: true,
      canCreate: true,
      paragraphs: ['Một hai ba'],
      outline: [{ id: chapter.body.chapter.id, number: 1, title: 'Chương của tôi' }],
    })
    expect((await request(app).get(chapterPath).set('Cookie', other.cookie)).status).toBe(404)
    const savedChapter = await write('put', chapterPath, author.cookie, {
      title: 'Bản nháp đã sửa',
      paragraphs: ['Nội dung mới'],
      expectedVersion: editor.body.chapter.version,
    })
    expect(savedChapter.status).toBe(200)
    expect(
      (await request(app).get(chapterPath).set('Cookie', author.cookie)).body.chapter.paragraphs,
    ).toEqual(['Nội dung mới'])
    expect(
      (
        await write('put', chapterPath, author.cookie, {
          title: 'Bản cũ',
          paragraphs: ['Không ghi đè'],
          expectedVersion: editor.body.chapter.version,
        })
      ).status,
    ).toBe(409)
    const story = await Story.findById(storyId)
    const published = await ContentRevision.create({
      storyId,
      authorAccountId: author.account._id,
      contentType: 'story',
      revisionNumber: 2,
      formatVersion: 'story-v1',
      status: 'approved',
      content: {
        title: 'Public original',
        description: 'Public synopsis',
        categoryIds: [String(category._id)],
      },
    })
    story.publicationStatus = 'published'
    story.publishedRevisionId = published._id
    await story.save()
    const workspace = (await request(app).get(`${base}/workspace`).set('Cookie', author.cookie))
      .body
    expect(workspace.story).toMatchObject({
      id: storyId,
      title: 'Original title',
      genres: ['Kỳ ảo'],
      canEdit: true,
    })
    expect(workspace.chapters[0]).toMatchObject({
      id: chapter.body.chapter.id,
      title: 'Bản nháp đã sửa',
      number: 1,
      words: 3,
      reads: 0,
      status: 'draft',
    })
    expect(workspace.stats).toMatchObject({
      availableWords: 3,
      publishedChapters: 0,
      reads: 0,
      rating: '—',
    })
    expect((await request(app).get(`${base}/workspace`).set('Cookie', other.cookie)).status).toBe(
      404,
    )
    expect((await request(app).get(`${base}/workspace`).set('Cookie', reader.cookie)).status).toBe(
      403,
    )
    const edit = {
      title: 'New draft title',
      description: 'New draft synopsis',
      expectedVersion: workspace.story.version,
    }
    const updated = await write('put', base, author.cookie, edit)
    expect(updated.status).toBe(200)
    expect(updated.body.story.version).toBeGreaterThan(workspace.story.version)
    expect((await write('put', base, author.cookie, edit)).status).toBe(409)
    expect(
      (
        await write('put', base, other.cookie, {
          ...edit,
          expectedVersion: updated.body.story.version,
        })
      ).status,
    ).toBe(404)
    expect(
      (await write('put', base, author.cookie, { ...edit, publicationStatus: 'published' })).status,
    ).toBe(400)
    expect((await Story.findById(storyId)).publishedRevisionId.equals(published._id)).toBe(true)
    const publicResponse = await request(app).get(`/api/catalog/stories/${storyId}`)
    expect(publicResponse.body.story.title).toBe('Public original')
    expect(JSON.stringify(publicResponse.body)).not.toContain('New draft title')
    expect(await ContentRevision.countDocuments({ storyId, contentType: 'story' })).toBe(3)
    await Story.updateOne({ _id: storyId }, { $set: { authoringFrozen: true } })
    expect(
      (
        await write('put', base, author.cookie, {
          ...edit,
          expectedVersion: updated.body.story.version,
        })
      ).status,
    ).toBe(409)
    expect(
      (await request(app).get(`${base}/workspace`).set('Cookie', author.cookie)).body.story.canEdit,
    ).toBe(false)
  })
})
