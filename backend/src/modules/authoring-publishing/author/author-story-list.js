import {
  Chapter,
  Category,
  ContentRevision,
  PublicationSubmission,
  Story,
} from '../../../models/index.js'

const OPEN_SUBMISSION_STATUSES = ['validated', 'pending-review', 'decision-pending']

/** Author-owned story list with the metadata needed by the Studio list view. */
export async function authorStoryList(accountId) {
  const stories = await Story.find({
    authorAccountId: accountId,
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  })
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  if (!stories.length) return { items: [] }

  const storyIds = stories.map(story => story._id)
  const metadataRevisionIds = stories
    .map(story => story.draftRevisionId ?? story.currentRevisionId)
    .filter(Boolean)
  const [chapters, submissions, categories, revisions] = await Promise.all([
    Chapter.aggregate([
      {
        $match: {
          storyId: { $in: storyIds },
          'publicationTransition.result': { $ne: 'author-draft-deleted' },
        },
      },
      { $group: { _id: '$storyId', count: { $sum: 1 } } },
    ]),
    PublicationSubmission.find({ storyId: { $in: storyIds }, authorAccountId: accountId })
      .select('storyId status submittedAt version')
      .sort({ submittedAt: -1, _id: -1 })
      .lean(),
    Category.find({ _id: { $in: stories.map(story => story.categoryId) } })
      .select('name status')
      .lean(),
    ContentRevision.find({ _id: { $in: metadataRevisionIds } })
      .select('content.tags')
      .lean(),
  ])
  const chapterCounts = new Map(chapters.map(row => [String(row._id), row.count]))
  const latestReviews = new Map()
  for (const submission of submissions) {
    const key = String(submission.storyId)
    if (!latestReviews.has(key)) latestReviews.set(key, submission)
  }
  const categoryMap = new Map(categories.map(category => [String(category._id), category]))
  const tagsByRevision = new Map(
    revisions.map(revision => [String(revision._id), revision.content?.tags ?? []]),
  )

  return {
    items: stories.map(story => {
      const latestReview = latestReviews.get(String(story._id))
      const category = categoryMap.get(String(story.categoryId))
      return {
        id: String(story._id),
        publishedRevisionId: story.publishedRevisionId ? String(story.publishedRevisionId) : null,
        title: story.title,
        description: story.description ?? '',
        categoryId: String(story.categoryId),
        genre: category?.name ?? '',
        category: category
          ? { id: String(category._id), name: category.name, status: category.status }
          : null,
        tags: tagsByRevision.get(String(story.draftRevisionId ?? story.currentRevisionId)) ?? [],
        status: story.publicationStatus,
        reviewStatus: latestReview?.status ?? null,
        chapterCount: chapterCounts.get(String(story._id)) ?? 0,
        version: story.version,
        updatedAt: story.updatedAt,
        canDelete:
          story.publicationStatus === 'draft' &&
          !story.publishedRevisionId &&
          !story.publishedAt &&
          !story.authoringFrozen &&
          !submissions.some(
            submission =>
              String(submission.storyId) === String(story._id) &&
              OPEN_SUBMISSION_STATUSES.includes(submission.status),
          ),
      }
    }),
  }
}
