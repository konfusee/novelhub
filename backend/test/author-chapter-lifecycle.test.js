import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  PublicationSubmission,
  Story,
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
    title: 'Truyện riêng tư',
    description: '',
    categoryIds: [String(category._id)],
  })
  const storyId = created.body.story.id
  const base = `/api/author/stories/${storyId}`
  const result = await write(`${base}/chapters`, author.cookie, {
    title: 'Nội dung cần giữ',
    paragraphs: ['Xin giữ nguyên toàn bộ.'],
  })
  const chapterId = result.body.chapter.id
  const workspace = () => request(app).get(`${base}/workspace`).set('Cookie', author.cookie)
  const input = async (action = 'archive') => {
    const data = (await workspace()).body
    return {
      action,
      expectedVersion: data.chapters[0].version,
      expectedStoryVersion: data.story.version,
    }
  }
  return {
    author,
    storyId,
    chapterId,
    base,
    workspace,
    input,
    path: `${base}/chapters/${chapterId}/lifecycle`,
  }
}
describe('private chapter lifecycle', () => {
  it('deletes a private draft from working lists, keeps history and prevents restore or overwrite', async () => {
    const f = await fixture()
    const before = await Chapter.findById(f.chapterId).lean()
    const revisions = await ContentRevision.find({ chapterId: f.chapterId }).lean()
    const input = await f.input('delete')
    const other = await authenticatedAccount('author')
    expect((await write(f.path, other.cookie, input)).status).toBe(404)
    expect(
      (
        await write(f.path, f.author.cookie, {
          ...input,
          expectedVersion: input.expectedVersion + 1,
        })
      ).status,
    ).toBe(409)
    expect((await write(f.path, f.author.cookie, input)).status).toBe(200)
    expect((await f.workspace()).body.chapters).toEqual([])
    const after = await Chapter.findById(f.chapterId).lean()
    expect(after.status).toBe('archived')
    expect(after.publicationTransition.result).toBe('author-draft-deleted')
    expect(after.orderKey).toBeLessThan(0)
    expect(after.draftRevisionId).toEqual(before.draftRevisionId)
    expect(await ContentRevision.find({ chapterId: f.chapterId }).lean()).toEqual(revisions)
    expect(
      (await request(app).get(`${f.base}/chapters/${f.chapterId}`).set('Cookie', f.author.cookie))
        .status,
    ).toBe(404)
    expect(
      (await request(app).get(`${f.base}/chapters`).set('Cookie', f.author.cookie)).body.items,
    ).toEqual([])
    expect(
      (await request(app).get('/api/author/drafts').set('Cookie', f.author.cookie)).body.items,
    ).toEqual([])
    expect(
      (await request(app).get('/api/author/dashboard').set('Cookie', f.author.cookie)).body
        .stories[0].chapters,
    ).toBe(0)
    expect(
      (
        await write(f.path, f.author.cookie, {
          action: 'restore',
          expectedVersion: after.version,
          expectedStoryVersion: (await Story.findById(f.storyId)).version,
        })
      ).status,
    ).toBe(409)
    expect(
      await AuditEvent.countDocuments({ action: 'chapter.draft-deleted', targetId: f.chapterId }),
    ).toBe(1)
    const added = await write(`${f.base}/chapters`, f.author.cookie, {
      title: 'Chương thay thế',
      paragraphs: ['Bản mới'],
    })
    expect(added.status).toBe(201)
    expect((await Chapter.findById(added.body.chapter.id)).orderKey).toBe(1)
    const second = await write(`${f.base}/chapters`, f.author.cookie, {
      title: 'Chương hai',
      paragraphs: ['Bản mới hai'],
    })
    const workspace = (await f.workspace()).body
    expect(workspace.story.canReorder).toBe(true)
    expect(
      (
        await write(`${f.base}/chapters/reorder`, f.author.cookie, {
          expectedVersion: workspace.story.version,
          chapters: [second.body.chapter, added.body.chapter].map(chapter => ({
            id: chapter.id,
            expectedVersion: chapter.version,
          })),
        })
      ).status,
    ).toBe(200)
  })
  it('archives and restores without changing content, revisions, order or publication', async () => {
    const f = await fixture()
    const before = await Chapter.findById(f.chapterId).lean()
    const revisions = await ContentRevision.find({ storyId: f.storyId }).sort({ _id: 1 }).lean()
    expect((await f.workspace()).body.chapters[0]).toMatchObject({
      canArchive: true,
      canRestore: false,
    })
    expect((await write(f.path, f.author.cookie, await f.input())).status).toBe(200)
    expect((await f.workspace()).body.chapters[0]).toMatchObject({
      status: 'archived',
      canArchive: false,
      canRestore: true,
    })
    expect(
      (await request(app).get('/api/author/drafts').set('Cookie', f.author.cookie)).body.items,
    ).toHaveLength(0)
    const read = await request(app)
      .get(`${f.base}/chapters/${f.chapterId}`)
      .set('Cookie', f.author.cookie)
    expect(read.body.chapter).toMatchObject({
      canEdit: false,
      paragraphs: ['Xin giữ nguyên toàn bộ.'],
      outline: [],
    })
    expect(
      (
        await request(app)
          .put(`${f.base}/chapters/${f.chapterId}`)
          .set('Cookie', f.author.cookie)
          .set('Origin', origin)
          .send({
            title: 'Không ghi đè',
            paragraphs: ['Sai'],
            expectedVersion: read.body.chapter.version,
          })
      ).status,
    ).toBe(409)
    expect((await write(f.path, f.author.cookie, await f.input('restore'))).status).toBe(200)
    const after = await Chapter.findById(f.chapterId).lean()
    for (const field of ['orderKey', 'draftRevisionId', 'currentRevisionId', 'title'])
      expect(after[field]).toEqual(before[field])
    expect(after.status).toBe('draft')
    expect(after.publishedRevisionId).toBeUndefined()
    expect(await ContentRevision.find({ storyId: f.storyId }).sort({ _id: 1 }).lean()).toEqual(
      revisions,
    )
    expect(
      (await request(app).get('/api/author/drafts').set('Cookie', f.author.cookie)).body.items,
    ).toHaveLength(1)
    expect(await AuditEvent.countDocuments({ targetId: f.chapterId })).toBe(2)
    expect((await request(app).get('/api/catalog/stories')).body.total).toBe(0)
  })
  it('checks ownership, Origin, role, strict input and both baseline versions', async () => {
    const f = await fixture()
    const input = await f.input()
    const other = await authenticatedAccount('author')
    const reader = await authenticatedAccount()
    expect((await write(f.path, other.cookie, input)).status).toBe(404)
    expect((await write(f.path, reader.cookie, input)).status).toBe(403)
    expect(
      (await request(app).post(f.path).set('Cookie', f.author.cookie).send(input)).status,
    ).toBe(403)
    for (const bad of [
      { ...input, action: 'purge' },
      { ...input, title: 'injected' },
      { action: 'archive' },
    ])
      expect((await write(f.path, f.author.cookie, bad)).status).toBe(400)
    for (const bad of [
      { ...input, expectedVersion: 999 },
      { ...input, expectedStoryVersion: 999 },
    ])
      expect((await write(f.path, f.author.cookie, bad)).status).toBe(409)
  })
  it('rolls back audit failure and serializes concurrent requests', async () => {
    const f = await fixture()
    const before = await Chapter.findById(f.chapterId).lean()
    const story = await Story.findById(f.storyId).lean()
    const input = await f.input()
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'))
    expect((await write(f.path, f.author.cookie, input)).status).toBe(500)
    expect(await Chapter.findById(f.chapterId).lean()).toEqual(before)
    expect(await Story.findById(f.storyId).lean()).toEqual(story)
    vi.restoreAllMocks()
    const results = await Promise.all([
      write(f.path, f.author.cookie, input),
      write(f.path, f.author.cookie, input),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    expect(await AuditEvent.countDocuments({ action: 'chapter.draft-archived' })).toBe(1)
  })
  it.each([
    'released',
    'scheduled',
    'published-story',
    'frozen-story',
    'frozen-revision',
    'active-submission',
    'foreign-archive',
  ])('rejects archive or restore when %s', async kind => {
    const f = await fixture()
    const chapter = await Chapter.findById(f.chapterId)
    const story = await Story.findById(f.storyId)
    if (kind === 'released') {
      chapter.firstReleasedAt = new Date()
      await chapter.save()
    }
    if (kind === 'scheduled') {
      chapter.requestedReleaseAt = new Date()
      await chapter.save()
    }
    if (kind === 'published-story') {
      story.publishedAt = new Date()
      await story.save()
    }
    if (kind === 'frozen-story') {
      story.authoringFrozen = true
      await story.save()
    }
    if (kind === 'frozen-revision') {
      const rev = await ContentRevision.findById(chapter.draftRevisionId)
      rev.status = 'immutable'
      rev.immutableAt = new Date()
      await rev.save()
    }
    if (kind === 'active-submission')
      await PublicationSubmission.create({
        storyId: story._id,
        revisionId: story.currentRevisionId,
        authorAccountId: f.author.account._id,
        status: 'validated',
      })
    if (kind === 'foreign-archive') {
      chapter.status = 'archived'
      chapter.publicationTransition = { result: 'moderation-archived' }
      await chapter.save()
    }
    expect((await f.workspace()).body.chapters[0]).toMatchObject({
      canArchive: false,
      canRestore: false,
    })
    expect(
      (
        await write(
          f.path,
          f.author.cookie,
          await f.input(kind === 'foreign-archive' ? 'restore' : 'archive'),
        )
      ).status,
    ).toBe(409)
  })
  it('preserves restoration across archiving and restoring the parent story', async () => {
    const f = await fixture()
    await write(f.path, f.author.cookie, await f.input())
    let data = (await f.workspace()).body
    expect(data.story.canArchive).toBe(true)
    expect(
      (
        await write(`${f.base}/lifecycle`, f.author.cookie, {
          action: 'archive',
          expectedVersion: data.story.version,
        })
      ).status,
    ).toBe(200)
    expect((await write(f.path, f.author.cookie, await f.input('restore'))).status).toBe(409)
    data = (await f.workspace()).body
    expect(data.story.canRestore).toBe(true)
    expect(
      (
        await write(`${f.base}/lifecycle`, f.author.cookie, {
          action: 'restore',
          expectedVersion: data.story.version,
        })
      ).status,
    ).toBe(200)
    expect((await write(f.path, f.author.cookie, await f.input('restore'))).status).toBe(200)
  })
})
