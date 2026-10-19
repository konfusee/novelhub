import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  Story,
  PublicationSubmission,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (path, cookie, body) =>
  request(app).post(path).set('Cookie', cookie).set('Origin', origin).send(body)
async function fixture() {
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const created = await write('/api/author/stories', author.cookie, {
    title: 'Truyện sắp xếp',
    description: '',
    categoryIds: [String(category._id)],
  })
  const storyId = created.body.story.id
  for (const title of ['Một', 'Hai', 'Ba'])
    await write(`/api/author/stories/${storyId}/chapters`, author.cookie, {
      title,
      paragraphs: [`Nội dung ${title}.`],
    })
  const workspace = () =>
    request(app).get(`/api/author/stories/${storyId}/workspace`).set('Cookie', author.cookie)
  const data = (await workspace()).body
  const chapters = [...data.chapters].sort((a, b) => a.number - b.number)
  return {
    author,
    storyId,
    workspace,
    chapters,
    path: `/api/author/stories/${storyId}/chapters/reorder`,
    input: {
      expectedVersion: data.story.version,
      chapters: chapters.map(chapter => ({ id: chapter.id, expectedVersion: chapter.version })),
    },
  }
}
describe('private draft chapter order', () => {
  it('swaps chapters atomically, preserves content and reloads the real order', async () => {
    const f = await fixture()
    expect((await f.workspace()).body.story.canReorder).toBe(true)
    const before = await ContentRevision.find({ storyId: f.storyId }).sort({ _id: 1 }).lean()
    const response = await write(f.path, f.author.cookie, {
      ...f.input,
      chapters: [...f.input.chapters].reverse(),
    })
    expect(response.status).toBe(200)
    expect(response.body.chapters.map(chapter => chapter.id)).toEqual(
      f.chapters.map(chapter => chapter.id).reverse(),
    )
    expect(response.body.chapters.map(chapter => chapter.number)).toEqual([1, 2, 3])
    expect(
      (await f.workspace()).body.chapters
        .sort((a, b) => a.number - b.number)
        .map(chapter => chapter.title),
    ).toEqual(['Ba', 'Hai', 'Một'])
    expect(await ContentRevision.find({ storyId: f.storyId }).sort({ _id: 1 }).lean()).toEqual(
      before,
    )
    const audit = await AuditEvent.findOne({ action: 'story.chapters-reordered' }).lean()
    expect(JSON.parse(audit.reason).after).toEqual(
      response.body.chapters.map(chapter => chapter.id),
    )
    expect((await request(app).get('/api/catalog/stories')).body.total).toBe(0)
    const again = await write(f.path, f.author.cookie, {
      expectedVersion: response.body.story.version,
      chapters: response.body.chapters.map(chapter => ({
        id: chapter.id,
        expectedVersion: chapter.version,
      })),
    })
    expect(again.status).toBe(200)
    expect(again.body.story.version).toBe(response.body.story.version)
    expect(await AuditEvent.countDocuments({ action: 'story.chapters-reordered' })).toBe(1)
  })
  it('rejects duplicate, missing, foreign and stale chapter lists', async () => {
    const f = await fixture()
    expect(
      (
        await write(f.path, f.author.cookie, {
          ...f.input,
          chapters: [f.input.chapters[0], f.input.chapters[0]],
        })
      ).status,
    ).toBe(400)
    expect(
      (await write(f.path, f.author.cookie, { ...f.input, chapters: f.input.chapters.slice(0, 2) }))
        .status,
    ).toBe(409)
    expect(
      (await write(f.path, f.author.cookie, { ...f.input, expectedVersion: 999 })).status,
    ).toBe(409)
    expect(
      (
        await write(f.path, f.author.cookie, {
          ...f.input,
          chapters: f.input.chapters.map((chapter, index) =>
            index ? chapter : { ...chapter, expectedVersion: 999 },
          ),
        })
      ).status,
    ).toBe(409)
    const other = await authenticatedAccount('author')
    expect((await write(f.path, other.cookie, f.input)).status).toBe(404)
    const reader = await authenticatedAccount()
    expect((await write(f.path, reader.cookie, f.input)).status).toBe(403)
    expect(
      (await request(app).post(f.path).set('Cookie', f.author.cookie).send(f.input)).status,
    ).toBe(403)
  })
  it('rolls back every order key and version if the audit write fails', async () => {
    const f = await fixture()
    const before = await Chapter.find({ storyId: f.storyId }).sort({ _id: 1 }).lean()
    const story = await Story.findById(f.storyId).lean()
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'))
    expect(
      (
        await write(f.path, f.author.cookie, {
          ...f.input,
          chapters: [...f.input.chapters].reverse(),
        })
      ).status,
    ).toBe(500)
    expect(await Chapter.find({ storyId: f.storyId }).sort({ _id: 1 }).lean()).toEqual(before)
    expect((await Story.findById(f.storyId)).version).toBe(story.version)
  })
  it('rejects a list captured before another chapter was added', async () => {
    const f = await fixture()
    await write(`/api/author/stories/${f.storyId}/chapters`, f.author.cookie, {
      title: 'Chương thêm sau',
      paragraphs: ['Nội dung mới.'],
    })
    const response = await write(f.path, f.author.cookie, {
      ...f.input,
      chapters: [...f.input.chapters].reverse(),
    })
    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('stale_chapters')
    expect(await Chapter.countDocuments({ storyId: f.storyId })).toBe(4)
    expect(await AuditEvent.countDocuments({ action: 'story.chapters-reordered' })).toBe(0)
  })
  it('accepts only one of two concurrent order changes using the same versions', async () => {
    const f = await fixture()
    const results = await Promise.all([
      write(f.path, f.author.cookie, { ...f.input, chapters: [...f.input.chapters].reverse() }),
      write(f.path, f.author.cookie, {
        ...f.input,
        chapters: [f.input.chapters[1], f.input.chapters[0], f.input.chapters[2]],
      }),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 409])
    expect(await AuditEvent.countDocuments({ action: 'story.chapters-reordered' })).toBe(1)
  })
  it.each([
    'published',
    'archived',
    'frozen',
    'chapter-published',
    'revision-frozen',
    'submission',
  ])('blocks %s content', async kind => {
    const f = await fixture()
    if (kind === 'published' || kind === 'archived')
      await Story.updateOne({ _id: f.storyId }, { publicationStatus: kind })
    if (kind === 'frozen') await Story.updateOne({ _id: f.storyId }, { authoringFrozen: true })
    if (kind === 'chapter-published')
      await Chapter.updateOne(
        { _id: f.chapters[0].id },
        { status: 'published', publishedAt: new Date() },
      )
    if (kind === 'revision-frozen') {
      const chapter = await Chapter.findById(f.chapters[0].id)
      const revision = await ContentRevision.findById(chapter.draftRevisionId)
      revision.immutableAt = new Date()
      await revision.save()
    }
    if (kind === 'submission') {
      const story = await Story.findById(f.storyId)
      await PublicationSubmission.create({
        storyId: f.storyId,
        authorAccountId: f.author.account._id,
        revisionId: story.draftRevisionId,
        status: 'validated',
        packageDigest: 'pending',
      })
    }
    expect((await f.workspace()).body.story.canReorder).toBe(false)
    expect(
      (
        await write(f.path, f.author.cookie, {
          ...f.input,
          chapters: [...f.input.chapters].reverse(),
        })
      ).status,
    ).toBe(409)
  })
})
