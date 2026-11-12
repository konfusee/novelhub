import mongoose from 'mongoose'
import request from 'supertest'
import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  Category,
  ContentRevision,
  EvidenceBatch,
  MediaAsset,
  PublicationSubmission,
  RightsDeclaration,
  Story,
} from '../src/models/index.js'
import {
  digest,
  rightsFacts,
} from '../src/modules/authoring-publishing/submissions/submission-digests.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { apiClient, claim, decide, markEvidenceReady, origin } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

// T32 / UC-MOD-02: a story package freezes its cover and banner; the moderator reviews exactly
// those bytes through the claim-protected image route. Disposable test database and media root.
useTestDatabase()
let root, app, api
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'novelhub-cover-review-'))
  app = createApp(
    testConfig({ cookieName: 'novelhub_session', corsOrigin: origin, mediaStorageDir: root }),
  )
  api = apiClient(app)
})
afterAll(async () => {
  if (root && path.basename(root).startsWith('novelhub-cover-review-'))
    await rm(root, { recursive: true, force: true })
})

const rights = { basis: 'original', asserted: true, sourceLicenceNote: '' }
const png = background =>
  sharp({ create: { width: 60, height: 90, channels: 4, background } })
    .png()
    .toBuffer()
const objectPath = async mediaId =>
  path.join(root, (await MediaAsset.findById(mediaId).select('+objectKey')).objectKey)
const storedBytes = async mediaId => readFile(await objectPath(mediaId))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

async function createStory(author) {
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao ' + crypto.randomUUID(),
    createdBy: author.account._id,
  })
  const created = await api.write(author.cookie, '/api/author/stories', {
    title: 'Truyện có ảnh bìa',
    description: 'Tóm tắt để kiểm duyệt ảnh bìa.',
    categoryId: String(category._id),
  })
  expect(created.status).toBe(201)
  return created.body.story.id
}
async function upload(author, storyId, kind, background) {
  const response = await request(app)
    .post('/api/author/media')
    .query({ name: `${kind}.png`, kind, storyId })
    .set('Cookie', author.cookie)
    .set('Origin', origin)
    .set('Content-Type', 'application/octet-stream')
    .send(await png(background))
  expect(response.status).toBe(201)
  return response.body.asset.id
}
async function saveImages(author, storyId, images) {
  const { story } = (await api.get(author.cookie, `/api/author/stories/${storyId}`)).body
  const saved = await api.write(
    author.cookie,
    `/api/author/stories/${storyId}`,
    {
      title: story.title,
      description: story.description,
      expectedVersion: story.version,
      ...images,
    },
    'put',
  )
  expect(saved.status).toBe(200)
}
const prepare = async (author, storyId) =>
  (await api.get(author.cookie, `/api/author/submissions/prepare?storyId=${storyId}`)).body
async function submit(author, storyId) {
  const prepared = await prepare(author, storyId)
  const sent = await api.write(author.cookie, '/api/author/submissions', {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights,
    ...(prepared.imageRights ? { imageManifestDigest: prepared.imageRights.mediaDigest } : {}),
  })
  expect(sent.status).toBe(201)
  return { prepared, submissionId: sent.body.submission.id }
}
const detailOf = async (moderator, submissionId) =>
  (await api.get(moderator.cookie, `/api/moderator/submissions/${submissionId}`)).body
const imageRoute = (submissionId, mediaId) =>
  `/api/moderator/submissions/${submissionId}/images/${mediaId}`
const releaseOf = async (author, storyId) =>
  (await api.get(author.cookie, `/api/author/stories/${storyId}/release`)).body

