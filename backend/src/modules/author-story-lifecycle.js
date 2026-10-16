import { AuditEvent, Chapter, ContentRevision, PublicationSubmission } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { lockAuthor, ownStory } from './author-ownership.js';

export async function draftLifecycle(story, session) {
  const queries = [
    Chapter.exists({
      storyId: story._id,
      $or: [
        { status: { $ne: 'draft' } },
        { firstReleasedAt: { $ne: null } },
        { publishedAt: { $ne: null } },
        { publishedRevisionId: { $ne: null } },
      ],
    }).session(session ?? null),
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
  ];
  // MongoDB transactions must not run parallel operations on the same session.
  const [releasedChapter, activeSubmission, editableRevision] = session
    ? [await queries[0], await queries[1], await queries[2]]
    : await Promise.all(queries);
  const safe =
    !story.authoringFrozen &&
    !story.publishedRevisionId &&
    !story.publishedAt &&
    !releasedChapter &&
    !activeSubmission &&
    Boolean(editableRevision);
  return {
    canArchive: safe && story.publicationStatus === 'draft',
    canRestore:
      safe &&
      story.publicationStatus === 'archived' &&
      story.publicationTransition?.result === 'author-draft-archived' &&
      String(story.publicationTransition?.actorAccountId) === String(story.authorAccountId),
  };
}

export async function changeDraftLifecycle(account, storyId, { action, expectedVersion }) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    const story = await ownStory(account, storyId, session);
    if (story.version !== expectedVersion)
      throw new HttpError(
        409,
        'stale_content',
        'Truyện đã thay đổi. Hãy tải lại trước khi tiếp tục.',
      );
    const flags = await draftLifecycle(story, session);
    if (!(action === 'archive' ? flags.canArchive : flags.canRestore))
      throw new HttpError(
        409,
        'lifecycle_not_allowed',
        'Chỉ lưu trữ hoặc khôi phục bản nháp riêng tư đủ điều kiện, không có nội dung đã phát hành hay gói đang chờ duyệt.',
      );
    const before = story.publicationStatus;
    story.publicationStatus = action === 'archive' ? 'archived' : 'draft';
    const now = new Date();
    story.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from: before,
      to: story.publicationStatus,
      result: action === 'archive' ? 'author-draft-archived' : 'author-draft-restored',
    };
    await story.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: action === 'archive' ? 'story.draft-archived' : 'story.draft-restored',
          targetType: 'Story',
          targetId: story._id,
          targetVersion: story.version,
          result: 'accepted',
          occurredAt: now,
        },
      ],
      { session },
    );
    return { id: String(story._id), status: story.publicationStatus, version: story.version };
  });
}
