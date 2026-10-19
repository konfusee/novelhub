import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  Category,
  ContentRevision,
  EvidenceBatch,
  PublicationSubmission,
  RightsDeclaration,
  RoleAssignment,
  Story,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (cookie, path, body) =>
  request(app).post(path).set('Cookie', cookie).set('Origin', origin).send(body)
async function fixture() {
  const admin = await authenticatedAccount('admin'),
    author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const created = await write(author.cookie, '/api/author/stories', {
    title: 'Tên gốc',
    description: 'Mô tả gốc.',
    categoryIds: [String(category._id)],
  })
  const id = created.body.story.id
  const prep = (
    await request(app)
      .get(`/api/author/submissions/prepare?storyId=${id}`)
      .set('Cookie', author.cookie)
  ).body
  const sent = await write(author.cookie, '/api/author/submissions', {
    storyId: id,
    revisionId: prep.target.revisionId,
    expectedVersion: prep.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  })
  expect(sent.status).toBe(201)
  const submission = await PublicationSubmission.findById(sent.body.submission.id),
    revision = await ContentRevision.findById(submission.revisionId),
    story = await Story.findById(id),
    batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
  submission.status = 'approved'
  await submission.save()
  revision.status = 'approved'
  await revision.save()
  batch.status = 'failed'
  batch.failedStage = 'comparison'
  await batch.save()
  story.publicationStatus = 'approved'
  story.authoringFrozen = false
  await story.save()
  expect(
    (
      await write(author.cookie, `/api/author/stories/${id}/release`, {
        revisionId: String(revision._id),
        submissionId: String(submission._id),
        expectedVersion: story.version,
      })
    ).status,
  ).toBe(201)
  const role = await RoleAssignment.findOne({
      accountId: author.account._id,
      role: 'author',
      status: 'active',
    }),
    account = await Account.findById(author.account._id)
  const revoke = () =>
    write(admin.cookie, `/api/admin/authors/${account._id}/revoke`, {
      roleId: String(role._id),
      expectedRoleVersion: role.version,
      expectedAccountVersion: account.version,
      reason: 'Thu hồi quyền',
    })
  return { admin, author, category, id, revoke, path: `/api/admin/former-author-stories/${id}` }
}
async function baseline(f) {
  const response = await request(app).get(f.path).set('Cookie', f.admin.cookie)
  expect(response.status).toBe(200)
  return response.body.story
}
const input = (story, action = 'correct') => ({
  action,
  expectedVersion: story.version,
  expectedPublishedRevisionId: story.publishedRevisionId,
  reason: 'Quản trị sửa thông tin',
  ...(action === 'correct'
    ? { title: 'Tên quản trị sửa', description: 'Mô tả sửa.', categoryIds: story.categoryIds }
    : {}),
})
it('corrects and republishes metadata by explicit Admin exception without rewriting rights or old revisions', async () => {
  const f = await fixture()
  expect((await f.revoke()).status).toBe(200)
  const original = await ContentRevision.find({ storyId: f.id }).lean(),
    rights = await RightsDeclaration.find({ storyId: f.id }).lean()
  let state = await baseline(f)
  expect((await write(f.admin.cookie, f.path, input(state))).status).toBe(200)
  expect((await request(app).get(`/api/catalog/stories/${f.id}`)).body.story.title).toBe(
    'Tên quản trị sửa',
  )
  state = await baseline(f)
  expect((await write(f.admin.cookie, f.path, input(state, 'unpublish'))).status).toBe(200)
  expect((await request(app).get(`/api/catalog/stories/${f.id}`)).status).toBe(404)
  state = await baseline(f)
  expect((await write(f.admin.cookie, f.path, input(state, 'republish'))).status).toBe(200)
  expect((await request(app).get(`/api/catalog/stories/${f.id}`)).status).toBe(200)
  expect(
    await ContentRevision.find({ _id: { $in: original.map(item => item._id) } }).lean(),
  ).toEqual(original)
  expect(await RightsDeclaration.find({ storyId: f.id }).lean()).toEqual(rights)
  expect((await Story.findById(f.id)).authoringFrozen).toBe(true)
  expect(
    await AuditEvent.countDocuments({
      targetId: f.id,
      action: { $regex: '^former-author.story.' },
    }),
  ).toBe(3)
})
it('preserves original provenance across repeated corrections and rejects a tampered correction', async () => {
  const f = await fixture()
  await f.revoke()
  const original = await baseline(f)
  expect((await write(f.admin.cookie, f.path, input(original))).status).toBe(200)
  const corrected = await baseline(f)
  expect(
    (await write(f.admin.cookie, f.path, { ...input(corrected), title: 'Hiệu chỉnh lần hai' }))
      .status,
  ).toBe(200)
  const latest = await baseline(f)
  const revision = await ContentRevision.findById(latest.publishedRevisionId).lean()
  expect(revision.validation.adminFormerAuthorCorrection.rootRevisionId).toBe(
    original.publishedRevisionId,
  )
  expect(revision.validation.adminFormerAuthorCorrection.previousPublishedRevisionId).toBe(
    corrected.publishedRevisionId,
  )
  await ContentRevision.collection.updateOne(
    { _id: revision._id },
    { $set: { 'content.title': 'Không khớp digest' } },
  )
  expect((await request(app).get(f.path).set('Cookie', f.admin.cookie)).status).toBe(409)
  expect((await write(f.admin.cookie, f.path, input(latest, 'unpublish'))).status).toBe(409)
  expect((await Story.findById(f.id)).version).toBe(latest.version)
})
it('blocks routine Author content, stale writes, invalid categories, non-Admin and suspended owners', async () => {
  const f = await fixture()
  expect((await request(app).get(f.path).set('Cookie', f.admin.cookie)).status).toBe(409)
  expect((await request(app).get(f.path).set('Cookie', f.author.cookie)).status).toBe(403)
  await f.revoke()
  const story = await baseline(f)
  expect(
    (await write(f.admin.cookie, f.path, { ...input(story), expectedVersion: 0 })).status,
  ).toBe(409)
  await Category.updateOne({ _id: f.category._id }, { $set: { status: 'retired' } })
  expect((await write(f.admin.cookie, f.path, input(story))).status).toBe(409)
  await Account.updateOne({ _id: f.author.account._id }, { $set: { status: 'suspended' } })
  expect((await write(f.admin.cookie, f.path, input(story, 'unpublish'))).status).toBe(409)
})
it('rolls back a correction on audit failure and serializes writes to the published baseline', async () => {
  const f = await fixture()
  await f.revoke()
  const story = await baseline(f),
    count = await ContentRevision.countDocuments({ storyId: f.id })
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit failed'))
  expect((await write(f.admin.cookie, f.path, input(story))).status).toBe(500)
  expect(await ContentRevision.countDocuments({ storyId: f.id })).toBe(count)
  expect((await Story.findById(f.id)).version).toBe(story.version)
  vi.restoreAllMocks()
  const results = await Promise.all([
    write(f.admin.cookie, f.path, input(story)),
    write(f.admin.cookie, f.path, input(story)),
  ])
  expect(results.map(result => result.status).sort()).toEqual([200, 409])
})
