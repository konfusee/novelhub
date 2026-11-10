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
    title: 'Truyện cần lưu trữ',
    description: 'Tóm tắt của bản nháp.',
    categoryIds: [String(category._id)],
  })
  const story = await Story.findById(created.body.story.id)
  const base = `/api/author/stories/${story._id}`
  const chapter = await write(`${base}/chapters`, author.cookie, {
    title: 'Chương một',
    paragraphs: ['Nội dung không được mất.'],
  })
  return { author, story, base, chapterId: chapter.body.chapter.id, path: `${base}/lifecycle` }
}
describe('private author draft lifecycle', () => {
  it('archives and restores without deleting content or publishing anything', async () => {
    const f = await fixture()
    const workspace = () => request(app).get(`${f.base}/workspace`).set('Cookie', f.author.cookie)
    expect((await workspace()).body.story.canArchive).toBe(true)
    const before = await ContentRevision.countDocuments()
    const archived = await write(f.path, f.author.cookie, {
      action: 'archive',
      expectedVersion: f.story.version,
    })
    expect(archived.status).toBe(200)
    expect(archived.body.story.status).toBe('archived')
    expect((await workspace()).body.story).toMatchObject({
      canEdit: false,
      canArchive: false,
      canRestore: true,
    })
    expect(
      (
        await write(`${f.base}/chapters`, f.author.cookie, {
          title: 'Không được tạo',
          paragraphs: ['Sai'],
        })
      ).status,
    ).toBe(409)
    expect(
      (await request(app).get('/api/author/drafts').set('Cookie', f.author.cookie)).body.items,
    ).toEqual([])
    expect(await ContentRevision.countDocuments()).toBe(before)
    expect(await Chapter.countDocuments({ storyId: f.story._id })).toBe(1)
    expect((await request(app).get('/api/catalog/stories')).body.total).toBe(0)
    const restored = await write(f.path, f.author.cookie, {
      action: 'restore',
      expectedVersion: archived.body.story.version,
    })
    expect(restored.status).toBe(200)
    expect(restored.body.story.status).toBe('draft')
    expect((await workspace()).body.story.canEdit).toBe(true)
    expect(
      (await request(app).get('/api/author/drafts').set('Cookie', f.author.cookie)).body.items,
    ).toHaveLength(1)
    expect(
      await AuditEvent.countDocuments({
        targetId: f.story._id,
        action: { $in: ['story.draft-archived', 'story.draft-restored'] },
      }),
    ).toBe(2)
    expect(await ContentRevision.countDocuments()).toBe(before)
  })
  it('checks ownership, role, origin, state and version; concurrent archive commits only once', async () => {
    const f = await fixture()
    const other = await authenticatedAccount('author')
    const reader = await authenticatedAccount()
    const input = { action: 'archive', expectedVersion: f.story.version }
    expect((await write(f.path, other.cookie, input)).status).toBe(404)
    expect((await write(f.path, reader.cookie, input)).status).toBe(403)
    expect(
      (await request(app).post(f.path).set('Cookie', f.author.cookie).send(input)).status,
    ).toBe(403)
    expect((await write(f.path, f.author.cookie, { ...input, action: 'purge' })).status).toBe(400)
    const results = await Promise.all([
      write(f.path, f.author.cookie, input),
      write(f.path, f.author.cookie, input),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 409])
    expect(await AuditEvent.countDocuments({ action: 'story.draft-archived' })).toBe(1)
  })
  it.each(['published', 'chapter-released', 'pending', 'frozen'])(
    'blocks archive for %s content',
    async kind => {
      const f = await fixture()
      if (kind === 'published') {
        f.story.publishedAt = new Date()
        await f.story.save()
      }
      if (kind === 'frozen') {
        f.story.authoringFrozen = true
        await f.story.save()
      }
      if (kind === 'chapter-released') {
        const chapter = await Chapter.findById(f.chapterId)
        chapter.firstReleasedAt = new Date()
        await chapter.save()
      }
      if (kind === 'pending')
        await PublicationSubmission.create({
          storyId: f.story._id,
          revisionId: f.story.currentRevisionId,
          authorAccountId: f.author.account._id,
          status: 'validated',
        })
      const current = await Story.findById(f.story._id)
      expect(
        (
          await write(f.path, f.author.cookie, {
            action: 'archive',
            expectedVersion: current.version,
          })
        ).status,
      ).toBe(409)
      expect((await Story.findById(current._id)).publicationStatus).toBe('draft')
    },
  )
  it('does not restore an administrative archive and rolls back when audit fails', async () => {
    const f = await fixture()
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'))
    expect(
      (
        await write(f.path, f.author.cookie, {
          action: 'archive',
          expectedVersion: f.story.version,
        })
      ).status,
    ).toBe(500)
    expect((await Story.findById(f.story._id)).publicationStatus).toBe('draft')
    f.story.publicationStatus = 'archived'
    f.story.publicationTransition = { result: 'admin-archived' }
    await f.story.save()
    expect(
      (
        await write(f.path, f.author.cookie, {
          action: 'restore',
          expectedVersion: f.story.version,
        })
      ).status,
    ).toBe(409)
  })
})
