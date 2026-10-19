import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Category,
  ContentRevision,
  EvidenceBatch,
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

async function live() {
  const f = await fixture()
  expect((await write(f.author.cookie, f.endpoint, f.body)).status).toBe(201)
  f.story = await Story.findById(f.storyId)
  f.withdraw = {
    action: 'unpublish',
    expectedVersion: f.story.version,
    expectedPublishedRevisionId: String(f.story.publishedRevisionId),
    reason: 'Author requested withdrawal',
  }
  f.lifecycle = '/api/author/stories/' + f.storyId + '/lifecycle'
  return f
}
it('hides and restores approved metadata without changing its first publication or revision', async () => {
  const f = await live()
  const first = f.story.publishedAt
  const hidden = await write(f.author.cookie, f.lifecycle, f.withdraw)
  expect(hidden.status).toBe(200)
  expect((await request(app).get('/api/catalog/stories/' + f.storyId)).status).toBe(404)
  const after = await Story.findById(f.storyId)
  expect(after.publishedAt).toEqual(first)
  expect(String(after.publishedRevisionId)).toBe(f.withdraw.expectedPublishedRevisionId)
  expect(
    await AuditEvent.countDocuments({ action: 'story.unpublished', reason: f.withdraw.reason }),
  ).toBe(1)
  const prep = await f.prepare()
  expect(prep.body.ready).toBe(true)
  expect(prep.body.target.restoring).toBe(true)
  expect(
    (await write(f.author.cookie, f.endpoint, { ...f.body, expectedVersion: after.version }))
      .status,
  ).toBe(201)
  expect((await request(app).get('/api/catalog/stories/' + f.storyId)).status).toBe(200)
  expect((await Story.findById(f.storyId)).publishedAt).toEqual(first)
  expect((await write(f.author.cookie, f.lifecycle, f.withdraw)).status).toBe(409)
})
it('serializes concurrent withdrawal and rejects stale or incomplete requests', async () => {
  const f = await live()
  expect((await write(f.author.cookie, f.lifecycle, { ...f.withdraw, reason: '' })).status).toBe(
    400,
  )
  expect(
    (
      await write(f.author.cookie, f.lifecycle, {
        ...f.withdraw,
        expectedPublishedRevisionId: '000000000000000000000001',
      })
    ).status,
  ).toBe(409)
  const responses = await Promise.all([
    write(f.author.cookie, f.lifecycle, f.withdraw),
    write(f.author.cookie, f.lifecycle, f.withdraw),
  ])
  expect(responses.map(r => r.status).sort()).toEqual([200, 409])
  expect(await AuditEvent.countDocuments({ action: 'story.unpublished' })).toBe(1)
})
it('preserves a newer private draft and prevents restoration of its older approval', async () => {
  const f = await live()
  expect(
    (
      await write(
        f.author.cookie,
        '/api/author/stories/' + f.storyId,
        {
          expectedVersion: f.story.version,
          title: 'Private draft',
          description: 'Private changes awaiting review',
          categoryIds: [String(f.category._id)],
        },
        'put',
      )
    ).status,
  ).toBe(200)
  const changed = await Story.findById(f.storyId)
  expect(changed.draftRevisionId).toBeTruthy()
  expect(
    (await write(f.author.cookie, f.lifecycle, { ...f.withdraw, expectedVersion: changed.version }))
      .status,
  ).toBe(200)
  const hidden = await Story.findById(f.storyId)
  expect(String(hidden.draftRevisionId)).toBe(String(changed.draftRevisionId))
  expect((await f.prepare()).body.ready).toBe(false)
  expect(
    (await write(f.author.cookie, f.endpoint, { ...f.body, expectedVersion: hidden.version }))
      .status,
  ).toBe(409)
})
it('does not override another owner, frozen stories or an administrative withdrawal', async () => {
  const f = await live()
  const other = await authenticatedAccount('author')
  expect((await write(other.cookie, f.lifecycle, f.withdraw)).status).toBe(404)
  await Story.updateOne({ _id: f.storyId }, { $set: { authoringFrozen: true } })
  expect((await write(f.author.cookie, f.lifecycle, f.withdraw)).status).toBe(409)
  await Story.updateOne(
    { _id: f.storyId },
    {
      $set: {
        authoringFrozen: false,
        publicationStatus: 'unpublished',
        'publicationTransition.result': 'admin-hidden',
      },
    },
  )
  expect((await f.prepare()).body.ready).toBe(false)
})
it('rolls back withdrawal when its audit cannot be persisted', async () => {
  const f = await live()
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'))
  expect((await write(f.author.cookie, f.lifecycle, f.withdraw)).status).toBe(500)
  const after = await Story.findById(f.storyId)
  expect(after.publicationStatus).toBe('published')
  expect(after.version).toBe(f.story.version)
})
it('rechecks active categories before restoring public visibility', async () => {
  const f = await live()
  expect((await write(f.author.cookie, f.lifecycle, f.withdraw)).status).toBe(200)
  await Category.updateOne({ _id: f.category._id }, { $set: { status: 'retired' } })
  expect((await f.prepare()).body.ready).toBe(false)
  const hidden = await Story.findById(f.storyId)
  expect(
    (await write(f.author.cookie, f.endpoint, { ...f.body, expectedVersion: hidden.version }))
      .status,
  ).toBe(409)
})
