import { AuditEvent, Chapter, ContentRevision, PublicationSubmission } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { lockAuthor, ownStory } from './author-ownership.js'
import { draftLifecycle, isPrivateDraftChapter } from './author-story-lifecycle.js'
import { digest } from '../submissions/submission-digests.js'

const OPEN_SUBMISSION_STATUSES = ['validated', 'pending-review', 'decision-pending']

export function chapterCanUnpublish(chapter, story) {
  return Boolean(
    !story.authoringFrozen &&
    ['published', 'unpublished'].includes(story.publicationStatus) &&
    chapter.status === 'published' &&
    chapter.publishedRevisionId,
  )
}

/**
 * A chapter that has never been released can be removed even when its parent
 * story is already public. Archive/restore uses the stricter private-draft
 * lifecycle; deletion only needs an editable, owned chapter with no open
 * review package.
 */
export function chapterCanDelete(chapter, revision, story, hasOpenSubmission = false) {
  return Boolean(
    !hasOpenSubmission &&
      !story.authoringFrozen &&
      story.publicationStatus !== 'archived' &&
      !chapter.firstReleasedAt &&
      !chapter.publishedAt &&
      !chapter.publishedRevisionId &&
      !chapter.cancelledAt &&
      chapter.status !== 'archived' &&
      ['draft', 'approved', 'scheduled', 'due'].includes(chapter.status) &&
      revision &&
      String(revision._id) === String(chapter.draftRevisionId ?? chapter.currentRevisionId) &&
      String(revision.chapterId) === String(chapter._id) &&
      String(revision.storyId) === String(story._id) &&
      String(revision.authorAccountId) === String(story.authorAccountId) &&
      revision.contentType === 'chapter' &&
      ((revision.status === 'editable' && !revision.immutableAt) ||
        (['approved', 'immutable'].includes(revision.status) && revision.immutableAt)),
  )
}

export function chapterDraftLifecycle(
  chapter,
  revision,
  story,
  lifecycle,
  hasOpenSubmission = false,
) {
  const contentSafe =
    chapter.publicationTransition?.result !== 'author-draft-deleted' &&
    !story.authoringFrozen &&
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
    canArchive: Boolean(contentSafe && lifecycle.canArchive && chapter.status === 'draft'),
    canRestore: Boolean(contentSafe && lifecycle.canRestore && chapter.status === 'archived'),
    canDelete: Boolean(
      contentSafe &&
        story.publicationStatus !== 'archived' &&
        chapter.status === 'draft' &&
        !hasOpenSubmission,
    ),
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
    const hasOpenSubmission = await PublicationSubmission.exists({
      storyId: story._id,
      chapterId: chapter._id,
      status: { $in: OPEN_SUBMISSION_STATUSES },
    }).session(session)
    const flags =
      input.action === 'unpublish'
        ? { canUnpublish: chapterCanUnpublish(chapter, story) }
        : {
            ...chapterDraftLifecycle(
              chapter,
              revision,
              story,
              await draftLifecycle(story, session),
              Boolean(hasOpenSubmission),
            ),
            canDelete: chapterCanDelete(chapter, revision, story, Boolean(hasOpenSubmission)),
          }
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
    const deletedOrderKey = input.action === 'delete' ? chapter.orderKey : null
    if (input.action === 'delete') {
      const occupiedOrderKeys = new Set(
        (
          await Chapter.find({ storyId: story._id }).select('orderKey').session(session).lean()
        ).map(item => item.orderKey),
      )
      let deletedKey = -1
      while (occupiedOrderKeys.has(deletedKey)) deletedKey -= 1
      chapter.orderKey = deletedKey
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
    if (input.action === 'delete') {
      const following = await Chapter.find({
        storyId: story._id,
        status: { $in: ['draft', 'approved', 'scheduled', 'due'] },
        orderKey: { $gt: deletedOrderKey },
        firstReleasedAt: null,
        publishedAt: null,
        publishedRevisionId: null,
        cancelledAt: null,
        'publicationTransition.result': { $ne: 'author-draft-deleted' },
      })
        .sort({ orderKey: 1, _id: 1 })
        .session(session)
      if (following.length) {
        const highest = await Chapter.findOne({ storyId: story._id })
          .sort({ orderKey: -1 })
          .select('orderKey')
          .session(session)
          .lean()
        const temporary = Math.max(highest?.orderKey ?? 0, ...following.map(item => item.orderKey)) + 1
        const staged = await Chapter.bulkWrite(
          following.map((item, index) => ({
            updateOne: {
              filter: { _id: item._id, version: item.version },
              update: { $set: { orderKey: temporary + index }, $inc: { version: 1 } },
            },
          })),
          { session, ordered: true },
        )
        if (staged.matchedCount !== following.length)
          throw new HttpError(409, 'stale_chapters', 'Danh sách chương đã thay đổi. Hãy tải lại.')
        const renumbered = await Chapter.bulkWrite(
          following.map(item => ({
            updateOne: {
              filter: { _id: item._id, version: item.version + 1 },
              update: { $set: { orderKey: item.orderKey - 1 }, $inc: { version: 1 } },
            },
          })),
          { session, ordered: true },
        )
        if (renumbered.matchedCount !== following.length)
          throw new HttpError(409, 'stale_chapters', 'Danh sách chương đã thay đổi. Hãy tải lại.')
      }
    }
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
