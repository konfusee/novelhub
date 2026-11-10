import {
  AuditEvent,
  Chapter,
  ContentRevision,
  PublicationSubmission,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { lockAuthor, ownStory } from './author-ownership.js'

export function isPrivateDraftChapter(chapter, authorId) {
  return (
    !chapter.firstReleasedAt &&
    !chapter.publishedAt &&
    !chapter.publishedRevisionId &&
    !chapter.requestedReleaseAt &&
    !chapter.cancelledAt &&
    (chapter.status === 'draft' ||
      (chapter.status === 'archived' &&
        ['author-draft-archived', 'author-draft-deleted'].includes(
          chapter.publicationTransition?.result,
        ) &&
        String(chapter.publicationTransition?.actorAccountId) === String(authorId)))
  )
}

export async function draftLifecycle(story, session) {
  const queries = [
    Chapter.find({ storyId: story._id })
      .select(
        'status firstReleasedAt publishedAt publishedRevisionId requestedReleaseAt cancelledAt publicationTransition',
      )
      .session(session ?? null)
      .lean(),
    PublicationSubmission.exists({
      storyId: story._id,
      status: { $in: ['validated', 'pending-review', 'decision-pending'] },
    }).session(session ?? null),
    (story.draftRevisionId ?? story.currentRevisionId)
      ? ContentRevision.exists({
          _id: story.draftRevisionId ?? story.currentRevisionId,
          storyId: story._id,
          authorAccountId: story.authorAccountId,
          contentType: 'story',
          chapterId: null,
          status: 'editable',
          immutableAt: null,
        }).session(session ?? null)
      : Promise.resolve(null),
  ]
  // MongoDB transactions must not run parallel operations on the same session.
  const [chapters, activeSubmission, editableRevision] = session
    ? [await queries[0], await queries[1], await queries[2]]
    : await Promise.all(queries)
  const safe =
    !story.authoringFrozen &&
    !story.publishedRevisionId &&
    !story.publishedAt &&
    chapters.every(chapter => isPrivateDraftChapter(chapter, story.authorAccountId)) &&
    !activeSubmission &&
    Boolean(editableRevision)
  return {
    canArchive: safe && story.publicationStatus === 'draft',
    canDelete: safe && story.publicationStatus === 'draft',
    canRestore:
      safe &&
      story.publicationStatus === 'archived' &&
      story.publicationTransition?.result === 'author-draft-archived' &&
      String(story.publicationTransition?.actorAccountId) === String(story.authorAccountId),
  }
}

export async function changeDraftLifecycle(account, storyId, { action, expectedVersion }) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const story = await ownStory(account, storyId, session)
    if (story.version !== expectedVersion)
      throw new HttpError(
        409,
        'stale_content',
        'Truyện đã thay đổi. Hãy tải lại trước khi tiếp tục.',
      )
    const flags = await draftLifecycle(story, session)
    const allowed =
      action === 'archive'
        ? flags.canArchive
        : action === 'delete'
          ? flags.canDelete
          : flags.canRestore
    if (!allowed)
      throw new HttpError(
        409,
        'lifecycle_not_allowed',
        'Chỉ lưu trữ, khôi phục hoặc xóa bản nháp riêng tư đủ điều kiện, không có nội dung đã phát hành hay gói đang chờ duyệt.',
      )
    const before = story.publicationStatus
    story.publicationStatus = action === 'restore' ? 'draft' : 'archived'
    const now = new Date()
    story.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from: before,
      to: story.publicationStatus,
      result:
        action === 'archive'
          ? 'author-draft-archived'
          : action === 'delete'
            ? 'author-draft-deleted'
            : 'author-draft-restored',
    }
    await story.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action:
            action === 'archive'
              ? 'story.draft-archived'
              : action === 'delete'
                ? 'story.draft-deleted'
                : 'story.draft-restored',
          targetType: 'Story',
          targetId: story._id,
          targetVersion: story.version,
          result: 'accepted',
          occurredAt: now,
        },
      ],
      { session },
    )
    return { id: String(story._id), status: story.publicationStatus, version: story.version }
  })
}
