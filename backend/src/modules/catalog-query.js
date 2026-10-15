import mongoose from 'mongoose';
import {
  Account,
  Category,
  Chapter,
  ContentRevision,
  Rating,
  StatisticsEvent,
  Story,
} from '../models/index.js';

const snapshotStages = (ids) => [
  {
    $match: {
      publicationStatus: 'published',
      publishedRevisionId: { $ne: null },
      ...(ids ? { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } : {}),
    },
  },
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
];
const groupLookup = (model, match, accumulator, as) => ({
  $lookup: {
    from: model.collection.name,
    let: { story: '$_id' },
    pipeline: [
      { $match: { ...match, $expr: { $eq: ['$storyId', '$$story'] } } },
      { $group: { _id: null, value: accumulator } },
    ],
    as,
  },
});

export async function queryPublishedStories({
  ids,
  q = '',
  category,
  page = 1,
  pageSize = 24,
  sort = 'newest',
} = {}) {
  const stages = [
    ...snapshotStages(ids),
    {
      $set: {
        categoryKeys: {
          $map: {
            input: { $ifNull: ['$revision.content.categoryIds', []] },
            as: 'category',
            in: { $toString: '$$category' },
          },
        },
      },
    },
    {
      $lookup: {
        from: Account.collection.name,
        localField: 'authorAccountId',
        foreignField: '_id',
        as: 'author',
      },
    },
    { $set: { author: { $first: '$author' } } },
    {
      $lookup: {
        from: Category.collection.name,
        let: { keys: '$categoryKeys' },
        pipeline: [
          { $match: { $expr: { $in: [{ $toString: '$_id' }, '$$keys'] } } },
          { $project: { name: 1 } },
        ],
        as: 'categories',
      },
    },
  ];
  if (category) stages.push({ $match: { categoryKeys: category } });
  if (q) {
    const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    stages.push({
      $match: {
        $or: [
          'revision.content.title',
          'revision.content.description',
          'author.displayName',
          'categories.name',
        ].map((path) => ({ [path]: { $regex: literal, $options: 'i' } })),
      },
    });
  }
  const metrics = [
    groupLookup(Chapter, { status: 'published' }, { $sum: 1 }, 'chapters'),
    groupLookup(Rating, { status: 'active' }, { $avg: '$value' }, 'ratings'),
    groupLookup(StatisticsEvent, { eventType: 'view' }, { $sum: 1 }, 'views'),
    {
      $set: {
        average: { $ifNull: [{ $first: '$ratings.value' }, null] },
        viewCount: { $ifNull: [{ $first: '$views.value' }, 0] },
      },
    },
  ];
  if (sort !== 'newest') stages.push(...metrics);
  stages.push({
    $sort:
      sort === 'reads'
        ? { viewCount: -1, _id: -1 }
        : sort === 'rating'
          ? { average: -1, _id: -1 }
          : { publishedAt: -1, _id: -1 },
  });
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
              'author.displayName': 1,
              'author.status': 1,
              'author._id': 1,
              categoryKeys: 1,
              categories: 1,
              average: 1,
              viewCount: 1,
              chapters: 1,
              completionStatus: 1,
              publishedAt: 1,
            },
          },
        ],
      },
    },
  ]);
  return {
    items: result[0].rows.map((story) => ({
      id: String(story._id),
      title: story.revision.content.title,
      description: story.revision.content.description ?? '',
      author: story.author?.status === 'active' ? story.author.displayName : 'Tác giả',
      authorId: story.author ? String(story.author._id) : null,
      categoryIds: story.categoryKeys,
      genres: story.categories.map((item) => item.name),
      genre: story.categories.map((item) => item.name).join(', '),
      format: 'Story',
      status: story.completionStatus === 'completed' ? 'Completed' : 'Ongoing',
      rating: story.average == null ? '—' : story.average.toFixed(1),
      reads: String(story.viewCount),
      chapters: story.chapters[0]?.value ?? 0,
      publishedAt: story.publishedAt,
    })),
    total: result[0].total[0]?.value ?? 0,
    page,
    pageSize,
  };
}

export async function publishedCategoryCounts() {
  const rows = await Story.aggregate([
    ...snapshotStages(),
    { $unwind: '$revision.content.categoryIds' },
    { $group: { _id: { $toString: '$revision.content.categoryIds' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}
