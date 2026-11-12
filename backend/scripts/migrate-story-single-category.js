// One-off data migration for the Story–Category N:1 change: every story keeps exactly one main
// category. Converts the stored data in MONGODB_URI:
// - stories: `categoryIds[0]` becomes `categoryId` and `categoryIds` is removed;
// - story revisions: `content.categoryIds[0]` becomes `content.categoryId` (an ObjectId string).
// When a record stores both shapes, the first array element wins; an empty array falls back to
// the stored `categoryId`. A retired first category is kept and reported, never replaced.
// Each story is checked as a whole before anything is written: if the story or any of its story
// revisions has no category, a malformed one or one with no Category document, the whole story
// is left unchanged and reported as unresolved, and the run exits non-zero.
// A submitted story package has a `packageDigest` computed over its content, copied to its
// submission and evidence batches. The migration recomputes it with the same digest function,
// updates those copies and re-links every Admin former-Author correction of that package,
// including corrections already stored with one category, so every package integrity check
// still passes. A revision whose digest did not verify before the migration keeps that stored
// digest (its content is still converted to one category) and is listed in `unverifiedDigests`.
// Audit, moderation-history and AI-attempt records keep the digests they were written
// with: they are append-only history and are never re-verified.
// Frozen revisions are rewritten through the driver on purpose, because the Mongoose field
// locks forbid it. Each story migrates in its own transaction; re-running changes nothing.
// Dry run by default; take a backup first. The shared database was migrated on 2026-11-11
// (36 stories; the old index was dropped); use this for local or restored copies:
//   npm run db:migrate-story-single-category --workspace backend            # writes nothing
//   npm run db:migrate-story-single-category --workspace backend -- --apply
// Afterwards `db:create-indexes -- --models Story` adds the `categoryId` index; the old
// `categoryIds_1_publicationStatus_1` index is then unused and can be dropped.
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import mongoose from 'mongoose'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase, withTransaction } from '../src/db/connection.js'
import {
  Category,
  ContentRevision,
  EvidenceBatch,
  PublicationSubmission,
  Story,
} from '../src/models/index.js'
import { digest } from '../src/modules/authoring-publishing/submissions/submission-digests.js'

const has = (record, key) => Boolean(record) && Object.hasOwn(record, key)
const correctionOf = revision => revision.validation?.adminFormerAuthorCorrection

/** The category a record keeps: its first legacy category, else its single category. */
const chosenCategory = record =>
  Array.isArray(record?.categoryIds) && record.categoryIds.length
    ? record.categoryIds[0]
    : record?.categoryId

/** `{ id, status }` of an existing Category, or `{ reason }` when it cannot be used. */
async function resolveCategory(value, session) {
  if (value == null) return { reason: 'missing-category' }
  const id =
    value?._bsontype === 'ObjectId'
      ? value
      : typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
        ? new mongoose.Types.ObjectId(value)
        : null
  if (!id) return { reason: 'malformed-category' }
  const category = await Category.collection.findOne(
    { _id: id },
    { session, projection: { status: 1 } },
  )
  return category ? { id, status: category.status } : { reason: 'unknown-category' }
}

function singleCategoryContent(content, categoryId) {
  const next = { ...content, categoryId: String(categoryId) }
  delete next.categoryIds
  return next
}

// Same inputs as the package digest written when an Author submits a story package.
const authorPackageDigest = (revision, content) =>
  digest({
    formatVersion: revision.formatVersion,
    content,
    rightsDigest: revision.rightsDigest,
    mediaDigest: revision.mediaDigest,
  })

const emptyResult = () => ({
  stories: 0,
  revisions: 0,
  packageDigests: 0,
  corrections: 0,
  submissions: 0,
  evidenceBatches: 0,
  unresolvedStories: [],
  retiredCategories: [],
  unverifiedDigests: [],
})

