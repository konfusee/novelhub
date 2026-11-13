import mongoose from 'mongoose'
import {
  Chapter,
  ContentRevision,
  ReadingProgress,
  UnlockEntitlement,
} from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { publishedStorySummaries, visibleStoryIds } from '../catalog/catalog-query.js'
import { chapterDenial, earlyAccessActive, readableChapter } from './access.js'
import { ownerWrite } from './owner-write.js'

export const HISTORY_PAGE_SIZE = 20
const sameId = (left, right) => Boolean(left && right && String(left) === String(right))
const unique = values => [...new Set(values.map(String))]

/**
 * Current state of saved chapters for this reader (live title, revision and readability),
 * resolved with one query per collection for the whole batch. Readability follows the
 * same rule as `readableChapter`.
 */
async function chapterStates(account, rows) {
  if (!rows.length) return []
  const now = new Date()
  const chapterIds = unique(rows.map(row => row.chapterId))
  const [visible, chapters, entitlements] = await Promise.all([
    visibleStoryIds(unique(rows.map(row => row.storyId))),
    Chapter.find({ _id: { $in: chapterIds } })
      .select('storyId status orderKey title publishedRevisionId earlyAccess')
      .lean(),
    UnlockEntitlement.find({
      accountId: account._id,
      chapterId: { $in: chapterIds },
      status: 'active',
      expiresAt: { $gt: now },
    })
      .select('chapterId')
      .lean(),
  ])
  const revisions = await ContentRevision.find({
    _id: { $in: chapters.map(chapter => chapter.publishedRevisionId).filter(Boolean) },
    contentType: 'chapter',
    status: { $in: ['approved', 'immutable'] },
  })
    .select('chapterId content.title')
    .lean()
  const byChapter = new Map(chapters.map(chapter => [String(chapter._id), chapter]))
  const titles = new Map(
    revisions.map(revision => [`${revision._id}:${revision.chapterId}`, revision.content?.title]),
  )
  const owned = new Set(entitlements.map(item => String(item.chapterId)))
  return rows.map(row => {
    const chapter = byChapter.get(String(row.chapterId))
    const published = Boolean(
      chapter?.status === 'published' &&
      chapter.publishedRevisionId &&
      sameId(chapter.storyId, row.storyId) &&
      visible.has(String(row.storyId)),
    )
    const available =
      published &&
      !chapterDenial(
        chapter,
        {
          signedIn: true,
          owned: earlyAccessActive(chapter, now) && owned.has(String(chapter._id)),
        },
        now,
      )
    return {
      available,
      orderKey: chapter?.orderKey ?? null,
      title: titles.get(`${chapter?.publishedRevisionId}:${row.chapterId}`) ?? chapter?.title ?? '',
      // A newer published revision restarts the same chapter from the beginning.
      contentUpdated: Boolean(
        chapter?.publishedRevisionId &&
        row.revisionId &&
        !sameId(chapter.publishedRevisionId, row.revisionId),
      ),
    }
  })
}

/** Share of the chapter done, 0–100: the paragraph reached out of all paragraphs. */
const chapterPercent = row =>
  row.completedAt
    ? 100
    : row.paragraphCount
      ? Math.round(((row.paragraph ?? 0) / row.paragraphCount) * 100)
      : 0

/** A saved chapter as the reader and the player need it to continue. */
function progressView(row, state) {
  return {
    chapterId: String(row.chapterId),
    orderKey: state.orderKey,
    title: state.title,
    mode: row.mode,
    // An edited chapter starts again from the top.
    paragraph: state.contentUpdated ? 0 : (row.paragraph ?? 0),
    audioSeconds: state.contentUpdated ? null : (row.audioSeconds ?? null),
    duration: row.duration ?? null,
    percent: chapterPercent(row),
    completed: Boolean(row.completedAt),
    contentUpdated: state.contentUpdated,
    available: state.available,
    lastReadAt: row.lastReadAt ?? null,
  }
}

/** Views of saved progress rows (`null` rows stay `null`), resolved in one batch. */
export async function resumeViews(account, rows) {
  const present = rows.filter(Boolean)
  const states = await chapterStates(account, present)
  const byRow = new Map(present.map((row, index) => [row, states[index]]))
  return rows.map(row => (row ? progressView(row, byRow.get(row)) : null))
}

