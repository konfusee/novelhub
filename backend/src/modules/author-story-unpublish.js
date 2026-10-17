import { AuditEvent } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { lockAuthor, ownStory } from './author-ownership.js';
import { HttpError } from '../middleware/errors.js';
import { digest } from './submission-digests.js';

export const storyCanUnpublish = (story) =>
  Boolean(
    !story.authoringFrozen && story.publicationStatus === 'published' && story.publishedRevisionId,
  );

export async function unpublishStory(account, storyId, input) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    const story = await ownStory(account, storyId, session);
    if (
      story.version !== input.expectedVersion ||
      String(story.publishedRevisionId) !== input.expectedPublishedRevisionId
    )
      throw new HttpError(
        409,
        'stale_content',
        'Truyện đã thay đổi. Hãy tải lại trước khi ngừng phát hành.',
      );
    if (!storyCanUnpublish(story))
      throw new HttpError(
        409,
        'unpublish_not_allowed',
        'Chỉ có thể ngừng phát hành truyện đang công khai và không bị khóa.',
      );
    const now = new Date();
    story.publicationStatus = 'unpublished';
    story.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from: 'published',
      to: 'unpublished',
      result: 'author-story-unpublished',
      revisionId: input.expectedPublishedRevisionId,
    };
    await story.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'story.unpublished',
          targetType: 'Story',
          targetId: story._id,
          targetVersion: story.version,
          result: 'accepted',
          reason: input.reason,
          occurredAt: now,
          dataDigest: digest({
            publishedRevisionId: input.expectedPublishedRevisionId,
            from: 'published',
            to: 'unpublished',
          }),
        },
      ],
      { session },
    );
    return { id: String(story._id), status: story.publicationStatus, version: story.version };
  });
}
