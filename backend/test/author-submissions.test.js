import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  PublicationSubmission,
  RightsDeclaration,
  Story,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (path, cookie, body, method = 'post') =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body)
async function fixture() {
  const author = await authenticatedAccount('author')
  const other = await authenticatedAccount('author')
  const reader = await authenticatedAccount()
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const created = await write('/api/author/stories', author.cookie, {
    title: 'Bản nháp của tôi',
    description: 'Tóm tắt thật để gửi duyệt.',
    categoryIds: [String(category._id)],
  })
  const storyId = created.body.story.id
  const prepare = () =>
    request(app)
      .get(`/api/author/submissions/prepare?storyId=${storyId}`)
      .set('Cookie', author.cookie)
  const prepared = (await prepare()).body
  const body = {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  }
  return { author, other, reader, category, storyId, body, prepare }
}
describe('exact owner submission packages', () => {
  it('creates a new editable revision after feedback, preserves history and resubmits as a new package', async () => {
    const f = await fixture()
    const sent = await write('/api/author/submissions', f.author.cookie, f.body)
    const submission = await PublicationSubmission.findById(sent.body.submission.id)
    const path = `/api/author/submissions/${submission._id}/revise`
    expect(
      (await write(path, f.author.cookie, { expectedVersion: submission.version })).status,
    ).toBe(409)
    submission.status = 'rejected'
    submission.decisionSummary = 'Cần làm rõ phần tóm tắt.'
    await submission.save()
    const input = { expectedVersion: submission.version }
    expect((await write(path, f.other.cookie, input)).status).toBe(404)
    expect((await write(path, f.reader.cookie, input)).status).toBe(403)
    expect(
      (await write(path, f.author.cookie, { expectedVersion: input.expectedVersion - 1 })).status,
    ).toBe(409)
    const results = await Promise.all([
      write(path, f.author.cookie, input),
      write(path, f.author.cookie, input),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 201])
    expect(results[0].body.revision.id).toBe(results[1].body.revision.id)
    const old = await ContentRevision.findById(f.body.revisionId)
    const story = await Story.findById(f.storyId)
    const fresh = await ContentRevision.findById(story.draftRevisionId)
    expect(fresh.status).toBe('editable')
    expect(fresh.content).toEqual(old.content)
    expect(String(fresh.parentRevisionId)).toBe(String(old._id))
    expect(fresh.rightsDeclarationId).toBeUndefined()
    expect(fresh.immutableAt).toBeUndefined()
    expect(old.immutableAt).toBeTruthy()
    expect(old.packageDigest).toBeTruthy()
    expect(story.authoringFrozen).toBe(false)
    expect(story.publicationStatus).toBe('draft')
    expect(await ModerationHistory.countDocuments({ action: 'revision-created' })).toBe(1)
    expect((await PublicationSubmission.findById(submission._id)).decisionSummary).toBe(
      'Cần làm rõ phần tóm tắt.',
    )
    const prepared = (await f.prepare()).body
    const next = await write('/api/author/submissions', f.author.cookie, {
      ...f.body,
      revisionId: prepared.target.revisionId,
      expectedVersion: prepared.target.version,
    })
    expect(next.status).toBe(201)
    expect(next.body.submission.id).not.toBe(String(submission._id))
    expect(await RightsDeclaration.countDocuments()).toBe(2)
    expect(await EvidenceBatch.countDocuments()).toBe(2)
    expect((await write(path, f.author.cookie, input)).status).toBe(409)
  })
  it('rolls back a new revision and unlock if its audit write fails', async () => {
    const f = await fixture()
    const sent = await write('/api/author/submissions', f.author.cookie, f.body)
    const submission = await PublicationSubmission.findById(sent.body.submission.id)
    submission.status = 'rejected'
    await submission.save()
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'))
    expect(
      (
        await write(`/api/author/submissions/${submission._id}/revise`, f.author.cookie, {
          expectedVersion: submission.version,
        })
      ).status,
    ).toBe(500)
    expect(await ContentRevision.countDocuments()).toBe(1)
    expect((await Story.findById(f.storyId)).authoringFrozen).toBe(true)
    expect(await ModerationHistory.countDocuments({ action: 'revision-created' })).toBe(0)
  })
  it('blocks inactive genres and unhandled media without freezing or creating evidence', async () => {
    const f = await fixture()
    f.category.status = 'retired'
    await f.category.save()
    expect((await f.prepare()).body.checks.find(row => row.code === 'categories').ok).toBe(false)
    expect((await write('/api/author/submissions', f.author.cookie, f.body)).status).toBe(409)
    f.category.status = 'active'
    await f.category.save()
    const story = await Story.findById(f.storyId)
    // Covers are supported now. Unsupported references must be placed in the submitted revision.
    const revision = await ContentRevision.findById(f.body.revisionId)
    revision.mediaIds = [f.category._id]
    await revision.save()
    expect((await f.prepare()).body.checks.find(row => row.code === 'media').ok).toBe(false)
    expect(
      (
        await write('/api/author/submissions', f.author.cookie, {
          ...f.body,
          expectedVersion: story.version,
        })
      ).status,
    ).toBe(409)
    expect(await PublicationSubmission.countDocuments()).toBe(0)
    expect(await EvidenceBatch.countDocuments()).toBe(0)
    expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeUndefined()
  })
  it('freezes once atomically, preserves the public snapshot and replays identical concurrent submissions', async () => {
    const f = await fixture()
    const story = await Story.findById(f.storyId)
    const publicRevision = await ContentRevision.create({
      storyId: story._id,
      authorAccountId: f.author.account._id,
      contentType: 'story',
      revisionNumber: 2,
      formatVersion: 'story-v1',
      status: 'approved',
      content: {
        title: 'Tên đang công khai',
        description: 'Public snapshot',
        categoryIds: [String(f.category._id)],
      },
    })
    story.publicationStatus = 'published'
    story.publishedRevisionId = publicRevision._id
    await story.save()
    f.body.expectedVersion = story.version
    const results = await Promise.all([
      write('/api/author/submissions', f.author.cookie, f.body),
      write('/api/author/submissions', f.author.cookie, f.body),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 201])
    expect(results[0].body.submission.id).toBe(results[1].body.submission.id)
    for (const Model of [
      PublicationSubmission,
      EvidenceBatch,
      RightsDeclaration,
      AuditEvent,
      ModerationHistory,
    ])
      expect(await Model.countDocuments()).toBe(1)
    const revision = await ContentRevision.findById(f.body.revisionId)
    expect(revision.status).toBe('submitted')
    expect(revision.immutableAt).toBeTruthy()
    expect(revision.packageDigest).toMatch(/^[a-f0-9]{64}$/)
    revision.set('content', { ...revision.content, title: 'Không được ghi đè' })
    await expect(revision.save()).rejects.toThrow()
    const saved = await Story.findById(f.storyId)
    expect(saved.publicationStatus).toBe('published')
    expect(String(saved.publishedRevisionId)).toBe(String(publicRevision._id))
    expect(saved.authoringFrozen).toBe(true)
    expect((await EvidenceBatch.findOne()).status).toBe('pending')
    expect((await PublicationSubmission.findOne()).status).toBe('validated')
    const list = await request(app).get('/api/author/submissions').set('Cookie', f.author.cookie)
    expect(list.body.items[0]).toMatchObject({
      title: 'Bản nháp của tôi',
      status: 'validated',
      processing: { status: 'pending' },
    })
    expect(list.body.items[0].history[0].action).toBe('submitted')
    expect(
      (await request(app).get('/api/author/submissions').set('Cookie', f.other.cookie)).body.items,
    ).toEqual([])
    expect(
      (
        await write('/api/author/submissions', f.author.cookie, {
          ...f.body,
          rights: { ...f.body.rights, basis: 'licensed' },
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await write(
          `/api/author/stories/${f.storyId}`,
          f.author.cookie,
          {
            title: 'Stale save',
            description: 'Không sửa khi chờ duyệt',
            expectedVersion: saved.version,
          },
          'put',
        )
      ).status,
    ).toBe(409)
  })
  it('rejects forged ownership, missing rights, stale versions and invalid package content', async () => {
    const f = await fixture()
    expect((await write('/api/author/submissions', f.other.cookie, f.body)).status).toBe(404)
    expect((await write('/api/author/submissions', f.reader.cookie, f.body)).status).toBe(403)
    expect(
      (
        await write('/api/author/submissions', f.author.cookie, {
          ...f.body,
          authorAccountId: String(f.other.account._id),
        })
      ).status,
    ).toBe(400)
    expect(
      (await write('/api/author/submissions', f.author.cookie, { ...f.body, rights: undefined }))
        .status,
    ).toBe(400)
    expect(
      (await write('/api/author/submissions', f.author.cookie, { ...f.body, expectedVersion: 100 }))
        .status,
    ).toBe(409)
    const revision = await ContentRevision.findById(f.body.revisionId)
    revision.content = { ...revision.content, description: '<script>alert(1)</script>' }
    await revision.save()
    expect((await f.prepare()).body.checks.find(check => check.code === 'content').ok).toBe(false)
    expect((await write('/api/author/submissions', f.author.cookie, f.body)).status).toBe(409)
    expect(await PublicationSubmission.countDocuments()).toBe(0)
  })
  it('rolls back revision locks and all related records when the final audit write fails', async () => {
    const f = await fixture()
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'))
    expect((await write('/api/author/submissions', f.author.cookie, f.body)).status).toBe(500)
    expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeFalsy()
    expect((await Story.findById(f.storyId)).authoringFrozen).toBe(false)
    for (const Model of [
      PublicationSubmission,
      EvidenceBatch,
      RightsDeclaration,
      ModerationHistory,
    ])
      expect(await Model.countDocuments()).toBe(0)
  })
  it.each(['blocks-v1', 'blocks-v2'])(
    'submits %s only under an approved parent with frozen story rights',
    async format => {
      const f = await fixture()
      const created = await write(`/api/author/stories/${f.storyId}/chapters`, f.author.cookie, {
        title: 'Chương thật',
        paragraphs: ['Nội dung chương hoàn chỉnh.'],
      })
      const chapterId = created.body.chapter.id
      if (format === 'blocks-v2') {
        const updated = await write(
          `/api/author/stories/${f.storyId}/chapters/${chapterId}`,
          f.author.cookie,
          {
            expectedVersion: created.body.chapter.version,
            document: {
              title: 'Chương thật',
              blocks: [
                { type: 'heading', level: 2, inlines: [{ text: 'Mở đầu', marks: [] }] },
                {
                  type: 'paragraph',
                  inlines: [{ text: 'Nội dung chương hoàn chỉnh.', marks: ['bold', 'italic'] }],
                },
                { type: 'scene-break' },
              ],
            },
          },
          'put',
        )
        expect(updated.status).toBe(200)
      }
      const prepare = () =>
        request(app)
          .get(`/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${chapterId}`)
          .set('Cookie', f.author.cookie)
      expect((await prepare()).body.checks.find(check => check.code === 'parent').ok).toBe(false)
      const story = await Story.findById(f.storyId)
      const revision = await ContentRevision.findById(story.currentRevisionId)
      revision.status = 'approved'
      revision.immutableAt = new Date()
      await revision.save()
      const submission = await PublicationSubmission.create({
        storyId: story._id,
        revisionId: revision._id,
        authorAccountId: f.author.account._id,
        status: 'approved',
      })
      await RightsDeclaration.create({
        storyId: story._id,
        submissionId: submission._id,
        revisionId: revision._id,
        basis: 'original',
        asserted: true,
        declaredBy: f.author.account._id,
        status: 'asserted',
        immutableAt: new Date(),
      })
      story.publicationStatus = 'approved'
      await story.save()
      const prepared = (await prepare()).body
      expect(prepared.ready).toBe(true)
      expect(prepared.requiresRights).toBe(false)
      const body = {
        storyId: f.storyId,
        chapterId,
        revisionId: prepared.target.revisionId,
        expectedVersion: prepared.target.version,
      }
      expect((await write('/api/author/submissions', f.author.cookie, body)).status).toBe(201)
      expect((await Chapter.findById(chapterId)).status).toBe('submitted')
      const frozen = await ContentRevision.findById(prepared.target.revisionId)
      const storedSubmission = await PublicationSubmission.findOne({ revisionId: frozen._id })
      const packageResponse = await request(app)
        .get(`/api/author/submissions/${storedSubmission._id}/package`)
        .set('Cookie', f.author.cookie)
      expect(packageResponse.status).toBe(200)
      expect(packageResponse.body.revision.id).toBe(String(frozen._id))
      expect(
        packageResponse.body.chapter.document.blocks.some(block => block.type === 'paragraph'),
      ).toBe(true)
      expect(frozen.formatVersion).toBe(format)
      expect(frozen.immutableAt).toBeTruthy()
      if (format === 'blocks-v2')
        expect(frozen.content.blocks[1].inlines[0].marks).toEqual(['bold', 'italic'])
      expect(await RightsDeclaration.countDocuments()).toBe(1)
    },
  )
})
it('reads the original submitted story after a new draft and denies other accounts without mutations', async () => {
  const f = await fixture()
  const sent = await write('/api/author/submissions', f.author.cookie, f.body)
  const submission = await PublicationSubmission.findById(sent.body.submission.id)
  submission.status = 'rejected'
  await submission.save()
  await write(`/api/author/submissions/${submission._id}/revise`, f.author.cookie, {
    expectedVersion: submission.version,
  })
  const story = await Story.findById(f.storyId)
  const draft = await ContentRevision.findById(story.draftRevisionId)
  draft.content = { ...draft.content, title: 'Tên bản nháp mới', description: 'Nội dung mới' }
  await draft.save()
  const endpoint = `/api/author/submissions/${submission._id}/package`
  const before = await AuditEvent.countDocuments()
  const response = await request(app).get(endpoint).set('Cookie', f.author.cookie)
  expect(response.status).toBe(200)
  expect(response.body.metadata.title).toBe('Bản nháp của tôi')
  expect(response.body.metadata.description).toBe('Tóm tắt thật để gửi duyệt.')
  expect(response.body.rights).toEqual(f.body.rights)
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.body).not.toHaveProperty('objectKey')
  expect((await request(app).get(endpoint).set('Cookie', f.other.cookie)).status).toBe(404)
  for (const role of ['reader', 'moderator', 'admin']) {
    const account = await authenticatedAccount(role)
    expect((await request(app).get(endpoint).set('Cookie', account.cookie)).status).toBe(403)
  }
  expect((await request(app).get(endpoint)).status).toBe(401)
  expect(await AuditEvent.countDocuments()).toBe(before)
})
it('rejects a corrupt frozen package instead of displaying a current draft', async () => {
  const f = await fixture()
  const sent = await write('/api/author/submissions', f.author.cookie, f.body)
  // Simulate damaged persisted data, bypassing normal immutable model guards in this isolated fixture.
  await ContentRevision.collection.updateOne(
    { _id: (await ContentRevision.findById(f.body.revisionId))._id },
    { $set: { 'content.title': 'Damaged' } },
  )
  const response = await request(app)
    .get(`/api/author/submissions/${sent.body.submission.id}/package`)
    .set('Cookie', f.author.cookie)
  expect(response.status).toBe(409)
  expect(response.body.error.code).toBe('package_unavailable')
})
