import { Follow, ReadingProgress } from '../../models/index.js'
import { publishedCards } from './access.js'
import { publishedChapterRows } from './chapters.js'
import { resumeView } from './progress.js'

export const LIBRARY_PAGE_SIZE = 20
export const LIBRARY_TABS = ['all', 'reading', 'following', 'completed']
const latest = dates =>
  dates.reduce((max, date) => (date && (!max || date > max) ? date : max), null)

/**
 * Reader library: actively followed stories plus stories with text progress, limited to
 * currently published, visible stories and ordered by latest activity.
 */
export async function readerLibrary(account, { tab, page }) {
  const [follows, progress] = await Promise.all([
    Follow.find({ accountId: account._id, status: 'active' })
      .select('storyId createdAt updatedAt')
      .lean(),
    ReadingProgress.find({ accountId: account._id, mode: 'text' }).lean(),
  ])
  const ids = [...new Set([...follows, ...progress].map(row => String(row.storyId)))]
  const cards = ids.length ? await publishedCards({ ids, pageSize: ids.length }) : []
  const chapters = await publishedChapterRows(cards.map(card => card.id))
  const followedAt = new Map(
    follows.map(row => [String(row.storyId), row.updatedAt ?? row.createdAt ?? null]),
  )
  const progressByStory = Map.groupBy(progress, row => String(row.storyId))
  const entries = cards.map(story => {
    const rows = progressByStory.get(story.id) ?? []
    const published = chapters.get(story.id) ?? []
    const publishedIds = new Set(published.map(chapter => chapter.id))
    const read = rows.filter(row => publishedIds.has(String(row.chapterId)))
    const completedIds = new Set(
      read.filter(row => row.completedAt).map(row => String(row.chapterId)),
    )
    const lastReadAt = latest(rows.map(row => row.lastReadAt))
    const following = followedAt.has(story.id)
    const since = lastReadAt ?? followedAt.get(story.id)
    const completed =
      published.length > 0 && published.every(chapter => completedIds.has(chapter.id))
    return {
      story,
      following,
      latestProgress: rows.reduce(
        (best, row) => (!best || (row.lastReadAt ?? 0) > (best.lastReadAt ?? 0) ? row : best),
        null,
      ),
      chaptersRead: new Set(read.map(row => String(row.chapterId))).size,
      totalChapters: published.length,
      completed,
      reading: rows.length > 0 && !completed,
      newChapters: since
        ? published.filter(chapter => chapter.publishedAt && chapter.publishedAt > since).length
        : 0,
      lastActivityAt: latest([lastReadAt, followedAt.get(story.id)]),
    }
  })
  const inTab = {
    all: () => true,
    reading: entry => entry.reading,
    following: entry => entry.following,
    completed: entry => entry.completed,
  }
  const counts = Object.fromEntries(
    LIBRARY_TABS.map(name => [name, entries.filter(inTab[name]).length]),
  )
  const selected = entries
    .filter(inTab[tab])
    .sort(
      (left, right) =>
        (right.lastActivityAt?.getTime() ?? 0) - (left.lastActivityAt?.getTime() ?? 0) ||
        right.story.id.localeCompare(left.story.id),
    )
  const items = await Promise.all(
    selected
      .slice((page - 1) * LIBRARY_PAGE_SIZE, page * LIBRARY_PAGE_SIZE)
      .map(async ({ latestProgress, reading: _reading, ...entry }) => ({
        ...entry,
        resume: latestProgress ? await resumeView(account, latestProgress) : null,
      })),
  )
  return { items, total: selected.length, page, pageSize: LIBRARY_PAGE_SIZE, counts }
}
