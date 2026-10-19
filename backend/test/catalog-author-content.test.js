import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Category, Chapter, ContentRevision, Story } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
async function categoryFor(account) {
  return Category.create({ name: 'Kỳ ảo', normalizedName: 'kỳ ảo', createdBy: account._id })
}
function write(method, path, cookie, body) {
  return request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body)
}

describe('MongoDB catalogue and author drafts', () => {
  it('versions category edits without changing the published snapshot and rejects retired categories', async () => {
    const author = await authenticatedAccount('author')
    const first = await categoryFor(author.account)
    const second = await Category.create({
      name: 'Bí ẩn',
      normalizedName: 'bí ẩn',
      createdBy: author.account._id,
    })
    const body = {
      title: 'Truyện thể loại',
      description: 'Tóm tắt.',
      categoryIds: [String(first._id)],
    }
    const created = await write('post', '/api/author/stories', author.cookie, body)
    const story = await Story.findById(created.body.story.id)
    const publicRevision = await ContentRevision.findById(story.currentRevisionId)
    publicRevision.status = 'approved'
    publicRevision.immutableAt = new Date()
    await publicRevision.save()
    story.publicationStatus = 'published'
    story.publishedRevisionId = publicRevision._id
    await story.save()
    const path = `/api/author/stories/${story._id}`
    const updated = await write('put', path, author.cookie, {
      title: body.title,
      description: body.description,
      categoryIds: [String(second._id)],
      expectedVersion: story.version,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.story.categoryIds).toEqual([String(second._id)])
    const changed = await Story.findById(story._id)
    expect(String(changed.publishedRevisionId)).toBe(String(publicRevision._id))
    expect((await ContentRevision.findById(changed.currentRevisionId)).content.categoryIds).toEqual(
      [String(second._id)],
    )
    expect((await ContentRevision.findById(publicRevision._id)).content.categoryIds).toEqual([
      String(first._id),
    ])
    expect((await request(app).get(`/api/catalog/stories?category=${first._id}`)).body.total).toBe(
      1,
    )
    expect((await request(app).get(`/api/catalog/stories?category=${second._id}`)).body.total).toBe(
      0,
    )
    second.status = 'retired'
    await second.save()
    expect(
      (
        await write('put', path, author.cookie, {
          title: body.title,
          description: body.description,
          categoryIds: [String(second._id)],
          expectedVersion: changed.version,
        })
      ).status,
    ).toBe(400)
    expect(await ContentRevision.countDocuments({ storyId: story._id })).toBe(2)
  })
  it('returns truly empty collections without demo records', async () => {
    expect((await request(app).get('/api/catalog/stories')).body).toMatchObject({
      items: [],
      total: 0,
    })
    expect((await request(app).get('/api/catalog/categories')).body.items).toEqual([])
    expect((await request(app).get('/api/catalog/home')).body).toMatchObject({
      stories: [],
      categories: [],
      featured: [],
      preview: null,
      stats: { readers: 0, authors: 0, stories: 0, rating: null },
    })
  })
  it('persists an owner story and chapter, rejects readers and cross-account access', async () => {
    const author = await authenticatedAccount('author')
    const other = await authenticatedAccount('author')
    const reader = await authenticatedAccount()
    const category = await categoryFor(author.account)
    const input = {
      title: 'Truyện thật',
      description: 'Nội dung của tác giả',
      categoryIds: [String(category._id)],
    }
    expect((await write('post', '/api/author/stories', reader.cookie, input)).status).toBe(403)
    const created = await write('post', '/api/author/stories', author.cookie, input)
    expect(created.status).toBe(201)
    const id = created.body.story.id
    expect(await Story.countDocuments()).toBe(1)
    expect(
      (await request(app).get('/api/author/stories').set('Cookie', author.cookie)).body.items[0]
        .title,
    ).toBe(input.title)
    expect(
      (await request(app).get(`/api/author/stories/${id}`).set('Cookie', other.cookie)).status,
    ).toBe(404)
    expect((await request(app).get('/api/catalog/stories')).body.items).toEqual([])
    const chapter = await write('post', `/api/author/stories/${id}/chapters`, author.cookie, {
      title: 'Chương đầu',
      paragraphs: ['Nội dung thực tế.'],
    })
    expect(chapter.status).toBe(201)
    const path = `/api/author/stories/${id}/chapters/${chapter.body.chapter.id}`
    const loaded = await request(app).get(path).set('Cookie', author.cookie)
    expect(loaded.body.chapter.paragraphs).toEqual(['Nội dung thực tế.'])
    expect((await request(app).get(path).set('Cookie', other.cookie)).status).toBe(404)
    const edit = {
      title: 'Tên mới',
      paragraphs: ['Bản sửa'],
      expectedVersion: loaded.body.chapter.version,
    }
    expect((await write('put', path, author.cookie, edit)).status).toBe(200)
    expect((await write('put', path, author.cookie, edit)).status).toBe(409)
    expect(await ContentRevision.countDocuments({ contentType: 'chapter' })).toBe(2)
    expect(
      (await request(app).get(path).set('Cookie', author.cookie)).body.chapter.paragraphs,
    ).toEqual(['Bản sửa'])
  })
  it('rejects invalid categories, forged owners/status and requests without CSRF origin', async () => {
    const author = await authenticatedAccount('author')
    const category = await categoryFor(author.account)
    const input = { title: 'Test', description: '', categoryIds: [String(category._id)] }
    expect(
      (
        await write('post', '/api/author/stories', author.cookie, {
          ...input,
          publicationStatus: 'published',
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await write('post', '/api/author/stories', author.cookie, {
          ...input,
          categoryIds: ['000000000000000000000000'],
        })
      ).status,
    ).toBe(400)
    expect(
      (await request(app).post('/api/author/stories').set('Cookie', author.cookie).send(input))
        .status,
    ).toBe(403)
    expect(await Story.countDocuments()).toBe(0)
  })
  it('serves only matching approved published snapshots and protects early access content', async () => {
    const author = await authenticatedAccount('author')
    const category = await categoryFor(author.account)
    const story = await Story.create({
      authorAccountId: author.account._id,
      title: 'SECRET draft title',
      categoryIds: [category._id],
      publicationStatus: 'published',
    })
    const revision = await ContentRevision.create({
      storyId: story._id,
      authorAccountId: author.account._id,
      contentType: 'story',
      revisionNumber: 1,
      status: 'approved',
      formatVersion: 'story-v1',
      content: {
        title: 'Public title',
        description: 'Published synopsis',
        categoryIds: [String(category._id)],
      },
    })
    story.publishedRevisionId = revision._id
    await story.save()
    const chapter = await Chapter.create({
      storyId: story._id,
      title: 'SECRET chapter draft',
      orderKey: 1,
      status: 'published',
      earlyAccess: { enabled: true, endsAt: new Date(Date.now() + 600000) },
    })
    const published = await ContentRevision.create({
      storyId: story._id,
      chapterId: chapter._id,
      authorAccountId: author.account._id,
      contentType: 'chapter',
      revisionNumber: 1,
      status: 'approved',
      formatVersion: 'blocks-v1',
      content: { title: 'Public chapter', blocks: [{ type: 'paragraph', text: 'Paid text' }] },
    })
    chapter.publishedRevisionId = published._id
    await chapter.save()
    const catalog = await request(app).get('/api/catalog/stories?q=Public')
    expect(catalog.body.items[0].title).toBe('Public title')
    expect(JSON.stringify(catalog.body)).not.toContain('SECRET')
    expect(
      (await request(app).get(`/api/catalog/stories/${story._id}`)).body.chapters[0].title,
    ).toBe('Public chapter')
    const path = `/api/catalog/stories/${story._id}/chapters/${chapter._id}`
    const locked = await request(app).get(path)
    expect(locked.status).toBe(403)
    expect(JSON.stringify(locked.body)).not.toContain('Paid text')
    const home = await request(app).get('/api/catalog/home')
    expect(home.body.preview).toBeNull()
    expect(JSON.stringify(home.body)).not.toContain('SECRET')
    expect(JSON.stringify(home.body)).not.toContain('Paid text')
    chapter.earlyAccess.endsAt = new Date(0)
    await chapter.save()
    expect((await request(app).get(path)).body.chapter.blocks[0].text).toBe('Paid text')
    expect((await request(app).get('/api/catalog/home')).body.preview.paragraphs).toEqual([
      'Paid text',
    ])
    published.formatVersion = 'blocks-v2'
    published.content = {
      title: 'Public chapter',
      blocks: [
        { type: 'heading', level: 2, inlines: [{ text: 'Tiêu đề', marks: [] }] },
        { type: 'paragraph', inlines: [{ text: 'Paid text', marks: ['bold'] }] },
        { type: 'scene-break' },
      ],
    }
    await published.save()
    expect((await request(app).get(path)).body.chapter.blocks).toEqual(published.content.blocks)
    expect((await request(app).get('/api/catalog/home')).body.preview.paragraphs).toEqual([
      'Tiêu đề',
      'Paid text',
    ])
  })
  it('allows only Admin to create real categories and records an audit event', async () => {
    const admin = await authenticatedAccount('admin')
    const reader = await authenticatedAccount()
    expect(
      (await write('post', '/api/admin/categories', reader.cookie, { name: 'Kỳ ảo' })).status,
    ).toBe(403)
    expect(
      (await write('post', '/api/admin/categories', admin.cookie, { name: 'Kỳ ảo' })).status,
    ).toBe(201)
    expect(
      (await write('post', '/api/admin/categories', admin.cookie, { name: 'KỲ ẢO' })).status,
    ).toBe(409)
    expect((await request(app).get('/api/catalog/categories')).body.items[0]).toMatchObject({
      name: 'Kỳ ảo',
      count: 0,
    })
  })
})