async function migrateStory(storyId, session, apply) {
  const options = { session }
  const result = emptyResult()
  const story = await Story.collection.findOne({ _id: storyId }, options)
  const revisions = await ContentRevision.collection
    .find({ storyId, contentType: 'story' }, { ...options, sort: { revisionNumber: 1 } })
    .toArray()

  // Preflight: resolve every category this story needs before writing anything.
  const unresolved = []
  const retired = new Set()
  const check = async (record, id, type) => {
    const resolved = await resolveCategory(chosenCategory(record), session)
    if (resolved.reason) unresolved.push({ type, id: String(id), reason: resolved.reason })
    else if (resolved.status === 'retired') retired.add(String(resolved.id))
    return resolved.id
  }
  let storyCategoryId = null
  if (story && (has(story, 'categoryIds') || story.categoryId == null)) {
    const categoryId = await check(story, story._id, 'story')
    if (has(story, 'categoryIds')) storyCategoryId = categoryId
  }
  const contents = new Map()
  for (const revision of revisions) {
    if (!has(revision.content, 'categoryIds') && revision.content?.categoryId != null) continue
    const categoryId = await check(revision.content, revision._id, 'revision')
    if (categoryId && has(revision.content, 'categoryIds'))
      contents.set(String(revision._id), singleCategoryContent(revision.content, categoryId))
  }
  if (unresolved.length) {
    result.unresolvedStories.push({ storyId: String(storyId), records: unresolved })
    return result
  }
  for (const categoryId of retired)
    result.retiredCategories.push({ storyId: String(storyId), categoryId })

  if (storyCategoryId) {
    result.stories = 1
    if (apply)
      await Story.collection.updateOne(
        { _id: storyId },
        { $set: { categoryId: storyCategoryId }, $unset: { categoryIds: '' } },
        options,
      )
  }
  const write = async (revision, set) => {
    result.revisions += 1
    if (apply)
      await ContentRevision.collection.updateOne({ _id: revision._id }, { $set: set }, options)
  }

  // Author packages first: a correction records the digest of its root Author package.
  const rootDigests = new Map()
  for (const revision of revisions.filter(row => !correctionOf(row))) {
    const content = contents.get(String(revision._id))
    if (!content) continue
    const set = { content }
    if (revision.packageDigest) {
      if (revision.packageDigest === authorPackageDigest(revision, revision.content)) {
        set.packageDigest = authorPackageDigest(revision, content)
        rootDigests.set(String(revision._id), {
          from: revision.packageDigest,
          to: set.packageDigest,
        })
        result.packageDigests += 1
        const copies = { revisionId: revision._id, packageDigest: revision.packageDigest }
        const update = { $set: { packageDigest: set.packageDigest } }
        for (const [Model, key] of [
          [PublicationSubmission, 'submissions'],
          [EvidenceBatch, 'evidenceBatches'],
        ]) {
          result[key] += apply
            ? (await Model.collection.updateMany(copies, update, options)).modifiedCount
            : await Model.collection.countDocuments(copies, options)
        }
      } else result.unverifiedDigests.push(String(revision._id))
    }
    await write(revision, set)
  }

  // Every correction of a re-digested root is re-linked, whatever shape its own content has.
  for (const revision of revisions.filter(correctionOf)) {
    const correction = correctionOf(revision)
    const content = contents.get(String(revision._id))
    const root = rootDigests.get(String(correction.rootRevisionId))
    const relink = Boolean(root) && correction.rootPackageDigest === root.from
    if (!content && !relink) continue
    const set = content ? { content } : {}
    if (revision.packageDigest === digest({ content: revision.content, correction })) {
      const linked = relink ? { ...correction, rootPackageDigest: root.to } : correction
      set.validation = { ...revision.validation, adminFormerAuthorCorrection: linked }
      set.packageDigest = digest({ content: content ?? revision.content, correction: linked })
      result.packageDigests += 1
      result.corrections += 1
    } else result.unverifiedDigests.push(String(revision._id))
    if (Object.keys(set).length) await write(revision, set)
  }
  return result
}

/**
 * Converts every story and story revision that still stores `categoryIds` or has no category.
 * Returns counts of what changed (or, without `apply`, what would change) and the stories left
 * unchanged because a category could not be resolved.
 */
export async function migrateStorySingleCategory({ apply = false } = {}) {
  const ids = new Map()
  for (const id of [
    ...(await Story.collection.distinct('_id', {
      $or: [{ categoryIds: { $exists: true } }, { categoryId: null }],
    })),
    ...(await ContentRevision.collection.distinct('storyId', {
      contentType: 'story',
      $or: [{ 'content.categoryIds': { $exists: true } }, { 'content.categoryId': null }],
    })),
  ])
    ids.set(String(id), id)
  const summary = { mode: apply ? 'apply' : 'dry-run', ...emptyResult() }
  for (const key of [...ids.keys()].sort()) {
    const result = apply
      ? await withTransaction(session => migrateStory(ids.get(key), session, true))
      : await migrateStory(ids.get(key), undefined, false)
    for (const [field, value] of Object.entries(result)) {
      if (Array.isArray(value)) summary[field].push(...value)
      else summary[field] += value
    }
  }
  return summary
}

/** Exit code of a run: unresolved stories make it fail, so they cannot pass unnoticed. */
export const migrationExitCode = summary => (summary.unresolvedStories.length ? 1 : 0)

const invokedDirectly = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } })
  loadDotenv()
  const env = loadEnv()
  await connectDatabase(env.MONGODB_URI, {
    serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
  })
  try {
    const summary = await migrateStorySingleCategory({ apply: values.apply })
    console.log(`Story category migration: ${JSON.stringify(summary)}`)
    process.exitCode = migrationExitCode(summary)
    if (process.exitCode)
      console.error(
        `${summary.unresolvedStories.length} stories were left unchanged because a category ` +
          'could not be resolved. Fix them and run the migration again.',
      )
  } finally {
    await disconnectDatabase()
  }
}