it('serves the live claimant exactly the submitted cover and banner, never a later draft cover', async () => {
  const author = await authenticatedAccount('author')
  const moderator = await authenticatedAccount('moderator')
  const other = await authenticatedAccount('moderator')
  const storyId = await createStory(author)
  const coverA = await upload(author, storyId, 'cover', '#308070')
  const banner = await upload(author, storyId, 'banner', '#703080')
  await saveImages(author, storyId, { coverMediaId: coverA, coverBannerMediaId: banner })
  const { prepared, submissionId } = await submit(author, storyId)
  expect(prepared.checks.find(check => check.code === 'media').ok).toBe(true)
  expect(prepared.imageRights.count).toBe(2)

  const revision = await ContentRevision.findById(prepared.target.revisionId).lean()
  const manifest = revision.validation.mediaManifest
  expect(revision.validation).toMatchObject({
    mediaManifestVersion: 'story-media-v1',
    validator: 'publishing-story-images-v1',
  })
  expect(manifest).toEqual([
    {
      mediaId: coverA,
      role: 'cover',
      checksum: sha256(await storedBytes(coverA)),
      sizeBytes: (await storedBytes(coverA)).length,
      contentType: 'image/webp',
      storageProvider: 'local',
    },
    expect.objectContaining({ mediaId: banner, role: 'banner' }),
  ])
  expect(revision.mediaIds).toEqual([])
  expect(revision.mediaDigest).toBe(digest(manifest))
  expect(revision.mediaDigest).toBe(prepared.imageRights.mediaDigest)
  const declaration = await RightsDeclaration.findById(revision.rightsDeclarationId)
  expect(revision.rightsDigest).toBe(
    digest({ declaration: rightsFacts(declaration), mediaDigest: revision.mediaDigest }),
  )
  expect(revision.packageDigest).toBe(
    digest({
      formatVersion: 'story-v1',
      content: revision.content,
      rightsDigest: revision.rightsDigest,
      mediaDigest: revision.mediaDigest,
    }),
  )
  expect(
    await AuditEvent.countDocuments({
      action: 'media.attached',
      targetId: { $in: [coverA, banner] },
    }),
  ).toBe(2)

  await markEvidenceReady(submissionId)
  expect((await api.get(moderator.cookie, imageRoute(submissionId, coverA))).status).toBe(409)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  const detail = await detailOf(moderator, submissionId)
  expect(detail.metadata.cover).toEqual({
    mediaId: coverA,
    url: `/moderator/submissions/${submissionId}/images/${coverA}`,
  })
  expect(detail.metadata.banner).toEqual({
    mediaId: banner,
    url: `/moderator/submissions/${submissionId}/images/${banner}`,
  })
  const served = await api.get(moderator.cookie, imageRoute(submissionId, coverA))
  expect(served.status).toBe(200)
  expect(served.headers['content-type']).toMatch(/image\/webp/)
  expect(served.headers['cache-control']).toBe('private, no-store')
  expect(Buffer.compare(served.body, await storedBytes(coverA))).toBe(0)
  expect((await api.get(moderator.cookie, imageRoute(submissionId, banner))).status).toBe(200)

  // Another moderator and the author never reach the package images.
  expect((await detailOf(other, submissionId)).metadata).toBeUndefined()
  expect((await api.get(other.cookie, imageRoute(submissionId, coverA))).status).toBe(409)
  expect((await api.get(author.cookie, imageRoute(submissionId, coverA))).status).toBe(403)

  // The mutable story moves on while the claim is live: the draft cover becomes B and an
  // unreferenced upload is left behind. The frozen package must not follow either change.
  await Story.updateOne(
    { _id: storyId },
    { $set: { authoringFrozen: false, publicationStatus: 'draft' } },
  )
  const coverB = await upload(author, storyId, 'cover', '#f08030')
  const abandoned = await upload(author, storyId, 'cover', '#101010')
  await MediaAsset.updateOne(
    { _id: abandoned },
    { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } },
  )
  const abandonedPath = await objectPath(abandoned)
  await saveImages(author, storyId, { coverMediaId: coverB })
  expect(String((await Story.findById(storyId)).coverMediaId)).toBe(coverB)

  // Cleanup deletes only the unreferenced upload and keeps the submitted cover and its file.
  expect((await MediaAsset.findById(abandoned)).status).toBe('deleted')
  await expect(access(abandonedPath)).rejects.toThrow()
  const deletedAudit = await AuditEvent.findOne({ action: 'media.deleted', targetId: abandoned })
  expect(deletedAudit.targetVersion).toBe(1)
  expect((await MediaAsset.findById(coverA)).status).toBe('available')

  expect((await detailOf(moderator, submissionId)).metadata.cover.mediaId).toBe(coverA)
  const again = await api.get(moderator.cookie, imageRoute(submissionId, coverA))
  expect(again.status).toBe(200)
  expect(Buffer.compare(again.body, await storedBytes(coverA))).toBe(0)
  expect((await api.get(moderator.cookie, imageRoute(submissionId, coverB))).status).toBe(404)

  // The author's submitted-package view serves the same frozen entries.
  const authorImage = mediaId => `/api/author/submissions/${submissionId}/media/${mediaId}/content`
  expect((await api.get(author.cookie, authorImage(coverA))).status).toBe(200)
  expect((await api.get(author.cookie, authorImage(coverB))).status).toBe(404)
  const pkg = (await api.get(author.cookie, `/api/author/submissions/${submissionId}/package`)).body
  expect(pkg.media.map(item => item.role)).toEqual(['cover', 'banner'])
})

