import { Chapter, UnlockEntitlement } from '../../../models/index.js'
import { readCookie, resolveSession } from '../../../auth/session.js'
import { HttpError } from '../../../middleware/errors.js'
import { queryPublishedStories } from '../catalog/catalog-query.js'

// Only the published revision is authoritative on public surfaces. Story.title may
// already contain an author's next draft and must not be used as a fallback.
export async function publishedCards(options) {
  return (await queryPublishedStories(options)).items
}

/** Public card of a published story whose Author is still visible, or null. */
export async function publishedStory(storyId) {
  return (await publishedCards({ ids: [storyId] }))[0] ?? null
}

/** Session account for routes that also serve Guests; null when signed out. */
export async function optionalAccount(req, { cookieName }) {
  const resolved = await resolveSession(readCookie(req.headers.cookie, cookieName))
  return resolved?.account ?? null
}

export const earlyAccessActive = (chapter, now = new Date()) =>
  Boolean(
    chapter.earlyAccess?.enabled &&
    (!chapter.earlyAccess.endsAt || chapter.earlyAccess.endsAt > now),
  )

/** Published chapter of a published story, without any access decision. */
export async function publishedChapter(storyId, chapterId) {
  const story = await publishedStory(storyId)
  const chapter =
    story &&
    (await Chapter.findOne({
      _id: chapterId,
      storyId,
      status: 'published',
      publishedRevisionId: { $ne: null },
    }).lean())
  if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương đã xuất bản.')
  return { story, chapter }
}

/**
 * Text access: Guests read only chapter 1 once it is free; every other chapter
 * needs a login, and early access needs an active entitlement for the chapter.
 */
export async function readableChapter({ storyId, chapterId, account }) {
  const { story, chapter } = await publishedChapter(storyId, chapterId)
  if (chapter.orderKey !== 1 && !account)
    throw new HttpError(401, 'authentication_required', 'Đăng nhập để đọc các chương tiếp theo.')
  if (chapter.earlyAccess?.enabled) {
    if (!chapter.earlyAccess.endsAt)
      throw new HttpError(403, 'chapter_locked', 'Chương chưa mở để đọc.')
    if (earlyAccessActive(chapter)) {
      const entitlement =
        account &&
        (await UnlockEntitlement.exists({
          accountId: account._id,
          chapterId: chapter._id,
          status: 'active',
          expiresAt: { $gt: new Date() },
        }))
      if (!entitlement)
        throw new HttpError(403, 'chapter_locked', 'Chương đang trong thời gian đọc sớm.')
    }
  }
  return { story, chapter }
}
