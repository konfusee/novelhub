import request from 'supertest'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  MediaAsset,
  Story,
  Category,
  Chapter,
  ContentRevision,
  PublicationSubmission,
  RightsDeclaration,
  EvidenceBatch,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { markEvidenceReady } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
let root, app, png
const origin = 'http://localhost:5173'
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'novelhub-media-test-'))
  app = createApp(
    testConfig({ cookieName: 'novelhub_session', corsOrigin: origin, mediaStorageDir: root }),
  )
  png = await sharp({ create: { width: 80, height: 120, channels: 4, background: '#308070' } })
    .png()
    .toBuffer()
})
afterAll(async () => {
  if (root && path.basename(root).startsWith('novelhub-media-test-'))
    await rm(root, { recursive: true, force: true })
})
const upload = (cookie, query = {}, bytes = png) =>
  request(app)
    .post('/api/author/media')
    .query({ name: 'Bìa truyện.png', ...query })
    .set('Cookie', cookie)
    .set('Origin', origin)
    .set('Content-Type', 'application/octet-stream')
    .send(bytes)
const get = (cookie, url = '/api/author/media') => request(app).get(url).set('Cookie', cookie)
it('stores decoded image bytes and MongoDB metadata and serves owner-only WebP', async () => {
  const author = await authenticatedAccount('author')
  const other = await authenticatedAccount('author')
  const response = await upload(author.cookie)
  expect(response.status).toBe(201)
  const { asset } = response.body
  expect(asset).toMatchObject({
    kind: 'image',
    name: 'Bìa truyện.webp',
    width: 80,
    height: 120,
    contentType: 'image/webp',
    version: 0,
  })
  expect(asset).not.toHaveProperty('objectKey')
  const row = await MediaAsset.findById(asset.id).select('+objectKey')
  const bytes = await readFile(path.join(root, row.objectKey))
  expect((await sharp(bytes).metadata()).format).toBe('webp')
  const image = await get(author.cookie, `/api${asset.url}`).set('Origin', origin)
  expect(image.status).toBe(200)
  expect(image.headers['cache-control']).toBe('private, no-store')
  expect(image.headers['access-control-allow-origin']).toBe(origin)
  expect(image.headers['access-control-allow-credentials']).toBe('true')
  expect(image.headers['cross-origin-resource-policy']).toBe('same-site')
  expect(image.body).toEqual(bytes)
  expect((await get(other.cookie, `/api${asset.url}`)).status).toBe(404)
  expect((await request(app).get(`/api${asset.url}`)).status).toBe(401)
  expect(await AuditEvent.countDocuments({ action: 'media.uploaded' })).toBe(1)
})
it('rejects unauthorized, forged, empty, animated/unsupported and oversized uploads', async () => {
  const author = await authenticatedAccount('author')
  const reader = await authenticatedAccount()
  expect((await upload(reader.cookie)).status).toBe(403)
  expect((await upload(author.cookie, {}, Buffer.from('<svg></svg>'))).status).toBe(400)
  expect((await upload(author.cookie, {}, Buffer.alloc(0))).status).toBe(400)
  expect((await upload(author.cookie, {}, Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413)
  expect(
    (
      await request(app)
        .post('/api/author/media?name=a.png')
        .set('Cookie', author.cookie)
        .set('Origin', 'https://elsewhere.test')
        .set('Content-Type', 'application/octet-stream')
        .send(png)
    ).status,
  ).toBe(403)
  expect(await MediaAsset.countDocuments()).toBe(0)
})
it('rolls back metadata and removes written files when ownership or audit validation fails', async () => {
  const author = await authenticatedAccount('author')
  const other = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: other.account._id,
  })
  const story = await Story.create({
    authorAccountId: other.account._id,
    title: 'Khác',
    description: 'Tóm tắt',
    categoryId: category._id,
  })
  const before = await readdir(root)
  expect((await upload(author.cookie, { storyId: String(story._id) })).status).toBe(404)
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Audit unavailable'))
  try {
    expect((await upload(author.cookie)).status).toBe(500)
  } finally {
    spy.mockRestore()
  }
  expect(await MediaAsset.countDocuments()).toBe(0)
  expect(await readdir(root)).toEqual(before)
})
it('does not serve altered stored bytes', async () => {
  const author = await authenticatedAccount('author')
  const { asset } = (await upload(author.cookie)).body
  const row = await MediaAsset.findById(asset.id).select('+objectKey')
  await writeFile(path.join(root, row.objectKey), Buffer.alloc(row.sizeBytes))
  expect((await get(author.cookie, `/api${asset.url}`)).body.error.code).toBe('media_unavailable')
})
const makeStory = async (owner, name = 'Truyện nhận ảnh') => {
  const category = await Category.create({
    name: `Loại ${crypto.randomUUID()}`,
    normalizedName: crypto.randomUUID(),
    createdBy: owner.account._id,
  })
  return Story.create({
    authorAccountId: owner.account._id,
    title: name,
    description: 'Tóm tắt',
    categoryId: category._id,
  })
}
it('preserves whole Unicode characters in long image names and reads the stored image back', async () => {
  const author = await authenticatedAccount('author')
  const name = `${'a'.repeat(99)}🌿.png`
  const response = await upload(author.cookie, { name })
  expect(response.status).toBe(201)
  expect(response.body.asset.name).toBe(`${'a'.repeat(99)}🌿.webp`)
  expect((await get(author.cookie, `/api${response.body.asset.url}`)).status).toBe(200)
})
const chapterWrite = (cookie, url, body, method = 'post') =>
  request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(body)
