import { canConfigureEarlyAccess, canDisableEarlyAccess } from './author-early-access.js'
import {
  Category,
  Chapter,
  ContentRevision,
  PublicationSubmission,
  Rating,
  StatisticsEvent,
  Story,
} from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { draftLifecycle } from './author-story-lifecycle.js'
import { canReorderDraftChapters } from './author-chapter-order.js'
import {
  chapterCanDelete,
  chapterCanUnpublish,
  chapterDraftLifecycle,
} from './author-chapter-lifecycle.js'
import { chapterTextProjection } from '../content/rich-chapter-document.js'
import { canReviseApprovedUnreleased, canReviseUnpublished } from './author-submissions.js'
import { storyCanUnpublish } from './author-story-unpublish.js'
import { canReleaseStoryVersion } from './author-story-release.js'
import { metadataTags } from '../content/story-tags.js'

export async function authorStoryWorkspace(account, storyId) {
  const story = await Story.findOne({
    _id: storyId,
    authorAccountId: account._id,
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  }).lean()
  if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.')
  const lifecycle = await draftLifecycle(story)
  const metadataRevisionId = story.draftRevisionId ?? story.currentRevisionId
  const [category, chapters, views, ratings, approvedMetadata, tags] = await Promise.all([
    Category.findById(story.categoryId).select('name status').lean(),
    Chapter.find({
      storyId: story._id,
      'publicationTransition.result': { $ne: 'author-draft-deleted' },
    })
      .sort({ orderKey: 1, _id: 1 })
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
    metadataTags(story),
  ])
  // Keep every pointer because a published chapter can have an editable draft
  // revision alongside its immutable public revision.
  const revisionIds = [
    ...new Set(
      chapters
        .flatMap(chapter => [
          chapter.draftRevisionId,
          chapter.currentRevisionId,
          chapter.publishedRevisionId,
        ])
        .filter(Boolean)
        .map(String),
    ),
  ]
  const revisions = await ContentRevision.find({
    _id: { $in: revisionIds },
    storyId: story._id,
    authorAccountId: account._id,
    contentType: 'chapter',
  })
    .select(
      'chapterId storyId authorAccountId contentType content formatVersion status immutableAt',
    )
    .lean()
  const approvedChapters = await PublicationSubmission.find({
    storyId: story._id,
    chapterId: { $ne: null },
    revisionId: { $in: revisionIds },
    authorAccountId: account._id,
    status: 'approved',
  })
    .select('chapterId revisionId storyId status version')
    .lean()
  const openChapterIds = new Set(
    (
      await PublicationSubmission.find({
        storyId: story._id,
        chapterId: { $ne: null },
        authorAccountId: account._id,
        status: { $in: ['validated', 'pending-review', 'decision-pending'] },
      })
        .select('chapterId')
        .lean()
    ).map(item => String(item.chapterId)),
  )
  const rows = chapters.map(chapter => {
    const revisionId =
      chapter.draftRevisionId ?? chapter.currentRevisionId ?? chapter.publishedRevisionId
    const revision = revisions.find(
      item => item._id.equals(revisionId) && item.chapterId?.equals(chapter._id),
    )
    const words = revision
      ? chapterTextProjection(revision).reduce(
          (sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0),
          0,
        )
      : null
    const source = approvedChapters.find(
      item => item.chapterId.equals(chapter._id) && item.revisionId.equals(revisionId),
    )
    const publishedRevision = chapter.publishedRevisionId
      ? revisions.find(item => item._id.equals(chapter.publishedRevisionId))
      : null
    const publishedSource = chapter.publishedRevisionId
      ? approvedChapters.find(
          item =>
            item.chapterId.equals(chapter._id) &&
            item.revisionId.equals(chapter.publishedRevisionId),
        )
      : null
    const publishedCanRevise = Boolean(
      publishedSource &&
        publishedRevision &&
        canReviseUnpublished(publishedSource, chapter, publishedRevision, story),
    )
    const currentCanRevise = Boolean(
      source &&
        (canReviseUnpublished(source, chapter, revision, story) ||
          canReviseApprovedUnreleased(source, chapter, revision, story)),
    )
    const revisionSource = publishedCanRevise ? publishedSource : currentCanRevise ? source : null
    return {
      ...chapterDraftLifecycle(
        chapter,
        revision,
        story,
        lifecycle,
        openChapterIds.has(String(chapter._id)),
      ),
      canDelete: chapterCanDelete(
        chapter,
        revision,
        story,
        openChapterIds.has(String(chapter._id)),
      ),
      canConfigureEarlyAccess:
        canConfigureEarlyAccess(chapter, revision, story) ||
        canDisableEarlyAccess(chapter, revision, story),
      canUnpublish: chapterCanUnpublish(chapter, story),
      canManageSchedule:
        !story.authoringFrozen &&
        story.publicationStatus !== 'archived' &&
        ['approved', 'scheduled', 'due'].includes(chapter.status) &&
        !chapter.publishedRevisionId,
      reviseSource: revisionSource
        ? { id: String(revisionSource._id), version: revisionSource.version }
        : null,
      id: String(chapter._id),
      version: chapter.version,
      title: revision?.content.title ?? chapter.title,
      number: chapter.orderKey,
      status: chapter.status,
      // Immutable published revisions are read-only; authors edit a new revision.
      canEdit: Boolean(
        !story.authoringFrozen &&
          !['submitted', 'under-review', 'archived'].includes(story.publicationStatus) &&
          ['draft', 'published'].includes(chapter.status) &&
          revision?.status === 'editable' &&
          !revision?.immutableAt,
      ),
      canRelease: Boolean(
        !story.authoringFrozen &&
        story.publicationStatus === 'published' &&
        ['approved', 'published'].includes(chapter.status) &&
        String(revisionId) !== String(chapter.publishedRevisionId) &&
        approvedChapters.some(
          item => item.chapterId.equals(chapter._id) && item.revisionId.equals(revisionId),
        ),
      ),
      words,
      reads: views.find(item => item._id?.equals(chapter._id))?.count ?? 0,
      updatedAt: chapter.updatedAt,
      publishedAt: chapter.publishedAt ?? null,
      publishedRevisionId: chapter.publishedRevisionId
        ? String(chapter.publishedRevisionId)
        : null,
      requestedReleaseAt: chapter.requestedReleaseAt ?? null,
      earlyAccess: chapter.earlyAccess
        ? {
            enabled: chapter.earlyAccess.enabled,
            coinPrice: chapter.earlyAccess.coinPrice ?? null,
            durationDays: chapter.earlyAccess.durationDays ?? null,
            endsAt: chapter.earlyAccess.endsAt ?? null,
          }
        : null,
    }
  })
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
      genre: category?.name ?? '',
      category: category
        ? { id: String(category._id), name: category.name, status: category.status }
        : null,
      categoryId: String(story.categoryId),
      tags,
      coverMediaId: story.coverMediaId ? String(story.coverMediaId) : null,
      coverUrl: story.coverMediaId ? `/author/media/${story.coverMediaId}/content` : null,
      coverBannerMediaId: story.theme?.coverBannerMediaId
        ? String(story.theme.coverBannerMediaId)
        : null,
      bannerUrl: story.theme?.coverBannerMediaId
        ? `/author/media/${story.theme.coverBannerMediaId}/content`
        : null,
      author: account.displayName,
      status: story.publicationStatus,
      version: story.version,
      canEdit:
        !story.authoringFrozen &&
        !['submitted', 'under-review', 'archived'].includes(story.publicationStatus),
      canEditMetadata: Boolean(
        !story.publishedRevisionId &&
          !story.authoringFrozen &&
          !['submitted', 'under-review', 'archived'].includes(story.publicationStatus),
      ),
    },
    chapters: rows,
    stats: {
      availableWords: rows.reduce((sum, chapter) => sum + (chapter.words ?? 0), 0),
      publishedChapters: rows.filter(chapter => chapter.status === 'published').length,
      reads: views.reduce((sum, item) => sum + item.count, 0),
      rating: ratings[0]?.average?.toFixed(1) ?? '—',
      ratings: ratings[0]?.count ?? 0,
    },
    health: { retention: null, cadence: null, audioChapters: null, editorialAdvice: null },
  }
}
