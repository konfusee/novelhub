import { HttpError } from '../../../middleware/errors.js'
import { Chapter } from '../../../models/index.js'
import { publishedChapter, publishedStory } from '../reading/access.js'

/** Public/community display name: deleted (anonymized) accounts are never shown by name. */
export const publicName = account =>
  !account || account.status === 'anonymized' ? 'Deleted user' : account.displayName

export async function requirePublishedStory(storyId) {
  const story = await publishedStory(storyId)
  if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện đã xuất bản.')
  return story
}

/** Published chapter by id alone (comment and report targets carry no story id). */
export async function publishedChapterById(chapterId) {
  const chapter = await Chapter.findById(chapterId).select('storyId').lean()
  if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương đã xuất bản.')
  return publishedChapter(String(chapter.storyId), chapterId)
}
