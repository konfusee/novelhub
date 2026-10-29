import { Chapter, ContentRevision } from '../../models/index.js'
import { earlyAccessActive } from './access.js'

/**
 * Published chapters (title from the live published revision only) grouped by story,
 * ordered by `orderKey`. Chapters whose published revision is missing are omitted.
 */
export async function publishedChapterRows(storyIds, now = new Date()) {
  const chapters = await Chapter.find({
    storyId: { $in: storyIds },
    status: 'published',
    publishedRevisionId: { $ne: null },
  })
    .sort({ storyId: 1, orderKey: 1 })
    .select('storyId publishedRevisionId earlyAccess orderKey publishedAt')
    .lean()
  const revisions = await ContentRevision.find({
    _id: { $in: chapters.map(chapter => chapter.publishedRevisionId) },
    contentType: 'chapter',
    status: { $in: ['approved', 'immutable'] },
  })
    .select('chapterId storyId content.title')
    .lean()
  const byId = new Map(revisions.map(revision => [String(revision._id), revision]))
  const rows = new Map(storyIds.map(id => [String(id), []]))
  for (const chapter of chapters) {
    const revision = byId.get(String(chapter.publishedRevisionId))
    if (
      !revision ||
      String(revision.chapterId) !== String(chapter._id) ||
      String(revision.storyId) !== String(chapter.storyId)
    )
      continue
    const locked = earlyAccessActive(chapter, now)
    rows.get(String(chapter.storyId))?.push({
      id: String(chapter._id),
      title: revision.content?.title ?? '',
      orderKey: chapter.orderKey,
      locked,
      publishedAt: chapter.publishedAt ?? null,
      earlyAccess: locked
        ? {
            coinPrice: chapter.earlyAccess.coinPrice ?? null,
            endsAt: chapter.earlyAccess.endsAt ?? null,
          }
        : null,
      publishedRevisionId: String(chapter.publishedRevisionId),
    })
  }
  return rows
}

/** Public chapter list entry (without internal revision binding). */
export const chapterListItem = ({ publishedRevisionId: _revision, ...row }) => row
