import mongoose from 'mongoose'
import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  Category,
  ContentRevision,
  EvidenceBatch,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../src/models/index.js'
import { loadSubmittedPackage } from '../src/modules/authoring-publishing/author/author-submitted-package.js'
import { digest } from '../src/modules/authoring-publishing/submissions/submission-digests.js'
import {
  migrateStorySingleCategory,
  migrationExitCode,
} from '../scripts/migrate-story-single-category.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (cookie, path, body) =>
  request(app).post(path).set('Cookie', cookie).set('Origin', origin).send(body)
const models = [Story, ContentRevision, PublicationSubmission, EvidenceBatch]
const snapshot = () =>
  Promise.all(models.map(Model => Model.collection.find({}, { sort: { _id: 1 } }).toArray()))
const empty = {
  stories: 0,
  revisions: 0,
  packageDigests: 0,
  corrections: 0,
  submissions: 0,
  evidenceBatches: 0,
  unresolvedStories: [],
  retiredCategories: [],
  unverifiedDigests: [],
}

// A released story package, an Admin former-Author correction of it and a draft story.
async function fixture() {
  const admin = await authenticatedAccount('admin'),
    author = await authenticatedAccount('author')
  const [first, second] = await Category.create(
    ['Kỳ ảo', 'Trinh thám'].map(name => ({
      name,
      normalizedName: name.toLowerCase(),
      createdBy: admin.account._id,
    })),
  )
  const draft = await write(author.cookie, '/api/author/stories', {
    title: 'Bản nháp',
    description: 'Chưa gửi.',
    categoryId: String(first._id),
  })
  const created = await write(author.cookie, '/api/author/stories', {
    title: 'Tên gốc',
    description: 'Mô tả gốc.',
    categoryId: String(first._id),
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
  const released = await write(author.cookie, `/api/author/stories/${id}/release`, {
    revisionId: String(revision._id),
    submissionId: String(submission._id),
    expectedVersion: story.version,
  })
  expect(released.status).toBe(201)
  const role = await RoleAssignment.findOne({ accountId: author.account._id, role: 'author' }),
    account = await Account.findById(author.account._id)
  const revoked = await write(admin.cookie, `/api/admin/authors/${account._id}/revoke`, {
    roleId: String(role._id),
    expectedRoleVersion: role.version,
    expectedAccountVersion: account.version,
    reason: 'Thu hồi quyền',
  })
  expect(revoked.status).toBe(200)
  const path = `/api/admin/former-author-stories/${id}`
  const state = (await request(app).get(path).set('Cookie', admin.cookie)).body.story
  const corrected = await write(admin.cookie, path, {
    action: 'correct',
    expectedVersion: state.version,
    expectedPublishedRevisionId: state.publishedRevisionId,
    reason: 'Quản trị sửa thông tin',
    title: 'Tên quản trị sửa',
    description: 'Mô tả sửa.',
    categoryId: String(first._id),
  })
  expect(corrected.status).toBe(200)
  return { admin, author, first, second, id, draftId: draft.body.story.id, submission, path }
}

// Rewrites the fixture into the shape stored before the N:1 change, with every digest computed
// the way it was then: over content that held `categoryIds`. With `corrections: false` the
// corrections keep their single-category content but still point at the legacy root digest;
// with `stories: false` the story documents keep `categoryId`.
async function toLegacy(categoryIds, { corrections = true, stories = true } = {}) {
  if (stories)
    await Story.collection.updateMany({}, { $unset: { categoryId: '' }, $set: { categoryIds } })
  const revisions = await ContentRevision.collection.find({ contentType: 'story' }).toArray()
  const legacyContent = revision => {
    const content = { ...revision.content, categoryIds: categoryIds.map(String) }
    delete content.categoryId
    return content
  }
  const rootDigests = new Map()
  for (const revision of revisions.filter(row => !row.validation?.adminFormerAuthorCorrection)) {
    const content = legacyContent(revision)
    const set = { content }
    if (revision.packageDigest) {
      set.packageDigest = digest({
        formatVersion: revision.formatVersion,
        content,
        rightsDigest: revision.rightsDigest,
        mediaDigest: revision.mediaDigest,
      })
      rootDigests.set(revision.packageDigest, set.packageDigest)
      for (const Model of [PublicationSubmission, EvidenceBatch])
        await Model.collection.updateMany(
          { revisionId: revision._id },
          { $set: { packageDigest: set.packageDigest } },
        )
    }
    await ContentRevision.collection.updateOne({ _id: revision._id }, { $set: set })
  }
  for (const revision of revisions.filter(row => row.validation?.adminFormerAuthorCorrection)) {
    const content = corrections ? legacyContent(revision) : revision.content
    const previous = revision.validation.adminFormerAuthorCorrection
    const correction = {
      ...previous,
      rootPackageDigest: rootDigests.get(previous.rootPackageDigest),
    }
    await ContentRevision.collection.updateOne(
      { _id: revision._id },
      {
        $set: {
          content,
          'validation.adminFormerAuthorCorrection': correction,
          packageDigest: digest({ content, correction }),
        },
      },
    )
  }
}

it('keeps the first category, keeps package digests verifiable and is a no-op when re-run', async () => {
  const f = await fixture()
  await toLegacy([f.first._id, f.second._id])
  const tampered = await ContentRevision.collection.insertOne({
    contentType: 'story',
    storyId: new mongoose.Types.ObjectId(f.draftId),
    authorAccountId: f.author.account._id,
    revisionNumber: 2,
    formatVersion: 'story-v1',
    content: { title: 'Gói hỏng', description: 'x', categoryIds: [String(f.second._id)] },
    status: 'rejected',
    immutableAt: new Date(),
    packageDigest: 'f'.repeat(64),
  })
  // The current code reads no legacy field: the legacy correction does not verify.
  expect((await request(app).get(f.path).set('Cookie', f.admin.cookie)).status).toBe(409)
  const storyRevisions = await ContentRevision.countDocuments({ contentType: 'story' })
  const expected = {
    ...empty,
    stories: 2,
    revisions: storyRevisions,
    packageDigests: 2,
    corrections: 1,
    submissions: 1,
    evidenceBatches: 1,
    unverifiedDigests: [String(tampered.insertedId)],
  }

  const legacy = await snapshot()
  expect(await migrateStorySingleCategory()).toEqual({ mode: 'dry-run', ...expected })
  expect(await snapshot()).toEqual(legacy)

  expect(await migrateStorySingleCategory({ apply: true })).toEqual({ mode: 'apply', ...expected })
  const first = String(f.first._id)
  for (const story of await Story.collection.find().toArray()) {
    expect(story).not.toHaveProperty('categoryIds')
    expect(String(story.categoryId)).toBe(first)
  }
  const revisions = await ContentRevision.collection.find({ contentType: 'story' }).toArray()
  for (const revision of revisions) {
    expect(revision.content).not.toHaveProperty('categoryIds')
    expect(revision.content.categoryId).toBe(
      String(revision._id) === String(tampered.insertedId) ? String(f.second._id) : first,
    )
  }
  expect(
    (await ContentRevision.collection.findOne({ _id: tampered.insertedId })).packageDigest,
  ).toBe('f'.repeat(64))

  // Every stored copy of the package digest matches a recomputation over the migrated content.
  const root = await loadSubmittedPackage({ _id: f.author.account._id }, f.submission._id)
  expect(root.revision.content).toMatchObject({ categoryId: first })
  expect((await PublicationSubmission.findById(f.submission._id)).packageDigest).toBe(
    root.revision.packageDigest,
  )
  expect((await EvidenceBatch.findOne({ submissionId: f.submission._id })).packageDigest).toBe(
    root.revision.packageDigest,
  )
  const correction = revisions.find(row => row.validation?.adminFormerAuthorCorrection)
  expect(correction.validation.adminFormerAuthorCorrection.rootPackageDigest).toBe(
    root.revision.packageDigest,
  )
  const detail = await request(app).get(f.path).set('Cookie', f.admin.cookie)
  expect(detail.status).toBe(200)
  expect(detail.body.story.categoryId).toBe(first)
  expect((await request(app).get(`/api/catalog/stories/${f.id}`)).body.story).toMatchObject({
    title: 'Tên quản trị sửa',
    categoryId: first,
    genre: 'Kỳ ảo',
  })

  const migrated = await snapshot()
  expect(await migrateStorySingleCategory({ apply: true })).toEqual({ mode: 'apply', ...empty })
  expect(await snapshot()).toEqual(migrated)
})

it('leaves a story whose category cannot be resolved unchanged, reports it and fails the run', async () => {
  const author = await authenticatedAccount('author')
  const [active, retired] = await Category.create(
    [
      ['Kỳ ảo', 'active'],
      ['Cổ trang', 'retired'],
    ].map(([name, status]) => ({
      name,
      normalizedName: name.toLowerCase(),
      status,
      createdBy: author.account._id,
    })),
  )
  const absent = new mongoose.Types.ObjectId()
  // Inserted through the driver: these shapes predate the current model.
  const insertStory = async (fields, contents) => {
    const { insertedId } = await Story.collection.insertOne({
      authorAccountId: author.account._id,
      title: 'Truyện cũ',
      language: 'vi',
      publicationStatus: 'draft',
      completionStatus: 'ongoing',
      authoringFrozen: false,
      version: 0,
      ...fields,
    })
    const revisionIds = []
    for (const [index, content] of contents.entries()) {
      const revision = await ContentRevision.collection.insertOne({
        contentType: 'story',
        storyId: insertedId,
        authorAccountId: author.account._id,
        revisionNumber: index + 1,
        formatVersion: 'story-v1',
        status: 'editable',
        content: { title: 'Truyện cũ', description: 'Mô tả.', ...content },
      })
      revisionIds.push(String(revision.insertedId))
    }
    return { storyId: String(insertedId), revisionIds }
  }
  const activeId = String(active._id)
  const emptyArray = await insertStory({ categoryIds: [] }, [{ categoryIds: [activeId] }])
  const missingField = await insertStory({}, [{}])
  const malformed = await insertStory({ categoryIds: ['khong-phai-id'] }, [
    { categoryIds: ['khong-phai-id'] },
  ])
  const dangling = await insertStory({ categoryIds: [absent] }, [
    { categoryIds: [activeId] },
    { categoryIds: [String(absent)] },
  ])
  const retiredFirst = await insertStory({ categoryIds: [retired._id, active._id] }, [
    { categoryIds: [String(retired._id), activeId] },
  ])
  const fallback = await insertStory({ categoryId: active._id, categoryIds: [] }, [
    { categoryId: activeId, categoryIds: [] },
  ])
  const record = (type, id, reason) => ({ type, id, reason })
  const unresolvedStories = [
    {
      storyId: emptyArray.storyId,
      records: [record('story', emptyArray.storyId, 'missing-category')],
    },
    {
      storyId: missingField.storyId,
      records: [
        record('story', missingField.storyId, 'missing-category'),
        record('revision', missingField.revisionIds[0], 'missing-category'),
      ],
    },
    {
      storyId: malformed.storyId,
      records: [
        record('story', malformed.storyId, 'malformed-category'),
        record('revision', malformed.revisionIds[0], 'malformed-category'),
      ],
    },
    {
      storyId: dangling.storyId,
      records: [
        record('story', dangling.storyId, 'unknown-category'),
        record('revision', dangling.revisionIds[1], 'unknown-category'),
      ],
    },
  ]
  const expected = {
    ...empty,
    stories: 2,
    revisions: 2,
    unresolvedStories,
    retiredCategories: [{ storyId: retiredFirst.storyId, categoryId: String(retired._id) }],
  }
  const unresolvedIds = unresolvedStories.map(row => new mongoose.Types.ObjectId(row.storyId))
  const unresolvedRecords = async () => [
    await Story.collection.find({ _id: { $in: unresolvedIds } }, { sort: { _id: 1 } }).toArray(),
    await ContentRevision.collection
      .find({ storyId: { $in: unresolvedIds } }, { sort: { _id: 1 } })
      .toArray(),
  ]
  const before = await unresolvedRecords()

  expect(await migrateStorySingleCategory()).toEqual({ mode: 'dry-run', ...expected })
  const applied = await migrateStorySingleCategory({ apply: true })
  expect(applied).toEqual({ mode: 'apply', ...expected })
  expect(migrationExitCode(applied)).toBe(1)
  expect(await unresolvedRecords()).toEqual(before)

  // A retired first category is kept, not replaced by the next active one.
  const kept = await Story.collection.findOne({
    _id: new mongoose.Types.ObjectId(retiredFirst.storyId),
  })
  expect(kept).not.toHaveProperty('categoryIds')
  expect(String(kept.categoryId)).toBe(String(retired._id))
  expect((await ContentRevision.collection.findOne({ storyId: kept._id })).content).toEqual({
    title: 'Truyện cũ',
    description: 'Mô tả.',
    categoryId: String(retired._id),
  })
  // An empty array falls back to the single category already stored.
  const fellBack = await Story.collection.findOne({
    _id: new mongoose.Types.ObjectId(fallback.storyId),
  })
  expect(fellBack).not.toHaveProperty('categoryIds')
  expect(String(fellBack.categoryId)).toBe(activeId)

  const rerun = await migrateStorySingleCategory({ apply: true })
  expect(rerun).toEqual({ mode: 'apply', ...empty, unresolvedStories })
  expect(migrationExitCode(rerun)).toBe(1)
  expect(await unresolvedRecords()).toEqual(before)
  expect(migrationExitCode({ ...empty })).toBe(0)
})

it('re-links an already single-category correction to its migrated legacy root', async () => {
  const f = await fixture()
  await toLegacy([f.first._id, f.second._id], { corrections: false, stories: false })
  const correctionOf = row => row.validation?.adminFormerAuthorCorrection
  const storyRevisions = () =>
    ContentRevision.collection.find({ storyId: new mongoose.Types.ObjectId(f.id) }).toArray()
  const legacyRoot = (await storyRevisions()).find(
    row => String(row._id) === String(f.submission.revisionId),
  )
  const single = (await storyRevisions()).find(correctionOf)
  // The legacy chain verifies on its own terms; the current reader rejects the legacy root.
  expect(single.content).not.toHaveProperty('categoryIds')
  expect(correctionOf(single).rootPackageDigest).toBe(legacyRoot.packageDigest)
  expect(single.packageDigest).toBe(
    digest({ content: single.content, correction: correctionOf(single) }),
  )
  expect((await request(app).get(f.path).set('Cookie', f.admin.cookie)).status).toBe(409)

  const legacyRevisions = await ContentRevision.countDocuments({
    contentType: 'story',
    'content.categoryIds': { $exists: true },
  })
  expect(await migrateStorySingleCategory({ apply: true })).toEqual({
    mode: 'apply',
    ...empty,
    revisions: legacyRevisions + 1,
    packageDigests: 2,
    corrections: 1,
    submissions: 1,
    evidenceBatches: 1,
  })
  const root = await loadSubmittedPackage({ _id: f.author.account._id }, f.submission._id)
  const relinked = (await storyRevisions()).find(correctionOf)
  expect(relinked.content).toEqual(single.content)
  expect(correctionOf(relinked).rootPackageDigest).toBe(root.revision.packageDigest)
  expect(relinked.packageDigest).toBe(
    digest({ content: relinked.content, correction: correctionOf(relinked) }),
  )
  const detail = await request(app).get(f.path).set('Cookie', f.admin.cookie)
  expect(detail.status).toBe(200)
  expect(detail.body.story.categoryId).toBe(String(f.first._id))

  const migrated = await snapshot()
  expect(await migrateStorySingleCategory({ apply: true })).toEqual({ mode: 'apply', ...empty })
  expect(await snapshot()).toEqual(migrated)
})

it('rolls a story back as a whole when a later write in its transaction fails', async () => {
  const f = await fixture()
  await toLegacy([f.first._id, f.second._id])
  const storyId = new mongoose.Types.ObjectId(f.id)
  const storyRecords = async () => [
    await Story.collection.findOne({ _id: storyId }),
    await ContentRevision.collection.find({ storyId }, { sort: { _id: 1 } }).toArray(),
    await PublicationSubmission.collection.find({ storyId }, { sort: { _id: 1 } }).toArray(),
    await EvidenceBatch.collection
      .find({ submissionId: f.submission._id }, { sort: { _id: 1 } })
      .toArray(),
  ]
  const before = await storyRecords()
  // The story and its submission are written before the evidence batches.
  const failing = vi
    .spyOn(EvidenceBatch.collection, 'updateMany')
    .mockRejectedValueOnce(new Error('forced failure'))
  await expect(migrateStorySingleCategory({ apply: true })).rejects.toThrow('forced failure')
  expect(failing).toHaveBeenCalledTimes(1)
  expect(await storyRecords()).toEqual(before)

  vi.restoreAllMocks()
  expect((await migrateStorySingleCategory({ apply: true })).unresolvedStories).toEqual([])
  expect((await request(app).get(f.path).set('Cookie', f.admin.cookie)).status).toBe(200)
})
