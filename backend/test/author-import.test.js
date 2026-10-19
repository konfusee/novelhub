import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Story,
  Chapter,
  ContentRevision,
  ContentImport,
  AuditEvent,
  Category,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
import { pdfDocument } from './fixtures/documents.js'
useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (path, cookie, body) =>
  request(app).post(path).set('Cookie', cookie).set('Origin', origin).send(body)
const preview = (cookie, format = 'txt', bytes = Buffer.from('Nội dung thật.')) =>
  request(app)
    .post(`/api/author/imports/preview?format=${format}`)
    .set('Cookie', cookie)
    .set('Origin', origin)
    .set('Content-Type', 'application/octet-stream')
    .send(bytes)
async function fixture(format = 'txt') {
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const created = await write('/api/author/stories', author.cookie, {
    title: 'Truyện nhập',
    description: '',
    categoryIds: [String(category._id)],
  })
  const story = await Story.findById(created.body.story.id)
  const extracted = await preview(
    author.cookie,
    format,
    format === 'pdf' ? pdfDocument() : Buffer.from('Nội dung thật.'),
  )
  expect(extracted.status).toBe(200)
  const input = {
    receipt: extracted.body.receipt,
    storyId: String(story._id),
    expectedVersion: story.version,
    chapters: [
      { title: 'Chương nhập', paragraphs: [extracted.body.text] },
      { title: 'Chương hai', paragraphs: ['Tác giả đã kiểm tra và chỉnh sửa.'] },
    ],
  }
  return { author, story, input }
}
describe('author text document import', () => {
  it('preserves Markdown block boundaries through preview, draft save and editor reload', async () => {
    const f = await fixture()
    const extracted = await preview(
      f.author.cookie,
      'md',
      Buffer.from(
        '## Mở đầu\nNội dung đầu.\n\n```text\nĐoạn mã cuối\n```\n## Kết thúc\nNội dung sau.',
      ),
    )
    expect(extracted.status).toBe(200)
    expect(extracted.body.headings).toEqual([
      { level: 2, title: 'Mở đầu' },
      { level: 2, title: 'Kết thúc' },
    ])
    const boundary = extracted.body.text.indexOf('Kết thúc\n')
    expect(boundary).toBeGreaterThan(0)
    expect(extracted.body.text.slice(0, boundary)).toMatch(/Đoạn mã cuối\n{2,}$/)
    const parts = [extracted.body.text.slice(0, boundary), extracted.body.text.slice(boundary)]
    const saved = await write('/api/author/imports', f.author.cookie, {
      ...f.input,
      receipt: extracted.body.receipt,
      chapters: parts.map((text, index) => ({
        title: extracted.body.headings[index].title,
        paragraphs: [text.trim()],
      })),
    })
    expect(saved.status).toBe(201)
    for (const [index, id] of saved.body.chapterIds.entries()) {
      const loaded = await request(app)
        .get(`/api/author/stories/${f.story._id}/chapters/${id}`)
        .set('Cookie', f.author.cookie)
      expect(loaded.status).toBe(200)
      expect(loaded.body.chapter.paragraphs).toEqual([parts[index].trim()])
    }
  })
  it('preserves chunk-boundary spaces and emoji through import, editor reload and a new revision', async () => {
    const f = await fixture()
    const paragraphs = ['a'.repeat(19999) + ' ', ' 🌸 Nội dung tiếng Việt.']
    const response = await write('/api/author/imports', f.author.cookie, {
      ...f.input,
      chapters: [{ title: 'Chương dài', paragraphs }],
    })
    expect(response.status).toBe(201)
    const path = `/api/author/stories/${f.story._id}/chapters/${response.body.chapterIds[0]}`
    const loaded = await request(app).get(path).set('Cookie', f.author.cookie)
    expect(loaded.body.chapter.paragraphs).toEqual(paragraphs)
    const next = [...paragraphs, 'Đoạn vừa bổ sung 🌿.']
    const saved = await request(app)
      .put(path)
      .set('Cookie', f.author.cookie)
      .set('Origin', origin)
      .send({
        title: 'Chương dài',
        paragraphs: next,
        expectedVersion: loaded.body.chapter.version,
      })
    expect(saved.status).toBe(200)
    expect(
      (await request(app).get(path).set('Cookie', f.author.cookie)).body.chapter.paragraphs,
    ).toEqual(next)
    expect(
      (
        await ContentRevision.find({ chapterId: response.body.chapterIds[0] })
          .sort({ revisionNumber: 1 })
          .lean()
      ).map(revision => revision.content.blocks.map(block => block.text)),
    ).toEqual([paragraphs, next])
  })
  it('rejects broken Unicode and blank imports before creating any chapter', async () => {
    const f = await fixture()
    for (const paragraphs of [['Nội dung\ud83c'], [' '.repeat(10)], ['a'.repeat(20001)]]) {
      const response = await write('/api/author/imports', f.author.cookie, {
        ...f.input,
        chapters: [{ title: 'Không được lưu', paragraphs }],
      })
      expect(response.status).toBe(400)
    }
    expect(await Chapter.countDocuments()).toBe(0)
    expect(
      (
        await write(`/api/author/stories/${f.story._id}/chapters`, f.author.cookie, {
          title: 'Không được lưu',
          paragraphs: ['\udf38'],
        })
      ).status,
    ).toBe(400)
    expect(await Chapter.countDocuments()).toBe(0)
  })
  it.each(['txt', 'pdf'])(
    'saves reviewed %s chapters atomically with provenance and no original file',
    async format => {
      const f = await fixture(format)
      const response = await write('/api/author/imports', f.author.cookie, f.input)
      expect(response.status).toBe(201)
      expect(response.body.chapterIds).toHaveLength(2)
      const chapters = await Chapter.find({ storyId: f.story._id }).sort({ orderKey: 1 }).lean()
      expect(chapters.map(chapter => chapter.status)).toEqual(['draft', 'draft'])
      expect(chapters.map(chapter => chapter.orderKey)).toEqual([1, 2])
      const revision = await ContentRevision.findById(chapters[0].draftRevisionId).lean()
      expect(revision.content.blocks[0].text).toBe(f.input.chapters[0].paragraphs[0])
      expect(revision.status).toBe('editable')
      expect(
        await AuditEvent.countDocuments({
          action: 'content.imported',
          operationType: `text-import.${format}`,
        }),
      ).toBe(2)
      const imports = await ContentImport.find().lean()
      expect(imports).toHaveLength(format === 'pdf' ? 1 : 0)
      if (imports[0]) {
        expect(imports[0].sourceType).toBe('text-layer-pdf')
        expect(imports[0].extractedTextRef).toBeUndefined()
      }
      expect((await Story.findById(f.story._id)).publicationStatus).toBe('draft')
      const replay = await write('/api/author/imports', f.author.cookie, f.input)
      expect(replay.status).toBe(201)
      expect(replay.body.chapterIds.sort()).toEqual(response.body.chapterIds.sort())
      expect(await Chapter.countDocuments()).toBe(2)
      expect(
        (
          await write('/api/author/imports', f.author.cookie, {
            ...f.input,
            chapters: [{ title: 'Khác', paragraphs: ['Khác'] }],
          })
        ).status,
      ).toBe(409)
    },
  )
  it('requires author credentials and CSRF origin', async () => {
    const reader = await authenticatedAccount('reader')
    expect((await preview(reader.cookie)).status).toBe(403)
    expect((await request(app).get('/api/author/imports/targets')).status).toBe(401)
    const author = await authenticatedAccount('author')
    expect(
      (
        await request(app)
          .post('/api/author/imports/preview?format=txt')
          .set('Cookie', author.cookie)
          .set('Content-Type', 'application/octet-stream')
          .send(Buffer.from('Text'))
      ).status,
    ).toBe(403)
  })
  it('rejects forged receipts and imports owned by another author', async () => {
    const f = await fixture()
    expect(
      (
        await write('/api/author/imports', f.author.cookie, {
          ...f.input,
          receipt: f.input.receipt + 'x',
        })
      ).status,
    ).toBe(400)
    const other = await authenticatedAccount('author')
    expect((await write('/api/author/imports', other.cookie, f.input)).status).toBe(409)
    const ownPreview = await preview(other.cookie)
    expect(
      (
        await write('/api/author/imports', other.cookie, {
          ...f.input,
          receipt: ownPreview.body.receipt,
        })
      ).status,
    ).toBe(404)
    expect(await Chapter.countDocuments()).toBe(0)
  })
  it('rejects stale versions and frozen targets without orphan chapters', async () => {
    const f = await fixture()
    expect(
      (await write('/api/author/imports', f.author.cookie, { ...f.input, expectedVersion: 999 }))
        .status,
    ).toBe(409)
    f.story.authoringFrozen = true
    await f.story.save()
    expect((await write('/api/author/imports', f.author.cookie, f.input)).status).toBe(409)
    expect(
      (await request(app).get('/api/author/imports/targets').set('Cookie', f.author.cookie)).body
        .items,
    ).toEqual([])
    expect(await Chapter.countDocuments()).toBe(0)
  })
  it('rolls back every chapter when provenance cannot be saved', async () => {
    const f = await fixture()
    const before = await ContentRevision.countDocuments()
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('storage failure'))
    expect((await write('/api/author/imports', f.author.cookie, f.input)).status).toBe(500)
    expect(await Chapter.countDocuments()).toBe(0)
    expect(await ContentRevision.countDocuments()).toBe(before)
    expect((await write('/api/author/imports', f.author.cookie, f.input)).status).toBe(201)
  })
  it('replays concurrent identical requests once', async () => {
    const f = await fixture()
    const responses = await Promise.all([
      write('/api/author/imports', f.author.cookie, f.input),
      write('/api/author/imports', f.author.cookie, f.input),
    ])
    expect(responses.map(response => response.status)).toEqual([201, 201])
    expect(await Chapter.countDocuments()).toBe(2)
  })
})
