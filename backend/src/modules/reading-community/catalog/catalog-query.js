import mongoose from 'mongoose'
import {
  Account,
  Category,
  Chapter,
  ContentRevision,
  Follow,
  Rating,
  StatisticsEvent,
  Story,
} from '../../../models/index.js'
import { searchTagKey } from '../../authoring-publishing/content/story-tags.js'

const snapshotStages = (ids, match = {}) => [
  {
    $match: {
      publicationStatus: 'published',
      publishedRevisionId: { $ne: null },
      ...(ids ? { _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } } : {}),
      ...match,
    },
  },
  {
    $lookup: {
      from: Account.collection.name,
      localField: 'authorAccountId',
      foreignField: '_id',
      pipeline: [{ $project: { status: 1 } }],
      as: 'authorState',
    },
  },
  { $match: { 'authorState.status': { $nin: ['suspended', 'anonymized'] } } },
  {
    $lookup: {
      from: ContentRevision.collection.name,
      localField: 'publishedRevisionId',
      foreignField: '_id',
      as: 'revision',
    },
  },
  { $unwind: '$revision' },
  {
    $match: {
      'revision.contentType': 'story',
      'revision.status': { $in: ['approved', 'immutable'] },
      'revision.content.title': { $type: 'string', $ne: '' },
      $expr: {
        $and: [
          { $eq: ['$revision.storyId', '$_id'] },
          { $eq: ['$revision.authorAccountId', '$authorAccountId'] },
        ],
      },
    },
  },
]
const storyLookup = (model, match, pipeline, as) => ({
  $lookup: {
    from: model.collection.name,
    let: { story: '$_id' },
    pipeline: [{ $match: { ...match, $expr: { $eq: ['$storyId', '$$story'] } } }, ...pipeline],
    as,
  },
})
const POPULARITY_WINDOW_MS = 30 * 86400000
const SORTS = {
  newest: { publishedAt: -1, _id: -1 },
  popular: { popularity: -1, _id: -1 },
  rating: { average: -1, _id: -1 },
}

/**
 * Published, visible story cards. `reads` counts every unique daily chapter view ever
 * recorded; `popularity` counts unique (day, viewer) pairs across the story's chapters
 * over the rolling last 30 days. `tag` is a tag key; `q` also matches a story tag.
 */
export async function queryPublishedStories({
  ids,
  q = '',
  category,
  tag,
  status,
  page = 1,
  pageSize = 24,
  sort = 'newest',
  now = new Date(),
} = {}) {
  if (!SORTS[sort]) throw new Error(`Unsupported catalogue sort: ${sort}`)
  const stages = [
    ...snapshotStages(ids, tag ? { tagKeys: tag } : {}),
    { $set: { categoryKey: { $toString: '$revision.content.categoryId' } } },
    {
      $lookup: {
        from: Account.collection.name,
        localField: 'authorAccountId',
        foreignField: '_id',
        pipeline: [{ $project: { displayName: 1, status: 1 } }],
        as: 'author',
      },
    },
    { $set: { author: { $first: '$author' } } },
  ]
  if (status) stages.push({ $match: { completionStatus: status } })
  if (category) stages.push({ $match: { categoryKey: category } })
  if (q) {
    const literal = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    const qTag = searchTagKey(q)
    stages.push({
      $match: {
        $or: [
          { 'revision.content.title': literal },
          { 'author.status': 'active', 'author.displayName': literal },
          ...(qTag ? [{ tagKeys: qTag }] : []),
        ],
      },
    })
  }
  const metrics = [
    {
      $lookup: {
        from: Category.collection.name,
        let: { key: '$categoryKey' },
        pipeline: [
          { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$key'] } } },
          { $project: { name: 1 } },
        ],
        as: 'category',
      },
    },
    { $set: { category: { $first: '$category' } } },
    storyLookup(Chapter, { status: 'published' }, [{ $count: 'value' }], 'chapters'),
    storyLookup(
      Rating,
      { status: 'active' },
      [{ $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } }],
      'ratings',
    ),
    storyLookup(StatisticsEvent, { eventType: 'view' }, [{ $count: 'value' }], 'views'),
    storyLookup(
      StatisticsEvent,
      { eventType: 'view', occurredAt: { $gte: new Date(now.getTime() - POPULARITY_WINDOW_MS) } },
      [
        { $group: { _id: { day: '$day', type: '$viewerType', key: '$viewerKey' } } },
        { $count: 'value' },
      ],
      'recentViews',
    ),
    storyLookup(Follow, { status: 'active' }, [{ $count: 'value' }], 'follows'),
    {
      $set: {
        average: { $ifNull: [{ $first: '$ratings.average' }, null] },
        ratingCount: { $ifNull: [{ $first: '$ratings.count' }, 0] },
        viewCount: { $ifNull: [{ $first: '$views.value' }, 0] },
        popularity: { $ifNull: [{ $first: '$recentViews.value' }, 0] },
        followers: { $ifNull: [{ $first: '$follows.value' }, 0] },
      },
    },
  ]
  if (sort !== 'newest') stages.push(...metrics)
  stages.push({ $sort: SORTS[sort] })
  const result = await Story.aggregate([
    ...stages,
    {
      $facet: {
        total: [{ $count: 'value' }],
        rows: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          ...(sort === 'newest' ? metrics : []),
          {
            $project: {
              'revision.content.title': 1,
              'revision.content.description': 1,
              'revision.content.tags': 1,
              author: 1,
              categoryKey: 1,
              category: 1,
              average: 1,
              ratingCount: 1,
              viewCount: 1,
              popularity: 1,
              followers: 1,
              chapters: 1,
              completionStatus: 1,
              publishedAt: 1,
            },
          },
        ],
      },
    },
  ])
  return {
    items: result[0].rows.map(story => ({
      id: String(story._id),
      title: story.revision.content.title,
      description: story.revision.content.description ?? '',
      author: story.author?.status === 'active' ? story.author.displayName : 'Tác giả',
      authorId: story.author ? String(story.author._id) : null,
      categoryId: story.categoryKey,
      genre: story.category?.name ?? '',
      tags: story.revision.content.tags ?? [],
      format: 'Story',
      status: story.completionStatus === 'completed' ? 'Completed' : 'Ongoing',
      rating: story.average == null ? '—' : story.average.toFixed(1),
      ratingCount: story.ratingCount,
      reads: String(story.viewCount),
      popularity: story.popularity,
      followers: story.followers,
      chapters: story.chapters[0]?.value ?? 0,
      publishedAt: story.publishedAt,
    })),
    total: result[0].total[0]?.value ?? 0,
    page,
    pageSize,
  }
}

/** Active categories by `sortKey, name` with the number of published visible stories in each. */
export async function categoryStoryCounts() {
  const [categories, counts] = await Promise.all([
    Category.find({ status: 'active' }).sort({ sortKey: 1, name: 1 }).select('name').lean(),
    Story.aggregate([
      ...snapshotStages(),
      { $group: { _id: { $toString: '$revision.content.categoryId' }, value: { $sum: 1 } } },
    ]),
  ])
  const byCategory = new Map(counts.map(row => [row._id, row.value]))
  return categories.map(category => ({
    id: String(category._id),
    name: category.name,
    storyCount: byCategory.get(String(category._id)) ?? 0,
  }))
}
