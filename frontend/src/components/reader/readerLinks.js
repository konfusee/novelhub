import { ROUTES } from '../../app/routes'

/* Where "continue reading" goes: the saved chapter (flagging updated content) or the story page. */
export const resumeHref = (storyId, resume) =>
  resume?.available
    ? `${ROUTES.read(storyId, resume.chapterId)}${resume.contentUpdated ? '?updated=1' : ''}`
    : ROUTES.story(storyId)

/* Where "continue listening" goes: the saved audio chapter, or nothing when it is unavailable. */
export const listenHref = (storyId, listenResume) =>
  listenResume?.available ? ROUTES.listen(storyId, listenResume.chapterId) : null

/* Share of the story's published chapters the reader has finished. */
export const storyPercent = item =>
  item.totalChapters ? Math.min(100, Math.round((item.chaptersRead / item.totalChapters) * 100)) : 0

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
export const formatWhen = value => (value ? dateTime.format(new Date(value)) : '')
