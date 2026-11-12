import { Chapter, ContentRevision, UnlockEntitlement } from '../../../models/index.js'
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

/**
 * Viewer-aware lock state: an early-access chapter this account already unlocked for its
 * live revision is returned as `locked: false, unlocked: true` (same rule as text access).
 */
export async function withViewerUnlocks(rows, account, now = new Date()) {
  const locked = rows.filter(row => row.locked)
  if (!account || !locked.length) return rows
  const owned = await UnlockEntitlement.find({
    accountId: account._id,
    chapterId: { $in: locked.map(row => row.id) },
    status: 'active',
    expiresAt: { $gt: now },
  })
    .select('chapterId publishedRevisionId')
    .lean()
  const keys = new Set(owned.map(item => `${item.chapterId}:${item.publishedRevisionId}`))
  return rows.map(row =>
    row.locked && keys.has(`${row.id}:${row.publishedRevisionId}`)
      ? { ...row, locked: false, unlocked: true }
      : row,
  )
}

/** Public chapter list entry (without internal revision binding). */
export const chapterListItem = ({ publishedRevisionId: _revision, ...row }) => row