it('requires the declaration to cover the validated images and rechecks them at freeze', async () => {
  const author = await authenticatedAccount('author')
  const storyId = await createStory(author)
  const cover = await upload(author, storyId, 'cover', '#308070')
  await saveImages(author, storyId, { coverMediaId: cover })
  const prepared = await prepare(author, storyId)
  expect(prepared.imageRights).toEqual({
    count: 1,
    mediaDigest: expect.stringMatching(/^[a-f\d]{64}$/),
  })
  const body = {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights,
  }
  const send = extra => api.write(author.cookie, '/api/author/submissions', { ...body, ...extra })
  const missing = await send({})
  expect([missing.status, missing.body.error.code]).toEqual([409, 'image_rights_required'])
  const changed = await send({ imageManifestDigest: '0'.repeat(64) })
  expect([changed.status, changed.body.error.code]).toEqual([409, 'media_changed'])

  // The stored file no longer matches what was validated: nothing is submitted (EX4).
  const file = await objectPath(cover)
  const original = await readFile(file)
  await writeFile(
    file,
    await sharp(await png('#000000'))
      .webp()
      .toBuffer(),
  )
  const tampered = await send({ imageManifestDigest: prepared.imageRights.mediaDigest })
  expect([tampered.status, tampered.body.error.code]).toEqual([409, 'submission_not_ready'])
  expect(await PublicationSubmission.countDocuments({ storyId })).toBe(0)
  expect((await Story.findById(storyId)).authoringFrozen).toBe(false)
  await writeFile(file, original)

  const sent = await send({ imageManifestDigest: prepared.imageRights.mediaDigest })
  expect(sent.status).toBe(201)
  const replay = await send({ imageManifestDigest: prepared.imageRights.mediaDigest })
  expect([replay.status, replay.body.submission.replayed]).toEqual([200, true])
  expect((await send({ imageManifestDigest: '1'.repeat(64) })).body.error.code).toBe(
    'package_changed',
  )
  expect((await prepare(author, storyId)).imageRights).toEqual(prepared.imageRights)
})

it('keeps a story without images on the plain package shape', async () => {
  const author = await authenticatedAccount('author')
  const storyId = await createStory(author)
  const prepared = await prepare(author, storyId)
  expect(prepared.imageRights).toBeUndefined()
  const withDigest = await api.write(author.cookie, '/api/author/submissions', {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights,
    imageManifestDigest: '0'.repeat(64),
  })
  expect(withDigest.status).toBe(400)
  const { submissionId } = await submit(author, storyId)
  const revision = await ContentRevision.findById(prepared.target.revisionId).lean()
  expect(revision.validation.validator).toBe('publishing-text-v2')
  expect(revision.validation.mediaManifest).toBeUndefined()
  expect(revision.mediaDigest).toBe(digest([]))
  const declaration = await RightsDeclaration.findById(revision.rightsDeclarationId)
  expect(revision.rightsDigest).toBe(digest(rightsFacts(declaration)))
  const moderator = await authenticatedAccount('moderator')
  await markEvidenceReady(submissionId)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  const { metadata } = await detailOf(moderator, submissionId)
  expect([metadata.cover, metadata.banner]).toEqual([null, null])
})

