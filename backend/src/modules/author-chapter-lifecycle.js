import { AuditEvent, Chapter, ContentRevision } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { lockAuthor, ownStory } from './author-ownership.js';
import { draftLifecycle, isPrivateDraftChapter } from './author-story-lifecycle.js';

export function chapterDraftLifecycle(chapter, revision, story, lifecycle) {
  const safe =
    lifecycle.canArchive &&
    isPrivateDraftChapter(chapter, story.authorAccountId) &&
    revision &&
    String(revision._id) === String(chapter.draftRevisionId ?? chapter.currentRevisionId) &&
    String(revision.chapterId) === String(chapter._id) &&
    String(revision.storyId) === String(story._id) &&
    String(revision.authorAccountId) === String(story.authorAccountId) &&
    revision.contentType === 'chapter' &&
    revision.status === 'editable' &&
    !revision.immutableAt;
  return {
    canArchive: Boolean(safe && chapter.status === 'draft'),
    canRestore: Boolean(safe && chapter.status === 'archived'),
  };
}

export async function changeChapterDraftLifecycle(account, storyId, chapterId, input) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    const story = await ownStory(account, storyId, session);
    const chapter = await Chapter.findOne({ _id: chapterId, storyId: story._id }).session(session);
    if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.');
    if (chapter.version !== input.expectedVersion || story.version !== input.expectedStoryVersion)
      throw new HttpError(409, 'stale_content', 'Truyện hoặc chương đã thay đổi. Hãy tải lại.');
    const revision = await ContentRevision.findOne({
      _id: chapter.draftRevisionId ?? chapter.currentRevisionId,
      chapterId: chapter._id,
      storyId: story._id,
      authorAccountId: account._id,
      contentType: 'chapter',
    }).session(session);
    const flags = chapterDraftLifecycle(
      chapter,
      revision,
      story,
      await draftLifecycle(story, session),
    );
    if (!(input.action === 'archive' ? flags.canArchive : flags.canRestore))
      throw new HttpError(
        409,
        'chapter_lifecycle_not_allowed',
        'Chỉ lưu trữ hoặc khôi phục chương nháp riêng tư đủ điều kiện, không có nội dung đã phát hành hay gói đang chờ duyệt.',
      );
    const now = new Date();
    const before = chapter.status;
    chapter.status = input.action === 'archive' ? 'archived' : 'draft';
    chapter.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from: before,
      to: chapter.status,
      result: input.action === 'archive' ? 'author-draft-archived' : 'author-draft-restored',
    };
    await chapter.save({ session });
    story.increment();
    await story.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: input.action === 'archive' ? 'chapter.draft-archived' : 'chapter.draft-restored',
          targetType: 'Chapter',
          targetId: chapter._id,
          targetVersion: chapter.version,
          result: 'accepted',
          occurredAt: now,
        },
      ],
      { session },
    );
    return {
      chapter: { id: String(chapter._id), status: chapter.status, version: chapter.version },
      story: { id: String(story._id), version: story.version },
    };
  });
}
