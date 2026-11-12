import { Chapter, UnlockEntitlement } from '../../../models/index.js'
import { readCookie, resolveSession } from '../../../auth/session.js'
import { HttpError } from '../../../middleware/errors.js'
import { publishedStorySummary, queryPublishedStories } from '../catalog/catalog-query.js'

// Only the published revision is authoritative on public surfaces. Story.title may
// already contain an author's next draft and must not be used as a fallback.
export async function publishedCards(options) {
  return (await queryPublishedStories(options)).items
}

/**
 * Published story whose Author is still visible (`id`, `title`, `description`, `author`,
 * `authorId`), or null. Access checks use this light lookup, not the catalogue metrics.
 */
export async function publishedStory(storyId) {
  return publishedStorySummary(storyId)
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
 * Text access rule for a published chapter: Guests read only chapter 1 once it is free;
 * every other chapter needs a login, and early access needs an active entitlement for the
 * chapter (`owned`). Returns the HttpError to throw, or null when the chapter is readable.
 */
export function chapterDenial(chapter, { signedIn, owned }, now = new Date()) {
  if (chapter.orderKey !== 1 && !signedIn)
    return new HttpError(401, 'authentication_required', 'Đăng nhập để đọc các chương tiếp theo.')
  if (chapter.earlyAccess?.enabled) {
    if (!chapter.earlyAccess.endsAt)
      return new HttpError(403, 'chapter_locked', 'Chương chưa mở để đọc.')
    if (earlyAccessActive(chapter, now) && !owned)
      return new HttpError(403, 'chapter_locked', 'Chương đang trong thời gian đọc sớm.')
  }
  return null
}

/** Published chapter the account may read (see `chapterDenial`), or the matching error. */
export async function readableChapter({ storyId, chapterId, account }) {
  const { story, chapter } = await publishedChapter(storyId, chapterId)
  const owned =
    Boolean(account) &&
    earlyAccessActive(chapter) &&
    Boolean(
      await UnlockEntitlement.exists({
        accountId: account._id,
        chapterId: chapter._id,
        status: 'active',
        expiresAt: { $gt: new Date() },
      }),
    )
  const denial = chapterDenial(chapter, { signedIn: Boolean(account), owned })
  if (denial) throw denial
  return { story, chapter }
}