it('loads, decides and releases a legacy story package frozen without an image manifest', async () => {
  const author = await authenticatedAccount('author')
  const moderator = await authenticatedAccount('moderator')
  const storyId = await createStory(author)
  const cover = await upload(author, storyId, 'cover', '#308070')
  await saveImages(author, storyId, { coverMediaId: cover })
  // Freeze the draft exactly as submissions did before story-media-v1.
  const story = await Story.findById(storyId)
  const revision = await ContentRevision.findById(story.draftRevisionId)
  const now = new Date()
  const submissionId = new mongoose.Types.ObjectId()
  const declaration = await RightsDeclaration.create({
    ...rights,
    storyId,
    submissionId,
    revisionId: revision._id,
    declaredBy: author.account._id,
    declaredAt: now,
    status: 'asserted',
    immutableAt: now,
  })
  const rightsDigest = digest(rightsFacts(declaration))
  const mediaDigest = digest([])
  const packageDigest = digest({
    formatVersion: 'story-v1',
    content: revision.content,
    rightsDigest,
    mediaDigest,
  })
  revision.set({
    rightsDeclarationId: declaration._id,
    rightsDigest,
    mediaDigest,
    packageDigest,
    validation: { valid: true, validator: 'publishing-text-v2', validatedAt: now },
    status: 'submitted',
    submittedAt: now,
    immutableAt: now,
  })
  await revision.save()
  const submission = await PublicationSubmission.create({
    _id: submissionId,
    storyId,
    revisionId: revision._id,
    authorAccountId: author.account._id,
    status: 'validated',
    submittedAt: now,
    packageDigest,
  })
  const batch = await EvidenceBatch.create({
    submissionId,
    revisionId: revision._id,
    packageDigest,
    stage: 'embedding',
    status: 'pending',
  })
  submission.currentEvidenceBatchId = batch._id
  await submission.save()
  story.set({ authoringFrozen: true, publicationStatus: 'submitted' })
  await story.save()

  await markEvidenceReady(submissionId)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  const detail = await detailOf(moderator, submissionId)
  expect(detail.packageDigest).toBe(packageDigest)
  expect(detail.media).toEqual([])
  expect(detail.metadata.cover).toEqual({ mediaId: cover, url: null })
  expect(detail.metadata.banner).toBeNull()
  expect((await api.get(moderator.cookie, imageRoute(submissionId, cover))).status).toBe(404)
  expect((await decide(api, moderator, submissionId)).status).toBe(200)

  const release = await releaseOf(author, storyId)
  expect(release.ready).toBe(true)
  const published = await api.write(author.cookie, `/api/author/stories/${storyId}/release`, {
    revisionId: String(revision._id),
    submissionId: String(submissionId),
    expectedVersion: release.target.version,
  })
  expect(published.status).toBe(201)
  expect((await ContentRevision.findById(revision._id)).packageDigest).toBe(packageDigest)
})

it('checks the approved revision cover at release, not the live story cover', async () => {
  const author = await authenticatedAccount('author')
  const moderator = await authenticatedAccount('moderator')
  const storyId = await createStory(author)
  const cover = await upload(author, storyId, 'cover', '#308070')
  const banner = await upload(author, storyId, 'banner', '#703080')
  await saveImages(author, storyId, { coverMediaId: cover, coverBannerMediaId: banner })
  const { prepared, submissionId } = await submit(author, storyId)
  await markEvidenceReady(submissionId)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  expect((await decide(api, moderator, submissionId)).status).toBe(200)
  const mediaCheck = async () =>
    (await releaseOf(author, storyId)).checks.find(check => check.code === 'media').ok

  // The live pointer is not what release publishes, so it no longer decides the check.
  await Story.updateOne({ _id: storyId }, { $set: { coverMediaId: banner } })
  expect(await mediaCheck()).toBe(true)
  // The approved cover no longer has the reviewed bytes.
  await MediaAsset.updateOne({ _id: cover }, { $set: { checksum: 'f'.repeat(64) } })
  expect(await mediaCheck()).toBe(false)
  await MediaAsset.updateOne(
    { _id: cover },
    { $set: { checksum: sha256(await storedBytes(cover)) } },
  )
  // The approved banner is no longer available.
  await MediaAsset.updateOne({ _id: banner }, { $set: { status: 'deleted' } })
  expect(await mediaCheck()).toBe(false)
  await MediaAsset.updateOne({ _id: banner }, { $set: { status: 'available' } })

  const release = await releaseOf(author, storyId)
  expect(release.ready).toBe(true)
  const published = await api.write(author.cookie, `/api/author/stories/${storyId}/release`, {
    revisionId: prepared.target.revisionId,
    submissionId,
    expectedVersion: release.target.version,
  })
  expect(published.status).toBe(201)
  const story = await Story.findById(storyId)
  expect(String(story.coverMediaId)).toBe(cover)
  expect(String(story.theme.coverBannerMediaId)).toBe(banner)
  const publicCover = await request(app).get(`/api/catalog/stories/${storyId}/media/${cover}`)
  expect(publicCover.status).toBe(200)
  expect(Buffer.compare(publicCover.body, await storedBytes(cover))).toBe(0)
})