const illustrated = id => ({
  title: 'Chương có ảnh',
  blocks: [
    { type: 'paragraph', inlines: [{ text: 'Nội dung có định dạng', marks: ['bold'] }] },
    { type: 'image', mediaId: id, alt: 'Đường qua khu rừng', caption: 'Minh họa riêng' },
  ],
})
it('pins owned images to revision history and blocks submission until the parent is approved', async () => {
  const author = await authenticatedAccount('author')
  const story = await makeStory(author)
  const asset = (await upload(author.cookie, { storyId: String(story._id) })).body.asset
  const base = `/api/author/stories/${story._id}/chapters`
  const created = await chapterWrite(author.cookie, base, { document: illustrated(asset.id) })
  expect(created.status).toBe(201)
  const url = `${base}/${created.body.chapter.id}`
  const loaded = await get(author.cookie, `${url}?format=rich`)
  expect(loaded.body.chapter).toMatchObject({
    document: illustrated(asset.id),
    formatVersion: 'blocks-v3',
  })
  expect((await get(author.cookie, url)).body.error.code).toBe('unsupported_editor_format')
  const revision = await ContentRevision.findOne({ chapterId: created.body.chapter.id })
  expect(revision.mediaIds.map(String)).toEqual([asset.id])
  const stored = await MediaAsset.findById(asset.id)
  expect(revision.validation).toEqual({
    mediaManifestVersion: 'chapter-images-v1',
    mediaManifest: [
      {
        mediaId: asset.id,
        checksum: stored.checksum,
        sizeBytes: stored.sizeBytes,
        contentType: 'image/webp',
        storageProvider: 'local',
      },
    ],
  })
  expect(revision.mediaDigest).toBe(
    createHash('sha256').update(JSON.stringify(revision.validation.mediaManifest)).digest('hex'),
  )
  expect((await MediaAsset.findById(asset.id)).version).toBe(1)
  const prepared = await get(
    author.cookie,
    `/api/author/submissions/prepare?storyId=${story._id}&chapterId=${created.body.chapter.id}`,
  )
  expect(prepared.status).toBe(200)
  expect(prepared.body.target.formatVersion).toBe('blocks-v3')
  expect(prepared.body.checks.find(item => item.code === 'content').ok).toBe(true)
  expect(prepared.body.checks.find(item => item.code === 'media').ok).toBe(true)
  expect(prepared.body.requiresRights).toBe(true)
  expect(prepared.body.imageRights).toEqual({ count: 1, mediaDigest: revision.mediaDigest })
  const sent = await chapterWrite(author.cookie, '/api/author/submissions', {
    storyId: String(story._id),
    chapterId: created.body.chapter.id,
    revisionId: String(revision._id),
    expectedVersion: loaded.body.chapter.version,
  })
  expect(sent.body.error.code).toBe('submission_not_ready')
  expect(await PublicationSubmission.countDocuments()).toBe(0)
  const textOnly = { ...illustrated(asset.id), blocks: illustrated(asset.id).blocks.slice(0, 1) }
  expect(
    (
      await chapterWrite(
        author.cookie,
        url,
        { document: textOnly, expectedVersion: loaded.body.chapter.version },
        'put',
      )
    ).status,
  ).toBe(200)
  expect((await get(author.cookie, `${url}?format=rich`)).body.chapter.formatVersion).toBe(
    'blocks-v2',
  )
  const current = await Chapter.findById(created.body.chapter.id)
  const textRevision = await ContentRevision.findById(current.draftRevisionId)
  expect(textRevision.mediaIds).toEqual([])
  expect(textRevision.mediaDigest).toBeUndefined()
  expect(textRevision.validation).toBeUndefined()
  expect((await ContentRevision.findById(revision._id)).mediaDigest).toBe(revision.mediaDigest)
  expect((await ContentRevision.findById(revision._id)).mediaIds.map(String)).toEqual([asset.id])
})
it('rejects incompatible image metadata without persisting a chapter or attachment audit', async () => {
  const author = await authenticatedAccount('author')
  const story = await makeStory(author)
  const asset = (await upload(author.cookie)).body.asset
  await MediaAsset.updateOne({ _id: asset.id }, { $set: { contentType: 'image/jpeg' } })
  const response = await chapterWrite(author.cookie, `/api/author/stories/${story._id}/chapters`, {
    document: illustrated(asset.id),
  })
  expect(response.status).toBe(409)
  expect(response.body.error.code).toBe('media_changed')
  expect(await Chapter.countDocuments()).toBe(0)
  expect(await ContentRevision.countDocuments({ contentType: 'chapter' })).toBe(0)
  expect(await AuditEvent.countDocuments({ action: 'media.attached' })).toBe(0)
  expect((await MediaAsset.findById(asset.id)).version).toBe(asset.version)
})
it('snapshots unique images in document order and keeps earlier manifests after reordering', async () => {
  const author = await authenticatedAccount('author')
  const story = await makeStory(author)
  const first = (await upload(author.cookie)).body.asset
  const second = (await upload(author.cookie)).body.asset
  const document = illustrated(second.id)
  document.blocks.push(illustrated(first.id).blocks[1], illustrated(second.id).blocks[1])
  const base = `/api/author/stories/${story._id}/chapters`
  const created = await chapterWrite(author.cookie, base, { document })
  expect(created.status).toBe(201)
  const old = await ContentRevision.findOne({ chapterId: created.body.chapter.id })
  expect(old.validation.mediaManifest.map(item => item.mediaId)).toEqual([second.id, first.id])
  expect((await MediaAsset.findById(second.id)).version).toBe(1)
  const reordered = {
    ...document,
    blocks: [document.blocks[0], document.blocks[2], document.blocks[1], document.blocks[3]],
  }
  const saved = await chapterWrite(
    author.cookie,
    `${base}/${created.body.chapter.id}`,
    { document: reordered, expectedVersion: created.body.chapter.version },
    'put',
  )
  expect(saved.status).toBe(200)
  const chapter = await Chapter.findById(created.body.chapter.id)
  const fresh = await ContentRevision.findById(chapter.draftRevisionId)
  expect(fresh.validation.mediaManifest.map(item => item.mediaId)).toEqual([first.id, second.id])
  expect(fresh.mediaDigest).not.toBe(old.mediaDigest)
  expect((await ContentRevision.findById(old._id)).validation).toEqual(old.validation)
})
it('rejects foreign, wrong-story, unavailable or malformed image references without creating chapters', async () => {
  const author = await authenticatedAccount('author')
  const other = await authenticatedAccount('author')
  const story = await makeStory(author)
  const second = await makeStory(author, 'Truyện khác')
  const foreign = (await upload(other.cookie)).body.asset
  const wrongStory = (await upload(author.cookie, { storyId: String(second._id) })).body.asset
  const base = `/api/author/stories/${story._id}/chapters`
  expect(
    (await chapterWrite(author.cookie, base, { document: illustrated(foreign.id) })).status,
  ).toBe(409)
  expect(
    (await chapterWrite(author.cookie, base, { document: illustrated(wrongStory.id) })).body.error
      .code,
  ).toBe('media_wrong_story')
  const own = (await upload(author.cookie)).body.asset
  const invalid = illustrated(own.id)
  invalid.blocks[1].url = 'https://elsewhere.test/image.png'
  expect((await chapterWrite(author.cookie, base, { document: invalid })).status).toBe(400)
  const noAlt = illustrated(own.id)
  noAlt.blocks[1].alt = ' '
  expect((await chapterWrite(author.cookie, base, { document: noAlt })).status).toBe(400)
  const tooMany = illustrated(own.id)
  tooMany.blocks = Array.from({ length: 21 }, () => tooMany.blocks[1])
  expect((await chapterWrite(author.cookie, base, { document: tooMany })).status).toBe(400)
  await MediaAsset.updateOne({ _id: own.id }, { $set: { status: 'deleted' } })
  expect((await chapterWrite(author.cookie, base, { document: illustrated(own.id) })).status).toBe(
    409,
  )
  expect(await Chapter.countDocuments()).toBe(0)
  expect(await ContentRevision.countDocuments()).toBe(0)
})
it('rolls back media pins and chapter creation when audit fails, and rejects missing image bytes', async () => {
  const author = await authenticatedAccount('author')
  const story = await makeStory(author)
  const asset = (await upload(author.cookie)).body.asset
  const base = `/api/author/stories/${story._id}/chapters`
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Audit unavailable'))
  try {
    expect(
      (await chapterWrite(author.cookie, base, { document: illustrated(asset.id) })).status,
    ).toBe(500)
  } finally {
    spy.mockRestore()
  }
  expect((await MediaAsset.findById(asset.id)).version).toBe(0)
  expect(await Chapter.countDocuments()).toBe(0)
  const row = await MediaAsset.findById(asset.id).select('+objectKey')
  await writeFile(path.join(root, row.objectKey), Buffer.alloc(row.sizeBytes))
  expect(
    (await chapterWrite(author.cookie, base, { document: illustrated(asset.id) })).status,
  ).toBe(404)
  expect(await ContentRevision.countDocuments()).toBe(0)
})
it('refuses to flatten or overwrite an illustrated revision whose media manifest does not match its blocks', async () => {
  const author = await authenticatedAccount('author')
  const story = await makeStory(author)
  const asset = (await upload(author.cookie)).body.asset
  const base = `/api/author/stories/${story._id}/chapters`
  const created = await chapterWrite(author.cookie, base, { document: illustrated(asset.id) })
  const url = `${base}/${created.body.chapter.id}`
  const inconsistent = await ContentRevision.findOne({ chapterId: created.body.chapter.id })
  inconsistent.mediaIds = []
  await inconsistent.save()
  expect((await get(author.cookie, `${url}?format=rich`)).body.error.code).toBe(
    'unsupported_editor_format',
  )
  expect(
    (
      await chapterWrite(
        author.cookie,
        url,
        { document: illustrated(asset.id), expectedVersion: created.body.chapter.version },
        'put',
      )
    ).status,
  ).toBe(409)
  expect(await ContentRevision.countDocuments({ chapterId: created.body.chapter.id })).toBe(1)
})
async function submissionWithImages() {
  const author = await authenticatedAccount('author')
  const story = await makeStory(author)
  const parent = await ContentRevision.create({
    storyId: story._id,
    authorAccountId: author.account._id,
    contentType: 'story',
    revisionNumber: 1,
    formatVersion: 'story-v1',
    status: 'approved',
    immutableAt: new Date(),
    content: {
      title: story.title,
      description: story.description,
      categoryId: String(story.categoryId),
    },
  })
  const parentSubmission = await PublicationSubmission.create({
    storyId: story._id,
    revisionId: parent._id,
    authorAccountId: author.account._id,
    status: 'approved',
  })
  const parentRights = await RightsDeclaration.create({
    storyId: story._id,
    revisionId: parent._id,
    submissionId: parentSubmission._id,
    basis: 'original',
    asserted: true,
    declaredBy: author.account._id,
    status: 'asserted',
    immutableAt: new Date(),
  })
  story.currentRevisionId = parent._id
  story.publicationStatus = 'approved'
  await story.save()
  const asset = (await upload(author.cookie)).body.asset
  const created = await chapterWrite(author.cookie, `/api/author/stories/${story._id}/chapters`, {
    document: illustrated(asset.id),
  })
  expect(created.status).toBe(201)
  const chapterId = created.body.chapter.id
  const prepare = () =>
    get(
      author.cookie,
      `/api/author/submissions/prepare?storyId=${story._id}&chapterId=${chapterId}`,
    )
  const data = (await prepare()).body
  expect(data.ready).toBe(true)
  return {
    author,
    story,
    asset,
    chapterId,
    prepare,
    parentRights,
    body: {
      storyId: String(story._id),
      chapterId,
      revisionId: data.target.revisionId,
      expectedVersion: data.target.version,
      imageManifestDigest: data.imageRights.mediaDigest,
      rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
    },
  }
}
it('freezes illustrated chapter rights and manifest once, replays identical requests and rejects changed rights', async () => {
  const f = await submissionWithImages()
  const before = await ContentRevision.findById(f.body.revisionId)
  const results = await Promise.all([
    chapterWrite(f.author.cookie, '/api/author/submissions', f.body),
    chapterWrite(f.author.cookie, '/api/author/submissions', f.body),
  ])
  expect(results.map(r => r.status).sort()).toEqual([200, 201])
  const frozen = await ContentRevision.findById(f.body.revisionId)
  expect(frozen.mediaDigest).toBe(before.mediaDigest)
  expect(frozen.validation.mediaManifest).toEqual(before.validation.mediaManifest)
  expect(frozen.validation.parentRightsDeclarationId).toBe(String(f.parentRights._id))
  expect(frozen.validation.validator).toBe('publishing-images-v1')
  expect(frozen.immutableAt).toBeTruthy()
  const rights = await RightsDeclaration.findById(frozen.rightsDeclarationId)
  expect(String(rights.revisionId)).toBe(f.body.revisionId)
  expect(rights.immutableAt).toBeTruthy()
  expect((await f.prepare()).body.frozenRights).toEqual(f.body.rights)
  expect(await RightsDeclaration.countDocuments()).toBe(2)
  expect(await EvidenceBatch.countDocuments({ status: 'pending' })).toBe(1)
  expect((await Chapter.findById(f.chapterId)).status).toBe('submitted')
  expect((await MediaAsset.findById(f.asset.id)).version).toBe(2)
  for (const changed of [
    { ...f.body, imageManifestDigest: '0'.repeat(64) },
    { ...f.body, rights: { ...f.body.rights, sourceLicenceNote: 'Khác' } },
  ])
    expect(
      (await chapterWrite(f.author.cookie, '/api/author/submissions', changed)).body.error.code,
    ).toBe('package_changed')
  const attempted = await chapterWrite(
    f.author.cookie,
    `/api/author/stories/${f.story._id}/chapters/${f.chapterId}`,
    {
      document: illustrated(f.asset.id),
      expectedVersion: 1,
    },
    'put',
  )
  expect(attempted.status).toBe(409)
})
it('requires rights bound to the image manifest and a note for licensed images without freezing on failure', async () => {
  const f = await submissionWithImages()
  const rights = f.body.rights
  const plain = { ...f.body }
  delete plain.rights
  delete plain.imageManifestDigest
  expect(
    (await chapterWrite(f.author.cookie, '/api/author/submissions', plain)).body.error.code,
  ).toBe('image_rights_required')
  expect(
    (
      await chapterWrite(f.author.cookie, '/api/author/submissions', {
        ...f.body,
        imageManifestDigest: '0'.repeat(64),
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await chapterWrite(f.author.cookie, '/api/author/submissions', {
        ...f.body,
        rights: { ...rights, basis: 'licensed', sourceLicenceNote: '   ' },
      })
    ).body.error.code,
  ).toBe('licence_note_required')
  expect(await EvidenceBatch.countDocuments()).toBe(0)
  expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeFalsy()
  expect((await MediaAsset.findById(f.asset.id)).version).toBe(1)
  expect(
    (
      await chapterWrite(f.author.cookie, '/api/author/submissions', {
        ...f.body,
        rights: {
          ...rights,
          basis: 'licensed',
          sourceLicenceNote: 'Giấy phép minh họa cho chương này.',
        },
      })
    ).status,
  ).toBe(201)
})
it.each(['missing-bytes', 'changed-bytes', 'changed-manifest', 'quarantined'])(
  'rejects %s between prepare and submit without creating a package',
  async mode => {
    const f = await submissionWithImages()
    const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
    if (mode === 'missing-bytes') await rm(path.join(root, asset.objectKey))
    if (mode === 'changed-bytes')
      await writeFile(path.join(root, asset.objectKey), Buffer.from('changed'))
    if (mode === 'changed-manifest')
      await ContentRevision.updateOne(
        { _id: f.body.revisionId, immutableAt: null },
        { $set: { 'validation.mediaManifest.0.checksum': '0'.repeat(64) } },
      )
    if (mode === 'quarantined') {
      asset.status = 'quarantined'
      await asset.save()
    }
    const data = (await f.prepare()).body
    expect(data.ready).toBe(false)
    expect(data.checks.find(c => c.code === 'media').ok).toBe(false)
    expect((await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)).status).toBe(
      409,
    )
    expect(await EvidenceBatch.countDocuments()).toBe(0)
    expect(await RightsDeclaration.countDocuments()).toBe(1)
    expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeFalsy()
  },
)
it('rolls back image pin, rights and package when final submission audit fails', async () => {
  const f = await submissionWithImages()
  const original = AuditEvent.create.bind(AuditEvent)
  const spy = vi.spyOn(AuditEvent, 'create').mockImplementation((docs, options) => {
    if (docs.some(doc => doc.action !== 'media.attached'))
      throw new Error('Submission audit unavailable')
    return original(docs, options)
  })
  try {
    expect((await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)).status).toBe(
      500,
    )
  } finally {
    spy.mockRestore()
  }
  expect((await MediaAsset.findById(f.asset.id)).version).toBe(1)
  expect(await RightsDeclaration.countDocuments()).toBe(1)
  expect(await EvidenceBatch.countDocuments()).toBe(0)
  expect((await Chapter.findById(f.chapterId)).status).toBe('draft')
  expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeFalsy()
})
it('creates a fresh illustrated draft after feedback, preserves its manifest and requires a new rights declaration', async () => {
  const f = await submissionWithImages()
  const sent = await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)
  const submission = await PublicationSubmission.findById(sent.body.submission.id)
  submission.status = 'rejected'
  await submission.save()
  const previous = await ContentRevision.findById(f.body.revisionId)
  const revised = await chapterWrite(
    f.author.cookie,
    `/api/author/submissions/${submission._id}/revise`,
    { expectedVersion: submission.version },
  )
  expect(revised.status).toBe(201)
  expect(revised.body.revision.formatVersion).toBe('blocks-v3')
  const fresh = await ContentRevision.findById(revised.body.revision.id)
  expect(fresh.validation.mediaManifest).toEqual(previous.validation.mediaManifest)
  expect(fresh.mediaDigest).toBe(previous.mediaDigest)
  expect(fresh.rightsDeclarationId).toBeUndefined()
  expect(fresh.rightsDigest).toBeUndefined()
  expect(fresh.packageDigest).toBeUndefined()
  expect(fresh.immutableAt).toBeUndefined()
  expect(fresh.validation.parentRightsDeclarationId).toBeUndefined()
  const prepared = (await f.prepare()).body
  expect(prepared.ready).toBe(true)
  expect(prepared.frozenRights).toBeUndefined()
  const resubmitted = await chapterWrite(f.author.cookie, '/api/author/submissions', {
    ...f.body,
    revisionId: String(fresh._id),
    expectedVersion: prepared.target.version,
  })
  expect(resubmitted.status).toBe(201)
  expect(resubmitted.body.submission.id).not.toBe(sent.body.submission.id)
  expect(await RightsDeclaration.countDocuments()).toBe(3)
  expect((await ContentRevision.findById(previous._id)).validation).toEqual(previous.validation)
})
it('serves only images bound to an exact owner package and detects replaced bytes even when library metadata matches', async () => {
  const f = await submissionWithImages()
  const sent = await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)
  const base = `/api/author/submissions/${sent.body.submission.id}`
  const response = await get(f.author.cookie, `${base}/package`)
  expect(response.status).toBe(200)
  expect(response.body.chapter.document).toEqual(illustrated(f.asset.id))
  expect(response.body.media.map(item => item.mediaId)).toEqual([f.asset.id])
  expect(JSON.stringify(response.body)).not.toContain('objectKey')
  const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
  const imagePath = `${base}/media/${f.asset.id}/content`
  const image = await get(f.author.cookie, imagePath).set('Origin', origin)
  expect(image.status).toBe(200)
  expect(image.body).toEqual(await readFile(path.join(root, asset.objectKey)))
  expect(image.headers['cache-control']).toBe('private, no-store')
  expect(image.headers['access-control-allow-credentials']).toBe('true')
  const extra = (await upload(f.author.cookie)).body.asset
  expect((await get(f.author.cookie, `${base}/media/${extra.id}/content`)).status).toBe(404)
  const other = await authenticatedAccount('author')
  expect((await get(other.cookie, imagePath)).status).toBe(404)
  expect((await request(app).get(imagePath)).status).toBe(401)
  const changed = await sharp({
    create: { width: 80, height: 120, channels: 4, background: '#f08030' },
  })
    .webp()
    .toBuffer()
  await writeFile(path.join(root, asset.objectKey), changed)
  await MediaAsset.updateOne(
    { _id: asset._id },
    {
      $set: {
        checksum: createHash('sha256').update(changed).digest('hex'),
        sizeBytes: changed.length,
      },
    },
  )
  // The library can read these new bytes, but the submitted package must refuse them.
  expect((await get(f.author.cookie, `/api${f.asset.url}`)).status).toBe(200)
  const rejected = await get(f.author.cookie, imagePath)
  expect(rejected.status).toBe(409)
  expect(rejected.body.error.code).toBe('media_changed')
  expect((await get(f.author.cookie, `${base}/package`)).body.chapter.document).toEqual(
    illustrated(f.asset.id),
  )
})
it('keeps submitted image content and declarations separate from a revised draft', async () => {
  const f = await submissionWithImages()
  const sent = await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)
  const submission = await PublicationSubmission.findById(sent.body.submission.id)
  submission.status = 'rejected'
  await submission.save()
  await chapterWrite(f.author.cookie, `/api/author/submissions/${submission._id}/revise`, {
    expectedVersion: submission.version,
  })
  const chapter = await Chapter.findById(f.chapterId)
  const saved = await chapterWrite(
    f.author.cookie,
    `/api/author/stories/${f.story._id}/chapters/${f.chapterId}`,
    {
      expectedVersion: chapter.version,
      document: {
        title: 'Bản mới không có ảnh',
        blocks: [{ type: 'paragraph', inlines: [{ text: 'Nội dung sửa mới', marks: [] }] }],
      },
    },
    'put',
  )
  expect(saved.status).toBe(200)
  const response = await get(f.author.cookie, `/api/author/submissions/${submission._id}/package`)
  expect(response.status).toBe(200)
  expect(response.body.chapter.document).toEqual(illustrated(f.asset.id))
  expect(response.body.rights).toEqual(f.body.rights)
  expect(response.body.revision.id).toBe(f.body.revisionId)
  expect(response.body.media.length).toBe(1)
})
it('reports a missing submitted image without substituting another asset', async () => {
  const f = await submissionWithImages()
  const sent = await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)
  const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
  await rm(path.join(root, asset.objectKey))
  expect(
    (await get(f.author.cookie, `/api/author/submissions/${sent.body.submission.id}/package`))
      .status,
  ).toBe(200)
  const response = await get(
    f.author.cookie,
    `/api/author/submissions/${sent.body.submission.id}/media/${asset._id}/content`,
  )
  expect(response.status).toBe(404)
  expect(response.body.error.code).toBe('media_unavailable')
})
it('serves submitted package images only to the moderator holding the live claim', async () => {
  const f = await submissionWithImages()
  const sent = await chapterWrite(f.author.cookie, '/api/author/submissions', f.body)
  expect(sent.status).toBe(201)
  const submissionId = sent.body.submission.id
  const moderator = await authenticatedAccount('moderator')
  const other = await authenticatedAccount('moderator')
  const base = `/api/moderator/submissions/${submissionId}/images`
  await markEvidenceReady(submissionId)
  const unclaimed = await get(moderator.cookie, `${base}/${f.asset.id}`)
  expect(unclaimed.status).toBe(409)
  expect(unclaimed.body.error.code).toBe('claim_not_held')
  const { version } = await PublicationSubmission.findById(submissionId)
  const claimed = await chapterWrite(
    moderator.cookie,
    `/api/moderator/submissions/${submissionId}/claim`,
    { expectedVersion: version },
  )
  expect(claimed.status).toBe(200)
  const image = await get(moderator.cookie, `${base}/${f.asset.id}`)
  expect(image.status).toBe(200)
  expect(image.headers['content-type']).toContain('image/webp')
  expect(image.headers['cache-control']).toBe('private, no-store')
  expect((await get(other.cookie, `${base}/${f.asset.id}`)).status).toBe(409)
  expect((await get(f.author.cookie, `${base}/${f.asset.id}`)).status).toBe(403)
  const randomId = crypto.randomUUID().replaceAll('-', '').slice(0, 24)
  expect((await get(moderator.cookie, `${base}/${randomId}`)).status).toBe(404)
  expect(
    (
      await get(
        moderator.cookie,
        `/api/moderator/submissions/${submissionId}/media/${f.asset.id}/content`,
      )
    ).status,
  ).toBe(404)
})
