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
/** Text progress stores a scroll fraction; audio progress stores playback seconds. */
export const PROGRESS_MODES = ['text', 'audio']
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

function positionView(progress, contentUpdated) {
  const position = contentUpdated ? 0 : (progress.position ?? 0)
  const duration = progress.duration ?? null
  const fraction =
    progress.mode === 'audio' ? (duration ? Math.min(1, position / duration) : null) : position
  return { mode: progress.mode, position, duration, fraction }
}

/** Resume points for saved progress rows (`null` rows stay `null`), in one batch. */
export async function resumeViews(account, rows) {
  const present = rows.filter(Boolean)
  const states = await chapterStates(account, present)
  const byRow = new Map(present.map((row, index) => [row, states[index]]))
  return rows.map(progress => {
    if (!progress) return null
    const state = byRow.get(progress)
    return {
      chapterId: String(progress.chapterId),
      orderKey: state.orderKey,
      title: state.title,
      ...positionView(progress, state.contentUpdated),
      contentUpdated: state.contentUpdated,
      available: state.available,
      lastReadAt: progress.lastReadAt ?? null,
    }
  })
}

/** Latest saved reading (`resume`) and listening (`listen`) points of a story. */
export async function resumePoints(account, storyId) {
  const latest = mode =>
    ReadingProgress.findOne({ accountId: account._id, storyId, mode })
      .sort({ lastReadAt: -1, _id: -1 })
      .lean()
  const [resume, listen] = await resumeViews(
    account,
    await Promise.all([latest('text'), latest('audio')]),
  )
  return { resume, listen }
}

export async function saveProgress(
  req,
  { storyId, chapterId, mode = 'text', position, duration, completed = false },
) {
  const { chapter } = await readableChapter({ storyId, chapterId, account: req.account })
  const now = new Date()
  const progress = await ownerWrite(req, session =>
    ReadingProgress.findOneAndUpdate(
      { accountId: req.account._id, storyId, chapterId, mode },
      {
        $set: {
          revisionId: chapter.publishedRevisionId,
          position,
          ...(mode === 'audio' && duration !== undefined ? { duration } : {}),
          contentUpdatedNotice: false,
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
    storyId: String(progress.storyId),
    chapterId: String(progress.chapterId),
    mode: progress.mode,
    position: progress.position,
    duration: progress.duration ?? null,
    completed: Boolean(progress.completedAt),
    lastReadAt: progress.lastReadAt,
  }
}

/**
 * Reading and listening history of currently visible stories: one entry per story (its
 * latest saved chapter, in either mode), newest first. The entry id is the story id.
 */
export async function readingHistory(account, page) {
  const storyIds = await ReadingProgress.distinct('storyId', {
    accountId: account._id,
    mode: { $in: PROGRESS_MODES },
  })
  const visible = await visibleStoryIds(storyIds.map(String))
  const [result] = await ReadingProgress.aggregate([
    {
      $match: {
        accountId: account._id,
        mode: { $in: PROGRESS_MODES },
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
  const [stories, states] = await Promise.all([
    publishedStorySummaries(result.rows.map(row => String(row.storyId))),
    chapterStates(account, result.rows),
  ])
  const items = result.rows
    .map((row, index) => ({ row, state: states[index], story: stories.get(String(row.storyId)) }))
    .filter(({ story }) => story)
    .map(({ row, state, story }) => ({
      id: story.id,
      story: { id: story.id, title: story.title, author: story.author },
      chapter: {
        id: String(row.chapterId),
        orderKey: state.orderKey,
        title: state.title,
        available: state.available,
      },
      ...positionView(row, state.contentUpdated),
      completed: Boolean(row.completedAt),
      contentUpdated: state.contentUpdated,
      lastReadAt: row.lastReadAt ?? null,
    }))
  return { items, total: result.total[0]?.count ?? 0, page, pageSize: HISTORY_PAGE_SIZE }
}

/** Deletes a story's history entry: every saved reading and listening position of that story. */
export async function deleteHistoryEntry(req, storyId) {
  const result = await ownerWrite(req, session =>
    ReadingProgress.deleteMany(
      { accountId: req.account._id, storyId, mode: { $in: PROGRESS_MODES } },
      { session },
    ),
  )
  if (!result.deletedCount) throw new HttpError(404, 'not_found', 'Không tìm thấy mục lịch sử đọc.')
}

export async function clearHistory(req) {
  await ownerWrite(req, session =>
    ReadingProgress.deleteMany(
      { accountId: req.account._id, mode: { $in: PROGRESS_MODES } },
      { session },
    ),
  )
}
