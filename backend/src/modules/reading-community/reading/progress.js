import mongoose from 'mongoose'
import { Chapter, ContentRevision, ReadingProgress } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { publishedCards, readableChapter } from './access.js'
import { ownerWrite } from './owner-write.js'

export const HISTORY_PAGE_SIZE = 20
/** Text progress stores a scroll fraction; audio progress stores playback seconds. */
export const PROGRESS_MODES = ['text', 'audio']
const sameId = (left, right) => Boolean(left && right && String(left) === String(right))

/** Current state of a saved chapter for this reader: live title, revision and readability. */
async function chapterState(account, progress) {
  let chapter
  let available = true
  try {
    ;({ chapter } = await readableChapter({
      storyId: progress.storyId,
      chapterId: progress.chapterId,
      account,
    }))
  } catch (error) {
    if (!(error instanceof HttpError)) throw error
    available = false
    chapter = await Chapter.findById(progress.chapterId)
      .select('orderKey title publishedRevisionId')
      .lean()
  }
  const revision =
    chapter?.publishedRevisionId &&
    (await ContentRevision.findOne({
      _id: chapter.publishedRevisionId,
      chapterId: progress.chapterId,
      contentType: 'chapter',
      status: { $in: ['approved', 'immutable'] },
    })
      .select('content.title')
      .lean())
  return {
    available,
    orderKey: chapter?.orderKey ?? null,
    title: revision?.content?.title ?? chapter?.title ?? '',
    // A newer published revision restarts the same chapter from the beginning.
    contentUpdated: Boolean(
      chapter?.publishedRevisionId &&
      progress.revisionId &&
      !sameId(chapter.publishedRevisionId, progress.revisionId),
    ),
  }
}

function positionView(progress, contentUpdated) {
  const position = contentUpdated ? 0 : (progress.position ?? 0)
  const duration = progress.duration ?? null
  const fraction =
    progress.mode === 'audio' ? (duration ? Math.min(1, position / duration) : null) : position
  return { mode: progress.mode, position, duration, fraction }
}

/** Resume point for one saved progress row. */
export async function resumeView(account, progress) {
  const state = await chapterState(account, progress)
  return {
    chapterId: String(progress.chapterId),
    orderKey: state.orderKey,
    title: state.title,
    ...positionView(progress, state.contentUpdated),
    contentUpdated: state.contentUpdated,
    available: state.available,
    lastReadAt: progress.lastReadAt ?? null,
  }
}

/** Most recently read (text) or listened (audio) chapter of a story, or null. */
export async function resumeFor(account, storyId, mode = 'text') {
  const progress = await ReadingProgress.findOne({
    accountId: account._id,
    storyId,
    mode,
  })
    .sort({ lastReadAt: -1, _id: -1 })
    .lean()
  return progress ? resumeView(account, progress) : null
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
  const cards = storyIds.length
    ? await publishedCards({ ids: storyIds.map(String), pageSize: storyIds.length })
    : []
  const stories = new Map(cards.map(card => [card.id, card]))
  const [result] = await ReadingProgress.aggregate([
    {
      $match: {
        accountId: account._id,
        mode: { $in: PROGRESS_MODES },
        storyId: { $in: [...stories.keys()].map(id => new mongoose.Types.ObjectId(id)) },
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
  const items = await Promise.all(
    result.rows.map(async row => {
      const story = stories.get(String(row.storyId))
      const state = await chapterState(account, row)
      return {
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
      }
    }),
  )
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
