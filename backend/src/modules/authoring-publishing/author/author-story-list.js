import { Chapter, Category, PublicationSubmission, Story } from '../../../models/index.js'

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
  const [chapters, submissions, categories] = await Promise.all([
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
    Category.find({ _id: { $in: stories.flatMap(story => story.categoryIds) } })
      .select('name status')
      .lean(),
  ])
  const chapterCounts = new Map(chapters.map(row => [String(row._id), row.count]))
  const latestReviews = new Map()
  for (const submission of submissions) {
    const key = String(submission.storyId)
    if (!latestReviews.has(key)) latestReviews.set(key, submission)
  }
  const categoryMap = new Map(categories.map(category => [String(category._id), category]))

  return {
    items: stories.map(story => {
      const latestReview = latestReviews.get(String(story._id))
      const categoryRows = story.categoryIds
        .map(categoryId => categoryMap.get(String(categoryId)))
        .filter(Boolean)
      return {
        id: String(story._id),
        publishedRevisionId: story.publishedRevisionId ? String(story.publishedRevisionId) : null,
        title: story.title,
        description: story.description ?? '',
        categoryIds: story.categoryIds.map(String),
        categories: categoryRows.map(category => ({
          id: String(category._id),
          name: category.name,
          status: category.status,
        })),
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
