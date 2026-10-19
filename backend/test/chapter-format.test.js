import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Category, Chapter, ContentRevision } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (method, path, cookie, body) =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body)
async function fixture() {
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Thử nghiệm',
    normalizedName: 'thử nghiệm',
    createdBy: author.account._id,
  })
  const story = await write('post', '/api/author/stories', author.cookie, {
    title: 'Truyện',
    description: '',
    categoryIds: [String(category._id)],
  })
  const base = `/api/author/stories/${story.body.story.id}/chapters`
  const created = await write('post', base, author.cookie, {
    title: 'Chương',
    paragraphs: ['Nội dung nguyên vẹn.'],
  })
  const chapter = await Chapter.findById(created.body.chapter.id)
  const revision = await ContentRevision.findById(chapter.draftRevisionId)
  return { author, chapter, revision, path: `${base}/${chapter._id}` }
}
describe('chapter editor round-trip protection', () => {
  const document = {
    title: 'Chương có định dạng',
    blocks: [
      { type: 'heading', level: 2, inlines: [{ text: 'Mở đầu', marks: [] }] },
      {
        type: 'paragraph',
        inlines: [
          { text: 'Tiếng Việt 👩‍💻', marks: ['italic', 'bold'] },
          { text: ' nguyên vẹn', marks: ['underline'] },
        ],
      },
      { type: 'scene-break' },
      { type: 'quote', inlines: [{ text: 'Lời trích dẫn', marks: [] }] },
    ],
  }
  it('creates a structured chapter in one transaction instead of flattening a duplicate', async () => {
    const f = await fixture()
    const base = f.path.slice(0, f.path.lastIndexOf('/'))
    const created = await write('post', base, f.author.cookie, { document })
    expect(created.status).toBe(201)
    const read = await request(app)
      .get(`${base}/${created.body.chapter.id}?format=rich`)
      .set('Cookie', f.author.cookie)
    expect(read.body.chapter.document.blocks[1].inlines[0]).toEqual({
      text: 'Tiếng Việt 👩‍💻',
      marks: ['bold', 'italic'],
    })
    expect(
      (
        await write('post', base, f.author.cookie, {
          document,
          paragraphs: ['Không được bỏ định dạng'],
        })
      ).status,
    ).toBe(400)
    expect(await Chapter.countDocuments({ storyId: f.chapter.storyId })).toBe(2)
  })
  it('upgrades plain drafts explicitly, stores rich revisions and refuses lossy legacy saves', async () => {
    const f = await fixture()
    const upgraded = await request(app).get(`${f.path}?format=rich`).set('Cookie', f.author.cookie)
    expect(upgraded.status).toBe(200)
    expect(upgraded.body.chapter.document.blocks).toEqual([
      { type: 'paragraph', inlines: [{ text: 'Nội dung nguyên vẹn.', marks: [] }] },
    ])
    expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1)
    const saved = await write('put', f.path, f.author.cookie, {
      document,
      expectedVersion: f.chapter.version,
    })
    expect(saved.status).toBe(200)
    const read = await request(app).get(`${f.path}?format=rich`).set('Cookie', f.author.cookie)
    const normalized = structuredClone(document)
    normalized.blocks[1].inlines[0].marks = ['bold', 'italic']
    expect(read.body.chapter.document).toEqual(normalized)
    expect(read.body.chapter.title).toBe(document.title)
    const original = await ContentRevision.findById(f.revision._id)
    expect(original.content.blocks[0].text).toBe('Nội dung nguyên vẹn.')
    const latest = await ContentRevision.findOne({ chapterId: f.chapter._id, revisionNumber: 2 })
    expect(latest.formatVersion).toBe('blocks-v2')
    expect(latest.content).toEqual(normalized)
    expect(latest.parentRevisionId.equals(f.revision._id)).toBe(true)
    const drafts = await request(app).get('/api/author/drafts').set('Cookie', f.author.cookie)
    expect(drafts.body.items[0].excerpt).toBe('Mở đầu\n\nTiếng Việt 👩‍💻 nguyên vẹn\n\nLời trích dẫn')
    expect(drafts.body.items[0].words).toBe(10)
    const dashboard = await request(app).get('/api/author/dashboard').set('Cookie', f.author.cookie)
    expect(dashboard.body.drafts[0].written).toBe(10)
    const legacy = await write('put', f.path, f.author.cookie, {
      title: 'Mất định dạng',
      paragraphs: ['Không cho phép'],
      expectedVersion: saved.body.chapter.version,
    })
    expect(legacy.status).toBe(409)
    expect(legacy.body.error.code).toBe('unsupported_editor_format')
    const stale = await write('put', f.path, f.author.cookie, {
      document,
      expectedVersion: f.chapter.version,
    })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('stale_content')
    expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(2)
  })
  it('applies ownership and frozen-source protection to rich writes', async () => {
    const f = await fixture()
    const other = await authenticatedAccount('author')
    expect(
      (await request(app).get(`${f.path}?format=rich`).set('Cookie', other.cookie)).status,
    ).toBe(404)
    expect(
      (await write('put', f.path, other.cookie, { document, expectedVersion: f.chapter.version }))
        .status,
    ).toBe(404)
    f.revision.immutableAt = new Date()
    f.revision.status = 'submitted'
    await f.revision.save()
    expect(
      (await request(app).get(`${f.path}?format=rich`).set('Cookie', f.author.cookie)).body.chapter
        .canEdit,
    ).toBe(false)
    const saved = await write('put', f.path, f.author.cookie, {
      document,
      expectedVersion: f.chapter.version,
    })
    expect(saved.body.error.code).toBe('content_frozen')
    expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1)
  })
  it.each([
    { type: 'image', mediaId: 'unowned' },
    { type: 'paragraph', inlines: [{ text: 'x', marks: ['script'] }] },
    { type: 'paragraph', inlines: [{ text: 'x', marks: ['bold', 'bold'] }] },
    { type: 'heading', level: 1, inlines: [] },
    { type: 'paragraph', inlines: [{ text: '\ud800', marks: [] }] },
    { type: 'paragraph', inlines: [{ text: 'x', marks: [], html: '<script>' }] },
    {
      type: 'paragraph',
      inlines: [
        { text: 'x'.repeat(10001), marks: [] },
        { text: 'y'.repeat(10000), marks: [] },
      ],
    },
  ])('rejects unsupported/invalid AST without altering MongoDB', async block => {
    const f = await fixture()
    const saved = await write('put', f.path, f.author.cookie, {
      document: { title: 'Chương', blocks: [block] },
      expectedVersion: f.chapter.version,
    })
    expect(saved.status).toBe(400)
    expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1)
    expect((await Chapter.findById(f.chapter._id)).version).toBe(f.chapter.version)
  })
  it.each(['heading', 'image', 'marks', 'future-format'])(
    'does not flatten or overwrite %s content',
    async kind => {
      const f = await fixture()
      const content = {
        title: 'Chương',
        blocks: [{ type: 'paragraph', text: 'Nội dung nguyên vẹn.' }],
      }
      if (kind === 'heading')
        content.blocks.push({ type: 'heading', level: 2, text: 'Tiêu đề cần giữ' })
      if (kind === 'image')
        content.blocks.push({
          type: 'image',
          mediaId: String(f.author.account._id),
          alt: 'Ảnh cần giữ',
        })
      if (kind === 'marks') content.blocks[0].marks = [{ type: 'bold', from: 0, to: 8 }]
      f.revision.content = content
      if (kind === 'future-format') f.revision.formatVersion = 'blocks-v99'
      await f.revision.save()
      const read = await request(app).get(f.path).set('Cookie', f.author.cookie)
      expect(read.status).toBe(409)
      expect(read.body.error.code).toBe('unsupported_editor_format')
      const saved = await write('put', f.path, f.author.cookie, {
        title: 'Ghi đè thiếu',
        paragraphs: ['Chỉ còn văn bản'],
        expectedVersion: f.chapter.version,
      })
      expect(saved.status).toBe(409)
      expect(saved.body.error.code).toBe('unsupported_editor_format')
      const richRead = await request(app)
        .get(`${f.path}?format=rich`)
        .set('Cookie', f.author.cookie)
      expect(richRead.status).toBe(409)
      const richSave = await write('put', f.path, f.author.cookie, {
        document,
        expectedVersion: f.chapter.version,
      })
      expect(richSave.status).toBe(409)
      expect(richSave.body.error.code).toBe('unsupported_editor_format')
      expect((await ContentRevision.findById(f.revision._id)).content).toEqual(content)
      expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1)
      expect((await Chapter.findById(f.chapter._id)).version).toBe(f.chapter.version)
    },
  )
  it('keeps a frozen revision read-only even when the chapter status is still draft', async () => {
    const f = await fixture()
    f.revision.immutableAt = new Date()
    f.revision.status = 'submitted'
    await f.revision.save()
    const read = await request(app).get(f.path).set('Cookie', f.author.cookie)
    expect(read.body.chapter.canEdit).toBe(false)
    expect(read.body.chapter.paragraphs).toEqual(['Nội dung nguyên vẹn.'])
    const result = await write('put', f.path, f.author.cookie, {
      title: 'Ghi đè',
      paragraphs: ['Sai'],
      expectedVersion: f.chapter.version,
    })
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('content_frozen')
    expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1)
  })
})
