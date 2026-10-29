import { Chapter, ContentRevision, ReadingProgress } from '../../models/index.js'
import { HttpError } from '../../middleware/errors.js'
import { publishedCards, readableChapter } from './access.js'
import { ownerWrite } from './owner-write.js'

export const HISTORY_PAGE_SIZE = 20
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

/** Resume point for one saved progress row. */
export async function resumeView(account, progress) {
  const state = await chapterState(account, progress)
  return {
    chapterId: String(progress.chapterId),
    orderKey: state.orderKey,
    title: state.title,
    position: state.contentUpdated ? 0 : (progress.position ?? 0),
    contentUpdated: state.contentUpdated,
    available: state.available,
    lastReadAt: progress.lastReadAt ?? null,
  }
}

/** Most recently read text chapter of a story, or null. */
export async function resumeFor(account, storyId) {
  const progress = await ReadingProgress.findOne({
    accountId: account._id,
    storyId,
    mode: 'text',
  })
    .sort({ lastReadAt: -1, _id: -1 })
    .lean()
  return progress ? resumeView(account, progress) : null
}

export async function saveProgress(req, { storyId, chapterId, position, completed = false }) {
  const { chapter } = await readableChapter({ storyId, chapterId, account: req.account })
  const now = new Date()
  const progress = await ownerWrite(req, session =>
    ReadingProgress.findOneAndUpdate(
      { accountId: req.account._id, storyId, chapterId, mode: 'text' },
      {
        $set: {
          revisionId: chapter.publishedRevisionId,
          position,
          contentUpdatedNotice: false,
          lastReadAt: now,
        },
        $inc: { version: 1 },
        // Completion is recorded once and never cleared by later scrolling.
        ...(completed ? { $min: { completedAt: now } } : {}),
      },
      { upsert: true, session, returnDocument: 'after', lean: true },
    ),
  )
  return {
    storyId: String(progress.storyId),
    chapterId: String(progress.chapterId),
    position: progress.position,
    completed: Boolean(progress.completedAt),
    lastReadAt: progress.lastReadAt,
  }
}

/** Text reading history of currently visible stories, newest first. */
export async function readingHistory(account, page) {
  const storyIds = await ReadingProgress.distinct('storyId', {
    accountId: account._id,
    mode: 'text',
  })
  const cards = storyIds.length
    ? await publishedCards({ ids: storyIds.map(String), pageSize: storyIds.length })
    : []
  const stories = new Map(cards.map(card => [card.id, card]))
  const filter = { accountId: account._id, mode: 'text', storyId: { $in: [...stories.keys()] } }
  const [total, rows] = await Promise.all([
    ReadingProgress.countDocuments(filter),
    ReadingProgress.find(filter)
      .sort({ lastReadAt: -1, _id: -1 })
      .skip((page - 1) * HISTORY_PAGE_SIZE)
      .limit(HISTORY_PAGE_SIZE)
      .lean(),
  ])
  const items = await Promise.all(
    rows.map(async row => {
      const story = stories.get(String(row.storyId))
      const state = await chapterState(account, row)
      return {
        id: String(row._id),
        story: { id: story.id, title: story.title, author: story.author },
        chapter: {
          id: String(row.chapterId),
          orderKey: state.orderKey,
          title: state.title,
          available: state.available,
        },
        position: state.contentUpdated ? 0 : (row.position ?? 0),
        completed: Boolean(row.completedAt),
        contentUpdated: state.contentUpdated,
        lastReadAt: row.lastReadAt ?? null,
      }
    }),
  )
  return { items, total, page, pageSize: HISTORY_PAGE_SIZE }
}

export async function deleteHistoryEntry(req, id) {
  const result = await ownerWrite(req, session =>
    ReadingProgress.deleteOne({ _id: id, accountId: req.account._id, mode: 'text' }, { session }),
  )
  if (result.deletedCount !== 1)
    throw new HttpError(404, 'not_found', 'Không tìm thấy mục lịch sử đọc.')
}

export async function clearHistory(req) {
  await ownerWrite(req, session =>
    ReadingProgress.deleteMany({ accountId: req.account._id, mode: 'text' }, { session }),
  )
}
