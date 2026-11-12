import request from 'supertest'
import { afterAll, beforeAll, expect, it, vi, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  MediaAsset,
  PublicationSubmission,
  RightsDeclaration,
  Story,
  UnlockEntitlement,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
import { releaseDueChapters } from '../src/modules/authoring-publishing/content/chapter-scheduler.js'
useTestDatabase()
let root, app, png
const origin = 'http://localhost:5173'
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'novelhub-published-images-'))
  app = createApp(
    testConfig({ cookieName: 'novelhub_session', corsOrigin: origin, mediaStorageDir: root }),
  )
  png = await sharp({ create: { width: 80, height: 120, channels: 4, background: '#308070' } })
    .png()
    .toBuffer()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  if (root && path.basename(root).startsWith('novelhub-published-images-'))
    await rm(root, { recursive: true, force: true })
})
const write = (cookie, url, body) =>
  request(app).post(url).set('Cookie', cookie).set('Origin', origin).send(body)
const get = (cookie, url) => request(app).get(url).set('Cookie', cookie)
async function approve(sent) {
  expect(sent.status).toBe(201)
  const sub = await PublicationSubmission.findById(sent.body.submission.id)
  sub.status = 'approved'
  await sub.save()
  const rev = await ContentRevision.findById(sub.revisionId)
  rev.status = 'approved'
  await rev.save()
  const batch = await EvidenceBatch.findById(sub.currentEvidenceBatchId)
  batch.status = 'available-for-human-review'
  batch.stage = 'llm'
  await batch.save()
  if (sub.chapterId) {
    const chapter = await Chapter.findById(sub.chapterId)
    chapter.status = 'approved'
    await chapter.save()
  } else {
    const story = await Story.findById(sub.storyId)
    story.publicationStatus = 'approved'
    story.authoringFrozen = false
    await story.save()
  }
  return sub
}
async function fixture({ later = false } = {}) {
  const author = await authenticatedAccount('author')
  const cookie = author.cookie
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao',
    createdBy: author.account._id,
  })
  const storyId = (
    await write(cookie, '/api/author/stories', {
      title: 'Truyện minh họa',
      description: 'Tóm tắt truyện có ảnh.',
      categoryId: String(category._id),
    })
  ).body.story.id
  const prepared = (await get(cookie, `/api/author/submissions/prepare?storyId=${storyId}`)).body
  await approve(
    await write(cookie, '/api/author/submissions', {
      storyId,
      revisionId: prepared.target.revisionId,
      expectedVersion: prepared.target.version,
      rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
    }),
  )
  const storyTarget = (await get(cookie, `/api/author/stories/${storyId}/release`)).body.target
  expect(
    (
      await write(cookie, `/api/author/stories/${storyId}/release`, {
        revisionId: storyTarget.revisionId,
        submissionId: storyTarget.submissionId,
        expectedVersion: storyTarget.version,
      })
    ).status,
  ).toBe(201)
  let firstChapterId
  if (later) {
    firstChapterId = (
      await write(cookie, `/api/author/stories/${storyId}/chapters`, {
        title: 'Chương mở đầu',
        paragraphs: ['Nội dung được đọc thử.'],
      })
    ).body.chapter.id
    const preparedFirst = (
      await get(
        cookie,
        `/api/author/submissions/prepare?storyId=${storyId}&chapterId=${firstChapterId}`,
      )
    ).body
    await approve(
      await write(cookie, '/api/author/submissions', {
        storyId,
        chapterId: firstChapterId,
        revisionId: preparedFirst.target.revisionId,
        expectedVersion: preparedFirst.target.version,
      }),
    )
    const endpoint = `/api/author/stories/${storyId}/chapters/${firstChapterId}/release`
    const firstTarget = (await get(cookie, endpoint)).body.target
    expect(
      (
        await write(cookie, endpoint, {
          revisionId: firstTarget.revisionId,
          submissionId: firstTarget.submissionId,
          expectedVersion: firstTarget.version,
          expectedStoryVersion: firstTarget.storyVersion,
        })
      ).status,
    ).toBe(201)
  }
  const asset = (
    await request(app)
      .post('/api/author/media')
      .query({ name: 'Minh họa.png', kind: 'image', storyId })
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('Content-Type', 'application/octet-stream')
      .send(png)
  ).body.asset
  const document = {
    title: 'Chương có ảnh',
    blocks: [
      { type: 'paragraph', inlines: [{ text: 'Nội dung và hình minh họa.', marks: ['bold'] }] },
      {
        type: 'image',
        mediaId: asset.id,
        alt: 'Minh họa khu rừng',
        caption: 'Ánh sáng trong rừng',
      },
    ],
  }
  const created = await write(cookie, `/api/author/stories/${storyId}/chapters`, { document })
  expect(created.status).toBe(201)
  const chapterId = created.body.chapter.id
  const preparedChapter = (
    await get(cookie, `/api/author/submissions/prepare?storyId=${storyId}&chapterId=${chapterId}`)
  ).body
  const submission = await approve(
    await write(cookie, '/api/author/submissions', {
      storyId,
      chapterId,
      revisionId: preparedChapter.target.revisionId,
      expectedVersion: preparedChapter.target.version,
      imageManifestDigest: preparedChapter.imageRights.mediaDigest,
      rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
    }),
  )
  const endpoint = `/api/author/stories/${storyId}/chapters/${chapterId}/release`
  const target = (await get(cookie, endpoint)).body.target
  const body = {
    revisionId: target.revisionId,
    submissionId: target.submissionId,
    expectedVersion: target.version,
    expectedStoryVersion: target.storyVersion,
  }
  const publicUrl = `/api/catalog/stories/${storyId}/chapters/${chapterId}`
  const imageUrl = `${publicUrl}/revisions/${target.revisionId}/media/${asset.id}`
  return {
    firstChapterId,
    author,
    cookie,
    storyId,
    chapterId,
    asset,
    document,
    submission,
    target,
    body,
    endpoint,
    publicUrl,
    imageUrl,
  }
}
it('publishes the frozen illustrated package and serves only its bound WebP while preserving owner privacy', async () => {
  const f = await fixture()
  expect((await request(app).get(f.imageUrl)).status).toBe(404)
  expect((await get(f.cookie, f.endpoint)).body.ready).toBe(true)
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const publicChapter = await request(app).get(f.publicUrl)
  expect(publicChapter.status).toBe(200)
  expect(publicChapter.body.chapter.blocks).toEqual(f.document.blocks)
  const image = await request(app).get(f.imageUrl)
  expect(image.status).toBe(200)
  expect(image.headers['content-type']).toMatch(/image\/webp/)
  expect(image.headers['cache-control']).toBe('private, no-store')
  expect(image.headers.vary).toMatch(/Cookie/)
  expect(image.headers['x-content-type-options']).toBe('nosniff')
  const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
  expect(image.body).toEqual(await readFile(path.join(root, asset.objectKey)))
  expect(asset.accessClass).toBe('private')
  expect((await request(app).get(`/api/author/media/${f.asset.id}/content`)).status).toBe(401)
  expect((await request(app).get(f.imageUrl.replace(f.target.revisionId, f.storyId))).status).toBe(
    404,
  )
  expect((await request(app).get(f.imageUrl.replace(f.asset.id, f.storyId))).status).toBe(404)
})
it.each(['chapter', 'story'])(
  'stops serving an image after its %s is no longer public',
  async target => {
    const f = await fixture()
    expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
    if (target === 'chapter') {
      const row = await Chapter.findById(f.chapterId)
      row.status = 'unpublished'
      await row.save()
    }
    if (target === 'story') {
      const row = await Story.findById(f.storyId)
      row.publicationStatus = 'unpublished'
      await row.save()
    }
    expect((await request(app).get(f.imageUrl)).status).toBe(404)
  },
)
it('hides all published resources during account suspension and restores them when active', async () => {
  const f = await fixture()
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const account = await Account.findById(f.author.account._id)
  account.status = 'suspended'
  await account.save()
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(404)
  expect((await request(app).get(f.publicUrl)).status).toBe(404)
  expect((await request(app).get(f.imageUrl)).status).toBe(404)
  account.status = 'active'
  await account.save()
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(200)
  expect((await request(app).get(f.publicUrl)).status).toBe(200)
  expect((await request(app).get(f.imageUrl)).status).toBe(200)
})
it('reuses chapter entitlement checks for images and never exposes locked content through an image URL', async () => {
  const f = await fixture()
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const chapter = await Chapter.findById(f.chapterId)
  chapter.earlyAccess = {
    enabled: true,
    durationDays: 1,
    coinPrice: 10,
    endsAt: new Date(Date.now() + 86400000),
  }
  await chapter.save()
  const reader = await authenticatedAccount()
  expect((await request(app).get(f.imageUrl)).status).toBe(403)
  expect((await get(reader.cookie, f.imageUrl)).status).toBe(403)
  await UnlockEntitlement.create({
    accountId: reader.account._id,
    storyId: f.storyId,
    chapterId: f.chapterId,
    publishedRevisionId: f.target.revisionId,
    status: 'active',
    purchasedAt: new Date(),
    expiresAt: chapter.earlyAccess.endsAt,
    priceCoins: 10,
  })
  expect((await get(reader.cookie, f.imageUrl)).status).toBe(200)
  expect((await get(reader.cookie, f.publicUrl)).status).toBe(200)
})
it('rejects bytes replaced together with library metadata against the frozen manifest', async () => {
  const f = await fixture()
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
  const replacement = await sharp({
    create: { width: 80, height: 120, channels: 4, background: '#906040' },
  })
    .webp()
    .toBuffer()
  await writeFile(path.join(root, asset.objectKey), replacement)
  asset.checksum = createHash('sha256').update(replacement).digest('hex')
  asset.sizeBytes = replacement.length
  await asset.save()
  expect((await get(f.cookie, `/api/author/media/${asset._id}/content`)).status).toBe(200)
  expect((await request(app).get(f.imageUrl)).status).toBe(409)
})
it('blocks changed image bytes between preparation and publication without exposing a chapter', async () => {
  const f = await fixture()
  const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
  await writeFile(path.join(root, asset.objectKey), Buffer.from('corrupt bytes'))
  expect((await get(f.cookie, f.endpoint)).body.checks.find(c => c.code === 'media').ok).toBe(false)
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409)
  expect((await request(app).get(f.publicUrl)).status).toBe(404)
})
it('rolls back image pins and publication if the final publication audit fails', async () => {
  const f = await fixture()
  const before = await MediaAsset.findById(f.asset.id)
  const create = AuditEvent.create.bind(AuditEvent)
  vi.spyOn(AuditEvent, 'create').mockImplementation((rows, options) => {
    if (rows.some(row => row.action === 'chapter.published'))
      throw new Error('Injected audit failure')
    return create(rows, options)
  })
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(500)
  expect((await MediaAsset.findById(f.asset.id)).version).toBe(before.version)
  expect((await Chapter.findById(f.chapterId)).publishedRevisionId).toBeUndefined()
})
it('stops serving images after the associated rights declaration is superseded', async () => {
  const f = await fixture()
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const revision = await ContentRevision.findById(f.target.revisionId)
  const rights = await RightsDeclaration.findById(revision.rightsDeclarationId)
  rights.status = 'superseded'
  await rights.save()
  expect((await request(app).get(f.imageUrl)).status).toBe(404)
  // The owner can still inspect the historical package privately.
  expect(
    (
      await get(
        f.cookie,
        `/api/author/submissions/${f.target.submissionId}/media/${f.asset.id}/content`,
      )
    ).status,
  ).toBe(200)
})
it.each(['expired', 'revoked', 'wrong-chapter'])(
  'refuses an image when a reader entitlement is %s',
  async condition => {
    const f = await fixture()
    expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
    const chapter = await Chapter.findById(f.chapterId)
    const future = new Date(Date.now() + 86400000)
    chapter.earlyAccess = { enabled: true, durationDays: 1, coinPrice: 10, endsAt: future }
    await chapter.save()
    const reader = await authenticatedAccount()
    await UnlockEntitlement.create({
      accountId: reader.account._id,
      storyId: f.storyId,
      chapterId: condition === 'wrong-chapter' ? f.storyId : f.chapterId,
      publishedRevisionId: f.target.revisionId,
      status: condition === 'revoked' ? 'revoked' : 'active',
      purchasedAt: new Date(Date.now() - 86400000),
      expiresAt: condition === 'expired' ? new Date(Date.now() - 1000) : future,
      priceCoins: 10,
    })
    expect((await get(reader.cookie, f.imageUrl)).status).toBe(403)
  },
)
it('marks unpublished, wrong-revision and locked chapter/image errors as private and non-cacheable', async () => {
  const f = await fixture()
  const check = async (url, status) => {
    const response = await request(app).get(url)
    expect(response.status).toBe(status)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers.vary).toMatch(/Cookie/)
  }
  await check(f.publicUrl, 404)
  await check(f.imageUrl, 404)
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  await check(f.imageUrl.replace(f.target.revisionId, f.storyId), 404)
  const chapter = await Chapter.findById(f.chapterId)
  chapter.earlyAccess = {
    enabled: true,
    durationDays: 1,
    coinPrice: 10,
    endsAt: new Date(Date.now() + 86400000),
  }
  await chapter.save()
  await check(f.publicUrl, 403)
  await check(f.imageUrl, 403)
})
it('allows guests only chapter one and requires a valid session for later free text and images', async () => {
  const f = await fixture({ later: true })
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const firstUrl = `/api/catalog/stories/${f.storyId}/chapters/${f.firstChapterId}`
  expect((await request(app).get(firstUrl)).status).toBe(200)
  for (const url of [f.publicUrl, f.imageUrl]) {
    const guest = await request(app).get(url)
    expect(guest.status).toBe(401)
    expect(JSON.stringify(guest.body)).not.toContain('Nội dung và hình minh họa')
    expect(guest.headers['cache-control']).toBe('private, no-store')
    expect((await get('novelhub_session=invalid', url)).status).toBe(401)
  }
  const reader = await authenticatedAccount()
  expect((await get(reader.cookie, f.publicUrl)).status).toBe(200)
  expect((await get(reader.cookie, f.imageUrl)).status).toBe(200)

  const first = await Chapter.findById(f.firstChapterId)
  first.status = 'unpublished'
  await first.save()

  expect((await get(reader.cookie, f.publicUrl)).status).toBe(200)
})
it('creates a private illustrated correction after unpublishing and requires a new image declaration before resubmission', async () => {
  const f = await fixture()
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201)
  const workspace = (await get(f.cookie, `/api/author/stories/${f.storyId}/workspace`)).body
  const chapter = workspace.chapters[0]
  expect(
    (
      await write(f.cookie, `/api/author/stories/${f.storyId}/chapters/${f.chapterId}/lifecycle`, {
        action: 'unpublish',
        expectedVersion: chapter.version,
        expectedStoryVersion: workspace.story.version,
      })
    ).status,
  ).toBe(200)
  const source = (await get(f.cookie, `/api/author/stories/${f.storyId}/workspace`)).body
    .chapters[0].reviseSource
  const revised = await write(f.cookie, `/api/author/submissions/${source.id}/revise`, {
    expectedVersion: source.version,
  })
  expect(revised.status).toBe(201)
  expect(revised.body.revision.formatVersion).toBe('blocks-v3')
  const fresh = await ContentRevision.findById(revised.body.revision.id)
  const old = await ContentRevision.findById(f.target.revisionId)
  expect(fresh.content).toEqual(old.content)
  expect(fresh.validation.mediaManifest).toEqual(old.validation.mediaManifest)
  expect(fresh.mediaDigest).toBe(old.mediaDigest)
  expect(fresh.packageDigest).toBeUndefined()
  expect(fresh.rightsDeclarationId).toBeUndefined()
  const prep = (
    await get(
      f.cookie,
      `/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${f.chapterId}`,
    )
  ).body
  expect(prep.requiresRights).toBe(true)
  const body = {
    storyId: f.storyId,
    chapterId: f.chapterId,
    revisionId: String(fresh._id),
    expectedVersion: prep.target.version,
  }
  expect((await write(f.cookie, '/api/author/submissions', body)).status).toBe(409)
  expect(
    (
      await write(f.cookie, '/api/author/submissions', {
        ...body,
        imageManifestDigest: prep.imageRights.mediaDigest,
        rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
      })
    ).status,
  ).toBe(201)
  expect((await request(app).get(f.imageUrl)).status).toBe(404)
})
it.each([false, true])(
  'rechecks the frozen image bytes at scheduled release (tampered=%s)',
  async tampered => {
    const f = await fixture()
    const releaseAt = new Date(Date.now() + 60000)
    expect(
      (
        await request(app)
          .put(f.endpoint.replace(/release$/, 'schedule'))
          .set('Cookie', f.cookie)
          .set('Origin', origin)
          .send({ ...f.body, requestedReleaseAt: releaseAt.toISOString() })
      ).status,
    ).toBe(200)
    if (tampered) {
      const asset = await MediaAsset.findById(f.asset.id).select('+objectKey')
      await writeFile(path.join(root, asset.objectKey), Buffer.from('changed image bytes'))
    }
    const result = await releaseDueChapters(
      testConfig({
        cookieName: 'novelhub_session',
        corsOrigin: origin,
        mediaStorageDir: root,
      }),
      { now: releaseAt },
    )
    expect(result.published).toBe(tampered ? 0 : 1)
    expect((await request(app).get(f.imageUrl)).status).toBe(tampered ? 404 : 200)
    expect((await Chapter.findById(f.chapterId)).status).toBe(tampered ? 'due' : 'published')
  },
)
