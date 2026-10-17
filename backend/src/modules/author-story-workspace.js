import { canConfigureEarlyAccess, canDisableEarlyAccess } from './author-early-access.js';
import {
  Category,
  Chapter,
  ContentRevision,
  PublicationSubmission,
  Rating,
  StatisticsEvent,
  Story,
} from '../models/index.js';
import { HttpError } from '../middleware/errors.js';
import { draftLifecycle } from './author-story-lifecycle.js';
import { canReorderDraftChapters } from './author-chapter-order.js';
import { chapterCanUnpublish, chapterDraftLifecycle } from './author-chapter-lifecycle.js';
import { chapterTextProjection } from './rich-chapter-document.js';
import { canReviseUnpublished } from './author-submissions.js';
import { storyCanUnpublish } from './author-story-unpublish.js';
import { canReleaseStoryVersion } from './author-story-release.js';

export async function authorStoryWorkspace(account, storyId) {
  const story = await Story.findOne({ _id: storyId, authorAccountId: account._id }).lean();
  if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
  const lifecycle = await draftLifecycle(story);
  const metadataRevisionId = story.draftRevisionId ?? story.currentRevisionId;
  const [categories, chapters, views, ratings, approvedMetadata] = await Promise.all([
    Category.find({ _id: { $in: story.categoryIds } })
      .select('name status')
      .lean(),
    Chapter.find({
      storyId: story._id,
      'publicationTransition.result': { $ne: 'author-draft-deleted' },
    })
      .sort({ orderKey: -1, _id: -1 })
      .lean(),
    StatisticsEvent.aggregate([
      { $match: { storyId: story._id, eventType: 'view' } },
      { $group: { _id: '$chapterId', count: { $sum: 1 } } },
    ]),
    Rating.aggregate([
      { $match: { storyId: story._id, status: 'active' } },
      { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } },
    ]),
    metadataRevisionId
      ? PublicationSubmission.exists({
          storyId: story._id,
          revisionId: metadataRevisionId,
          chapterId: null,
          authorAccountId: account._id,
          status: 'approved',
        })
      : Promise.resolve(null),
  ]);
  const revisionIds = chapters
    .map(
      (chapter) =>
        chapter.draftRevisionId ?? chapter.currentRevisionId ?? chapter.publishedRevisionId,
    )
    .filter(Boolean);
  const revisions = await ContentRevision.find({
    _id: { $in: revisionIds },
    storyId: story._id,
    authorAccountId: account._id,
    contentType: 'chapter',
  })
    .select(
      'chapterId storyId authorAccountId contentType content formatVersion status immutableAt',
    )
    .lean();
  const approvedChapters = await PublicationSubmission.find({
    storyId: story._id,
    chapterId: { $ne: null },
    revisionId: { $in: revisionIds },
    authorAccountId: account._id,
    status: 'approved',
  })
    .select('chapterId revisionId storyId status version')
    .lean();
  const rows = chapters.map((chapter) => {
    const revisionId =
      chapter.draftRevisionId ?? chapter.currentRevisionId ?? chapter.publishedRevisionId;
    const revision = revisions.find(
      (item) => item._id.equals(revisionId) && item.chapterId?.equals(chapter._id),
    );
    const words = revision
      ? chapterTextProjection(revision).reduce(
          (sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0),
          0,
        )
      : null;
    const source = approvedChapters.find(
      (item) => item.chapterId.equals(chapter._id) && item.revisionId.equals(revisionId),
    );
    return {
      ...chapterDraftLifecycle(chapter, revision, story, lifecycle),
      canConfigureEarlyAccess:
        canConfigureEarlyAccess(chapter, revision, story) ||
        canDisableEarlyAccess(chapter, revision, story),
      canUnpublish: chapterCanUnpublish(chapter, story),
      canManageSchedule:
        !story.authoringFrozen &&
        story.publicationStatus !== 'archived' &&
        ['approved', 'scheduled', 'due'].includes(chapter.status) &&
        !chapter.publishedRevisionId,
      reviseSource:
        source && canReviseUnpublished(source, chapter, revision, story)
          ? { id: String(source._id), version: source.version }
          : null,
      id: String(chapter._id),
      version: chapter.version,
      title: chapter.title,
      number: chapter.orderKey,
      status: chapter.status,
      canRelease: Boolean(
        !story.authoringFrozen &&
        story.publicationStatus === 'published' &&
        ['approved', 'published'].includes(chapter.status) &&
        String(revisionId) !== String(chapter.publishedRevisionId) &&
        approvedChapters.some(
          (item) => item.chapterId.equals(chapter._id) && item.revisionId.equals(revisionId),
        ),
      ),
      words,
      reads: views.find((item) => item._id?.equals(chapter._id))?.count ?? 0,
      updatedAt: chapter.updatedAt,
      publishedAt: chapter.publishedAt ?? null,
      requestedReleaseAt: chapter.requestedReleaseAt ?? null,
      earlyAccess: chapter.earlyAccess
        ? {
            enabled: chapter.earlyAccess.enabled,
            coinPrice: chapter.earlyAccess.coinPrice ?? null,
            durationDays: chapter.earlyAccess.durationDays ?? null,
            endsAt: chapter.earlyAccess.endsAt ?? null,
          }
        : null,
    };
  });
  return {
    story: {
      ...lifecycle,
      canReorder: canReorderDraftChapters(chapters, revisions, lifecycle),
      canReleaseMetadata: Boolean(
        approvedMetadata && canReleaseStoryVersion(story, metadataRevisionId),
      ),
      id: String(story._id),
      publishedRevisionId: story.publishedRevisionId ? String(story.publishedRevisionId) : null,
      canUnpublish: storyCanUnpublish(story),
      title: story.title,
      description: story.description ?? '',
      genres: categories.map((item) => item.name),
      categories: categories.map((item) => ({
        id: String(item._id),
        name: item.name,
        status: item.status,
      })),
      categoryIds: story.categoryIds.map(String),
      author: account.displayName,
      status: story.publicationStatus,
      version: story.version,
      canEdit:
        !story.authoringFrozen &&
        !['submitted', 'under-review', 'archived'].includes(story.publicationStatus),
    },
    chapters: rows,
    stats: {
      availableWords: rows.reduce((sum, chapter) => sum + (chapter.words ?? 0), 0),
      publishedChapters: rows.filter((chapter) => chapter.status === 'published').length,
      reads: views.reduce((sum, item) => sum + item.count, 0),
      rating: ratings[0]?.average?.toFixed(1) ?? '—',
      ratings: ratings[0]?.count ?? 0,
    },
    health: { retention: null, cadence: null, audioChapters: null, editorialAdvice: null },
  };
}
