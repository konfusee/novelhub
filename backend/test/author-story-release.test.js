import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Category,
  ContentRevision,
  EvidenceBatch,
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
const write = (cookie, url, body, method = 'post') =>
  request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(body)
async function fixture({ approved = true, evidence = 'available-for-human-review' } = {}) {
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao',
    createdBy: author.account._id,
  })
  const created = await write(author.cookie, '/api/author/stories', {
    title: 'Thông tin đã duyệt',
    description: 'Mô tả của gói gửi được duyệt.',
    categoryIds: [String(category._id)],
  })
  const storyId = created.body.story.id
  const prepared = (
    await request(app)
      .get(`/api/author/submissions/prepare?storyId=${storyId}`)
      .set('Cookie', author.cookie)
  ).body
  const sent = await write(author.cookie, '/api/author/submissions', {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  })
  expect(sent.status).toBe(201)
  const submission = await PublicationSubmission.findById(sent.body.submission.id)
  const revision = await ContentRevision.findById(prepared.target.revisionId)
  const story = await Story.findById(storyId)
  const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
  batch.status = evidence
  if (evidence === 'available-for-human-review') batch.stage = 'llm'
  if (evidence === 'failed') batch.failedStage = 'comparison'
  await batch.save()
  if (approved) {
    submission.status = 'approved'
    await submission.save()
    revision.status = 'approved'
    await revision.save()
    story.publicationStatus = 'approved'
    story.authoringFrozen = false
    await story.save()
  }
  const body = {
    revisionId: String(revision._id),
    submissionId: String(submission._id),
    expectedVersion: story.version,
  }
  const endpoint = `/api/author/stories/${storyId}/release`
  const prepare = () => request(app).get(endpoint).set('Cookie', author.cookie)
  return { author, category, storyId, story, revision, submission, batch, body, endpoint, prepare }
}
it('publishes only the approved metadata snapshot and keeps a later editable draft private', async () => {
  const f = await fixture()
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(404)
  const prep = await f.prepare()
  expect(
    (
      await request(app)
        .get(`/api/author/stories/${f.storyId}/workspace`)
        .set('Cookie', f.author.cookie)
    ).body.story.canReleaseMetadata,
  ).toBe(true)
  expect(prep.body.ready).toBe(true)
  expect(prep.body.target).toMatchObject({
    revisionId: f.body.revisionId,
    submissionId: f.body.submissionId,
    title: 'Thông tin đã duyệt',
  })
  const published = await write(f.author.cookie, f.endpoint, f.body)
  expect(published.status).toBe(201)
  const story = await Story.findById(f.storyId)
  expect(String(story.publishedRevisionId)).toBe(f.body.revisionId)
  expect(story.draftRevisionId).toBeUndefined()
  expect(
    (
      await request(app)
        .get(`/api/author/stories/${f.storyId}/workspace`)
        .set('Cookie', f.author.cookie)
    ).body.story.canReleaseMetadata,
  ).toBe(false)
  expect(story.publicationTransition.result).toBe('author-story-published')
  const publicStory = await request(app).get(`/api/catalog/stories/${f.storyId}`)
  expect(publicStory.status).toBe(200)
  expect(publicStory.body.story.title).toBe('Thông tin đã duyệt')
  expect(publicStory.body.chapters).toEqual([])
  expect(
    (
      await write(
        f.author.cookie,
        `/api/author/stories/${f.storyId}`,
        {
          expectedVersion: story.version,
          title: 'Tên nháp mới',
          description: 'Mô tả sửa chưa được duyệt',
          categoryIds: [String(f.category._id)],
        },
        'put',
      )
    ).status,
  ).toBe(200)
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).body.story.title).toBe(
    'Thông tin đã duyệt',
  )
  expect((await f.prepare()).body.ready).toBe(false)
  expect(await AuditEvent.countDocuments({ action: 'story.published' })).toBe(1)
})
it('replays identical concurrent publication without duplicate audit or timestamp changes', async () => {
  const f = await fixture()
  const rightsBefore = await RightsDeclaration.findById(f.revision.rightsDeclarationId)
  const results = await Promise.all([
    write(f.author.cookie, f.endpoint, f.body),
    write(f.author.cookie, f.endpoint, f.body),
  ])
  expect(results.map(r => r.status).sort()).toEqual([200, 201])
  const before = await Story.findById(f.storyId)
  expect((await write(f.author.cookie, f.endpoint, f.body)).body.story.replayed).toBe(true)
  const after = await Story.findById(f.storyId)
  expect(after.publishedAt).toEqual(before.publishedAt)
  expect(after.version).toBe(before.version)
  expect((await PublicationSubmission.findById(f.submission._id)).version).toBe(
    f.submission.version + 1,
  )
  expect((await RightsDeclaration.findById(rightsBefore._id)).version).toBe(
    rightsBefore.version + 1,
  )
  expect(await AuditEvent.countDocuments({ action: 'story.published' })).toBe(1)
})
it('rejects a ready status that has not reached the LLM stage', async () => {
  const f = await fixture()
  f.batch.stage = 'embedding'
  await f.batch.save()
  expect((await f.prepare()).body.checks.find(check => check.code === 'evidence').ok).toBe(false)
  expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(409)
})
it.each(['pending', 'embedding-complete', 'discovery-complete', 'llm-complete'])(
  'blocks %s evidence even if an inconsistent fixture says approved',
  async evidence => {
    const f = await fixture({ evidence })
    expect((await f.prepare()).body.checks.find(c => c.code === 'evidence').ok).toBe(false)
    expect((await write(f.author.cookie, f.endpoint, f.body)).body.error.code).toBe(
      'release_not_ready',
    )
    expect((await Story.findById(f.storyId)).publishedRevisionId).toBeUndefined()
  },
)
it('allows human-approved metadata after a recorded processing failure without converting failure to clean evidence', async () => {
  const f = await fixture({ evidence: 'failed' })
  expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(201)
  expect((await EvidenceBatch.findById(f.batch._id)).status).toBe('failed')
  expect((await EvidenceBatch.findById(f.batch._id)).failedStage).toBe('comparison')
})
it('blocks pending submissions even when evidence processing has finished', async () => {
  const f = await fixture({ approved: false })
  expect((await f.prepare()).body.ready).toBe(false)
  expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(409)
  expect((await Story.findById(f.storyId)).publishedRevisionId).toBeUndefined()
})
it('rejects stale versions, unrelated revisions, invalid input and unauthorized accounts', async () => {
  const f = await fixture()
  const other = await authenticatedAccount('author')
  const reader = await authenticatedAccount()
  expect((await write(other.cookie, f.endpoint, f.body)).status).toBe(404)
  expect((await write(reader.cookie, f.endpoint, f.body)).status).toBe(403)
  expect((await request(app).post(f.endpoint).set('Origin', origin).send(f.body)).status).toBe(401)
  expect(
    (
      await write(f.author.cookie, f.endpoint, {
        ...f.body,
        expectedVersion: f.body.expectedVersion + 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (await write(f.author.cookie, f.endpoint, { ...f.body, revisionId: String(other.account._id) }))
      .status,
  ).toBe(409)
  expect((await write(f.author.cookie, f.endpoint, { ...f.body, approve: true })).status).toBe(400)
  expect((await Story.findById(f.storyId)).publishedRevisionId).toBeUndefined()
})
it.each(['rights', 'category', 'integrity', 'frozen'])(
  'refuses release after %s changes',
  async mode => {
    const f = await fixture()
    if (mode === 'rights') {
      const rights = await RightsDeclaration.findById(f.revision.rightsDeclarationId)
      rights.status = 'superseded'
      await rights.save()
    }
    if (mode === 'category') {
      f.category.status = 'retired'
      await f.category.save()
    }
    if (mode === 'integrity') {
      f.submission.packageDigest = '0'.repeat(64)
      await f.submission.save()
    }
    if (mode === 'frozen') {
      f.story.authoringFrozen = true
      await f.story.save()
      f.body.expectedVersion = f.story.version
    }
    expect((await f.prepare()).body.ready).toBe(false)
    expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(409)
    expect((await Story.findById(f.storyId)).publishedRevisionId).toBeUndefined()
  },
)
it('rolls back the published pointer, approval pins and rights pins when audit persistence fails', async () => {
  const f = await fixture()
  const rights = await RightsDeclaration.findById(f.revision.rightsDeclarationId)
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Audit unavailable'))
  expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(500)
  const story = await Story.findById(f.storyId)
  expect(story.publicationStatus).toBe('approved')
  expect(story.publishedRevisionId).toBeUndefined()
  expect((await PublicationSubmission.findById(f.submission._id)).version).toBe(
    f.submission.version,
  )
  expect((await RightsDeclaration.findById(rights._id)).version).toBe(rights.version)
  expect(await AuditEvent.countDocuments({ action: 'story.published' })).toBe(0)
})
it('serializes draft edits and publication so an unapproved edit cannot become public', async () => {
  const f = await fixture()
  const [release, edit] = await Promise.all([
    write(f.author.cookie, f.endpoint, f.body),
    write(
      f.author.cookie,
      `/api/author/stories/${f.storyId}`,
      {
        expectedVersion: f.body.expectedVersion,
        title: 'Chưa duyệt',
        description: 'Nội dung sửa riêng tư',
        categoryIds: [String(f.category._id)],
      },
      'put',
    ),
  ])
  expect([release.status, edit.status]).toSatisfy(
    statuses =>
      (statuses[0] === 201 && statuses[1] === 409) || (statuses[0] === 409 && statuses[1] === 200),
  )
  const publicResponse = await request(app).get(`/api/catalog/stories/${f.storyId}`)
  if (release.status === 201) expect(publicResponse.body.story.title).toBe('Thông tin đã duyệt')
  else expect(publicResponse.status).toBe(404)
})
it('publishes an approved metadata update while keeping the previous public snapshot live until confirmation', async () => {
  const f = await fixture()
  expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(201)
  const first = await Story.findById(f.storyId)
  const saved = await write(
    f.author.cookie,
    `/api/author/stories/${f.storyId}`,
    {
      expectedVersion: first.version,
      title: 'Thông tin mới đã duyệt',
      description: 'Phiên bản mô tả được chỉnh sửa.',
      categoryIds: [String(f.category._id)],
    },
    'put',
  )
  expect(saved.status).toBe(200)
  const next = (
    await request(app)
      .get(`/api/author/submissions/prepare?storyId=${f.storyId}`)
      .set('Cookie', f.author.cookie)
  ).body
  const sent = await write(f.author.cookie, '/api/author/submissions', {
    storyId: f.storyId,
    revisionId: next.target.revisionId,
    expectedVersion: next.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  })
  expect(sent.status).toBe(201)
  const submission = await PublicationSubmission.findById(sent.body.submission.id)
  submission.status = 'approved'
  await submission.save()
  const revision = await ContentRevision.findById(next.target.revisionId)
  revision.status = 'approved'
  await revision.save()
  const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
  batch.status = 'available-for-human-review'
  batch.stage = 'llm'
  await batch.save()
  const story = await Story.findById(f.storyId)
  story.authoringFrozen = false
  await story.save()
  const workspace = (
    await request(app)
      .get(`/api/author/stories/${f.storyId}/workspace`)
      .set('Cookie', f.author.cookie)
  ).body
  expect(workspace.story.status).toBe('published')
  expect(workspace.story.canReleaseMetadata).toBe(true)
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).body.story.title).toBe(
    'Thông tin đã duyệt',
  )
  const ready = (await f.prepare()).body
  expect(ready.ready).toBe(true)
  expect(
    (
      await write(f.author.cookie, f.endpoint, {
        revisionId: ready.target.revisionId,
        submissionId: ready.target.submissionId,
        expectedVersion: ready.target.version,
      })
    ).status,
  ).toBe(201)
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).body.story.title).toBe(
    'Thông tin mới đã duyệt',
  )
  expect((await Story.findById(f.storyId)).publishedAt).toEqual(first.publishedAt)
  expect(await AuditEvent.countDocuments({ action: 'story.published' })).toBe(2)
})