/** "Continue": the chapter of this story the Reader read or listened to last. */
export async function resumePoint(account, storyId) {
  const row = await ReadingProgress.findOne({ accountId: account._id, storyId })
    .sort({ lastReadAt: -1, _id: -1 })
    .lean()
  const [resume] = await resumeViews(account, [row])
  return resume
}

/**
 * Saves where the Reader is in a chapter: reading sends the paragraph, listening also
 * sends the playback second. One row per chapter, whichever way it was followed.
 */
export async function saveProgress(
  req,
  { storyId, chapterId, paragraph, paragraphCount, completed = false, audioSeconds, duration },
) {
  const { chapter } = await readableChapter({ storyId, chapterId, account: req.account })
  const listening = audioSeconds !== undefined
  const now = new Date()
  const row = await ownerWrite(req, session =>
    ReadingProgress.findOneAndUpdate(
      { accountId: req.account._id, storyId, chapterId },
      {
        $set: {
          revisionId: chapter.publishedRevisionId,
          mode: listening ? 'audio' : 'text',
          paragraph,
          paragraphCount,
          position: completed ? 1 : paragraph / paragraphCount,
          // Reading moves the point on, so the old playback second no longer matches it.
          audioSeconds: listening ? audioSeconds : null,
          ...(listening && duration !== undefined ? { duration } : {}),
          lastReadAt: now,
        },
        $inc: { version: 1 },
        // Completion is recorded once and never cleared by later scrolling or seeking.
        ...(completed ? { $min: { completedAt: now } } : {}),
      },
      { upsert: true, session, returnDocument: 'after', lean: true },
    ),
  )
  return {
    storyId: String(row.storyId),
    chapterId: String(row.chapterId),
    mode: row.mode,
    paragraph: row.paragraph,
    paragraphCount: row.paragraphCount,
    audioSeconds: row.audioSeconds,
    duration: row.duration ?? null,
    completed: Boolean(row.completedAt),
    lastReadAt: row.lastReadAt,
  }
}

/**
 * Reading and listening history of currently visible stories: one entry per story (its
 * latest saved chapter), newest first. The entry id is the story id.
 */
export async function readingHistory(account, page) {
  const storyIds = await ReadingProgress.distinct('storyId', { accountId: account._id })
  const visible = await visibleStoryIds(storyIds.map(String))
  const [result] = await ReadingProgress.aggregate([
    {
      $match: {
        accountId: account._id,
        storyId: { $in: [...visible].map(id => new mongoose.Types.ObjectId(id)) },
      },
    },
    { $sort: { lastReadAt: -1, _id: -1 } },
    { $group: { _id: '$storyId', row: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$row' } },
    { $sort: { lastReadAt: -1, _id: -1 } },
    {
      $facet: {
        total: [{ $count: 'count' }],
        rows: [{ $skip: (page - 1) * HISTORY_PAGE_SIZE }, { $limit: HISTORY_PAGE_SIZE }],
      },
    },
  ])
  const [stories, views] = await Promise.all([
    publishedStorySummaries(result.rows.map(row => String(row.storyId))),
    resumeViews(account, result.rows),
  ])
  const items = result.rows
    .map((row, index) => ({ view: views[index], story: stories.get(String(row.storyId)) }))
    .filter(({ story }) => story)
    .map(({ view: { chapterId, orderKey, title, available, ...view }, story }) => ({
      id: story.id,
      story: { id: story.id, title: story.title, author: story.author },
      chapter: { id: chapterId, orderKey, title, available },
      ...view,
    }))
  return { items, total: result.total[0]?.count ?? 0, page, pageSize: HISTORY_PAGE_SIZE }
}

/** Deletes a story's history entry: every saved chapter of that story. */
export async function deleteHistoryEntry(req, storyId) {
  const result = await ownerWrite(req, session =>
    ReadingProgress.deleteMany({ accountId: req.account._id, storyId }, { session }),
  )
  if (!result.deletedCount) throw new HttpError(404, 'not_found', 'Không tìm thấy mục lịch sử đọc.')
}

export async function clearHistory(req) {
  await ownerWrite(req, session =>
    ReadingProgress.deleteMany({ accountId: req.account._id }, { session }),
  )
}
