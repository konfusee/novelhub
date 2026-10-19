import { AuditEvent, Chapter, ContentRevision } from '../models/index.js'
import { withTransaction } from '../db/connection.js'
import { HttpError } from '../middleware/errors.js'
import { lockAuthor, ownStory } from './author-ownership.js'
import { draftLifecycle, isPrivateDraftChapter } from './author-story-lifecycle.js'
import { digest } from './submission-digests.js'

export function chapterCanUnpublish(chapter, story) {
  return Boolean(
    !story.authoringFrozen &&
    ['published', 'unpublished'].includes(story.publicationStatus) &&
    chapter.status === 'published' &&
    chapter.publishedRevisionId,
  )
}

export function chapterDraftLifecycle(chapter, revision, story, lifecycle) {
  const safe =
    chapter.publicationTransition?.result !== 'author-draft-deleted' &&
    lifecycle.canArchive &&
    isPrivateDraftChapter(chapter, story.authorAccountId) &&
    revision &&
    String(revision._id) === String(chapter.draftRevisionId ?? chapter.currentRevisionId) &&
    String(revision.chapterId) === String(chapter._id) &&
    String(revision.storyId) === String(story._id) &&
    String(revision.authorAccountId) === String(story.authorAccountId) &&
    revision.contentType === 'chapter' &&
    revision.status === 'editable' &&
    !revision.immutableAt
  return {
    canArchive: Boolean(safe && chapter.status === 'draft'),
    canRestore: Boolean(safe && chapter.status === 'archived'),
    canDelete: Boolean(safe && chapter.status === 'draft'),
  }
}

export async function changeChapterDraftLifecycle(account, storyId, chapterId, input) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const story = await ownStory(account, storyId, session)
    const chapter = await Chapter.findOne({ _id: chapterId, storyId: story._id }).session(session)
    if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.')
    if (chapter.version !== input.expectedVersion || story.version !== input.expectedStoryVersion)
      throw new HttpError(409, 'stale_content', 'Truyện hoặc chương đã thay đổi. Hãy tải lại.')
    const revision = await ContentRevision.findOne({
      _id: chapter.draftRevisionId ?? chapter.currentRevisionId,
      chapterId: chapter._id,
      storyId: story._id,
      authorAccountId: account._id,
      contentType: 'chapter',
    }).session(session)
    const flags =
      input.action === 'unpublish'
        ? { canUnpublish: chapterCanUnpublish(chapter, story) }
        : chapterDraftLifecycle(chapter, revision, story, await draftLifecycle(story, session))
    const allowed = {
      archive: flags.canArchive,
      restore: flags.canRestore,
      delete: flags.canDelete,
      unpublish: flags.canUnpublish,
    }
    if (!allowed[input.action])
      throw new HttpError(
        409,
        'chapter_lifecycle_not_allowed',
        'Chương chưa đủ điều kiện cho thao tác này hoặc truyện đang bị khóa. Hãy tải lại trạng thái.',
      )
    const now = new Date()
    const before = chapter.status
    if (input.action === 'delete') {
      const first = await Chapter.findOne({ storyId: story._id })
        .sort({ orderKey: 1 })
        .session(session)
      chapter.orderKey = Math.min(0, first?.orderKey ?? 0) - 1
    }
    chapter.status =
      input.action === 'unpublish'
        ? 'unpublished'
        : input.action === 'restore'
          ? 'draft'
          : 'archived'
    chapter.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from: before,
      to: chapter.status,
      result: {
        archive: 'author-draft-archived',
        restore: 'author-draft-restored',
        delete: 'author-draft-deleted',
        unpublish: 'author-chapter-unpublished',
      }[input.action],
    }
    await chapter.save({ session })
    story.increment()
    await story.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: {
            archive: 'chapter.draft-archived',
            restore: 'chapter.draft-restored',
            delete: 'chapter.draft-deleted',
            unpublish: 'chapter.unpublished',
          }[input.action],
          targetType: 'Chapter',
          targetId: chapter._id,
          targetVersion: chapter.version,
          result: 'accepted',
          occurredAt: now,
          ...(input.action === 'unpublish'
            ? {
                dataDigest: digest({
                  publishedRevisionId: String(chapter.publishedRevisionId),
                  from: before,
                  to: chapter.status,
                }),
              }
            : {}),
        },
      ],
      { session },
    )
    return {
      chapter: { id: String(chapter._id), status: chapter.status, version: chapter.version },
      story: { id: String(story._id), version: story.version },
    }
  })
}
