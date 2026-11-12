import {
  Chapter,
  Comment,
  ContentRevision,
  Follow,
  LedgerEntry,
  Rating,
  StatisticsEvent,
  Story,
  UnlockRequest,
  Wallet,
} from '../../../models/index.js'
import { chapterTextProjection } from '../content/rich-chapter-document.js'
const DAY_MS = 86400000
const vietnameseDay = value =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value)
const dateWindow = (days, now = new Date()) => {
  const today = vietnameseDay(now)
  const end = new Date(`${today}T00:00:00+07:00`)
  const start = new Date(end.getTime() - (days - 1) * DAY_MS)
  return {
    days,
    today,
    start,
    end: new Date(end.getTime() + DAY_MS),
    startDay: vietnameseDay(start),
    endDay: vietnameseDay(new Date(end.getTime() - 1)),
  }
}

const viewsForWindow = (storyIds, startDay, endDay) =>
  StatisticsEvent.aggregate([
    {
      $match: {
        storyId: { $in: storyIds },
        eventType: 'view',
        day: { $gte: startDay, $lte: endDay },
      },
    },
    { $group: { _id: '$storyId', count: { $sum: 1 } } },
  ])

async function revenueForStories(accountId, storyIds, chapterIds, from, to) {
  if (!storyIds.length || !chapterIds.length)
    return { total: 0, unlocks: 0, byStory: new Map() }
  const wallet = await Wallet.findOne({
    ownerType: 'account',
    ownerId: accountId,
    purpose: 'author-earnings',
  })
    .select('_id')
    .lean()
  if (!wallet) return { total: 0, unlocks: 0, byStory: new Map() }
  const [summary] = await LedgerEntry.aggregate([
    {
      $match: {
        walletId: wallet._id,
        ledgerType: 'allocation-credit',
        direction: 'credit',
        sourceType: 'UnlockRequest',
        occurredAt: { $gte: from, $lt: to },
      },
    },
    {
      $lookup: {
        from: UnlockRequest.collection.name,
        localField: 'sourceId',
        foreignField: '_id',
        as: 'request',
      },
    },
    { $unwind: '$request' },
    { $match: { 'request.chapterId': { $in: chapterIds }, 'request.status': 'committed' } },
    {
      $facet: {
        total: [{ $group: { _id: null, amount: { $sum: '$amount' }, unlocks: { $sum: 1 } } }],
        byStory: [
          {
            $lookup: {
              from: Chapter.collection.name,
              localField: 'request.chapterId',
              foreignField: '_id',
              as: 'chapter',
            },
          },
          { $unwind: '$chapter' },
          {
            $group: {
              _id: '$chapter.storyId',
              amount: { $sum: '$amount' },
              unlocks: { $sum: 1 },
            },
          },
        ],
      },
    },
  ])
  const rows = summary?.byStory ?? []
  const byStory = new Map(
    rows.map(row => [String(row._id), { amount: row.amount, unlocks: row.unlocks }]),
  )
  return {
    total: summary?.total?.[0]?.amount ?? 0,
    unlocks: summary?.total?.[0]?.unlocks ?? 0,
    byStory,
  }
}

export async function authorDashboard(accountId, { days = 1 } = {}, now = new Date()) {
  const stories = await Story.find({
    authorAccountId: accountId,
  })
    .sort({
      updatedAt: -1,
      _id: -1,
    })
    .lean()
  const ids = stories.map(story => story._id)
  const windows = [dateWindow(1, now), dateWindow(7, now), dateWindow(30, now)]
  const selectedWindow = dateWindow(days, now)
  const publishedStories = stories.filter(story => story.publicationStatus === 'published')
  const publishedStoryIds = publishedStories.map(story => story._id)
  const [chapters, views, ratings, followers, feedback, feedbackTotal, selectedViews] =
    await Promise.all([
      Chapter.find({
        storyId: {
          $in: ids,
        },
        'publicationTransition.result': {
          $ne: 'author-draft-deleted',
        },
      })
        .select('storyId title status draftRevisionId publishedRevisionId updatedAt')
        .sort({
          updatedAt: -1,
          _id: -1,
        })
        .lean(),
      StatisticsEvent.aggregate([
        {
          $match: {
            storyId: {
              $in: ids,
            },
            eventType: 'view',
          },
        },
        {
          $group: {
            _id: '$storyId',
            count: {
              $sum: 1,
            },
          },
        },
      ]),
      Rating.aggregate([
        {
          $match: {
            storyId: {
              $in: ids,
            },
            status: 'active',
          },
        },
        {
          $group: {
            _id: '$storyId',
            average: {
              $avg: '$value',
            },
          },
        },
      ]),
      Follow.distinct('accountId', {
        storyId: {
          $in: ids,
        },
        status: 'active',
      }),
      Comment.find({
        targetType: 'story',
        targetId: {
          $in: publishedStoryIds,
        },
        parentCommentId: null,
        status: 'visible',
      })
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(2)
        .populate('authorAccountId', 'displayName status')
        .select('body targetId authorAccountId createdAt')
        .lean(),
      Comment.countDocuments({
        targetType: 'story',
        targetId: {
          $in: publishedStoryIds,
        },
        parentCommentId: null,
        status: 'visible',
      }),
      StatisticsEvent.aggregate([
        {
          $match: {
            storyId: { $in: ids },
            eventType: 'view',
            day: { $gte: selectedWindow.startDay, $lte: selectedWindow.endDay },
          },
        },
        { $group: { _id: '$storyId', count: { $sum: 1 } } },
      ]),
    ])
  const publishedChapters = chapters.filter(chapter => chapter.status === 'published')
  const publishedChapterIds = publishedChapters.map(chapter => chapter._id)
  const selectedComments = await Comment.countDocuments({
    $or: [
      { targetType: 'story', targetId: { $in: publishedStoryIds } },
      { targetType: 'chapter', targetId: { $in: publishedChapterIds } },
    ],
    parentCommentId: null,
    status: 'visible',
    createdAt: { $gte: selectedWindow.start, $lt: selectedWindow.end },
  })
  const [chapterFeedback, chapterFeedbackTotal] = await Promise.all([
    Comment.find({
      targetType: 'chapter',
      targetId: { $in: publishedChapterIds },
      parentCommentId: null,
      status: 'visible',
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(2)
      .populate('authorAccountId', 'displayName status')
      .select('body targetId authorAccountId createdAt')
      .lean(),
    Comment.countDocuments({
      targetType: 'chapter',
      targetId: { $in: publishedChapterIds },
      parentCommentId: null,
      status: 'visible',
    }),
  ])
  const editable = new Set(
    stories
      .filter(
        story =>
          !story.authoringFrozen &&
          !['submitted', 'under-review', 'archived'].includes(story.publicationStatus),
      )
      .map(story => String(story._id)),
  )
  const draftChapters = chapters.filter(
    chapter =>
      chapter.status === 'draft' &&
      chapter.draftRevisionId &&
      editable.has(String(chapter.storyId)),
  )
  const revisions = await ContentRevision.find({
    _id: {
      $in: draftChapters.map(chapter => chapter.draftRevisionId),
    },
    authorAccountId: accountId,
    contentType: 'chapter',
    status: 'editable',
  })
    .select('storyId chapterId content formatVersion')
    .lean()
  const validDrafts = draftChapters.flatMap(chapter => {
    const revision = revisions.find(
      item =>
        item._id.equals(chapter.draftRevisionId) &&
        item.chapterId?.equals(chapter._id) &&
        item.storyId.equals(chapter.storyId),
    )
    if (!revision) return []
    const story = stories.find(item => item._id.equals(chapter.storyId))
    const written = chapterTextProjection(revision).reduce(
      (sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0),
      0,
    )
    return [
      {
        id: String(story._id),
        title: story.title,
        chapterId: String(chapter._id),
        chapter: revision.content?.title ?? chapter.title,
        written,
      },
    ]
  })
  const revenueChapterIds = publishedChapterIds
  const revenueByWindow = await Promise.all(
    windows.map(window =>
      revenueForStories(accountId, ids, revenueChapterIds, window.start, window.end),
    ),
  )
  const selectedRevenue = await revenueForStories(
    accountId,
    ids,
    revenueChapterIds,
    selectedWindow.start,
    selectedWindow.end,
  )
  const selectedViewByStory = new Map(selectedViews.map(row => [String(row._id), row.count]))
  const [todayViews, weekViews, monthViews] = await Promise.all(
    windows.map(window => viewsForWindow(ids, window.startDay, window.endDay)),
  )
  const viewMaps = [todayViews, weekViews, monthViews].map(
    rows => new Map(rows.map(row => [String(row._id), row.count])),
  )
  const revenueMaps = revenueByWindow.map(window => window.byStory)
  const metricFor = (index, storyId) => {
    const revenue = revenueMaps[index].get(String(storyId)) ?? { amount: 0, unlocks: 0 }
    return {
      views: viewMaps[index].get(String(storyId)) ?? 0,
      earnings: revenue.amount,
      unlocks: revenue.unlocks,
    }
  }
  const sincePublicationMetrics = new Map(
    await Promise.all(
      publishedStories.map(async story => {
        const start = story.publishedAt ? new Date(story.publishedAt) : new Date(0)
        const storyChapters = publishedChapters.filter(chapter => chapter.storyId.equals(story._id))
        const [storyViews, storyRevenue] = await Promise.all([
          viewsForWindow([story._id], vietnameseDay(start), windows[0].endDay),
          revenueForStories(
            accountId,
            [story._id],
            storyChapters.map(chapter => chapter._id),
            start,
            windows[0].end,
          ),
        ])
        const revenue = storyRevenue.byStory.get(String(story._id)) ?? {
          amount: 0,
          unlocks: 0,
        }
        return [
          String(story._id),
          {
            views: storyViews[0]?.count ?? 0,
            earnings: revenue.amount,
            unlocks: revenue.unlocks,
          },
        ]
      }),
    ),
  )
  const storyRows = stories
    .filter(story => story.publicationStatus === 'published')
    .map(story => {
      const revenue = selectedRevenue.byStory.get(String(story._id)) ?? { amount: 0, unlocks: 0 }
      return {
        id: String(story._id),
        title: story.title,
        earnings: revenue.amount,
        unlocks: revenue.unlocks,
        views: selectedViewByStory.get(String(story._id)) ?? 0,
        rating: ratings.find(item => item._id.equals(story._id))?.average ?? null,
        metrics: {
          today: metricFor(0, story._id),
          week: metricFor(1, story._id),
          month: metricFor(2, story._id),
          sincePublication: story.publishedAt
            ? sincePublicationMetrics.get(String(story._id))
            : null,
          selected: {
            views: selectedViewByStory.get(String(story._id)) ?? 0,
            earnings: revenue.amount,
            unlocks: revenue.unlocks,
          },
        },
      }
    })
    .sort(
      (a, b) => b.earnings - a.earnings || b.views - a.views || (b.rating ?? 0) - (a.rating ?? 0),
    )
    .map((story, index, list) => ({ ...story, rank: index + 1, rankTotal: list.length }))
  return {
    stats: {
      views: views.reduce((sum, row) => sum + row.count, 0),
      audioPlays: null,
      followers: followers.length,
      periodViews: selectedViews.reduce((sum, row) => sum + row.count, 0),
      periodUnlocks: selectedRevenue.unlocks,
      periodComments: selectedComments,
      periodEarnings: selectedRevenue.total,
    },
    period: {
      days: selectedWindow.days,
      start: selectedWindow.startDay,
      end: selectedWindow.endDay,
    },
    revenue: {
      selected: selectedRevenue.total,
      today: revenueByWindow[0].total,
      week: revenueByWindow[1].total,
      month: revenueByWindow[2].total,
      selectedUnlocks: selectedRevenue.unlocks,
    },
    storyRankings: storyRows,
    stories: stories.map(story => ({
      id: String(story._id),
      title: story.title,
      status: story.publicationStatus,
      chapters: chapters.filter(chapter => chapter.storyId.equals(story._id)).length,
      reads: String(views.find(item => item._id.equals(story._id))?.count ?? 0),
      rating: ratings.find(item => item._id.equals(story._id))?.average?.toFixed(1) ?? '—',
      earnings: storyRows.find(item => item.id === String(story._id))?.earnings ?? 0,
      periodViews: selectedViewByStory.get(String(story._id)) ?? 0,
      metrics: storyRows.find(item => item.id === String(story._id))?.metrics ?? null,
      publishedAt: story.publishedAt ?? null,
    })),
    drafts: validDrafts.slice(0, 2),
    draftCount: validDrafts.length,
    draftWords: validDrafts.reduce((sum, item) => sum + item.written, 0),
    feedback: [...feedback, ...chapterFeedback]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2)
      .map(comment => {
        const chapter =
          comment.targetType === 'chapter'
            ? chapters.find(item => item._id.equals(comment.targetId))
            : null
        const story = stories.find(item =>
          comment.targetType === 'story'
            ? item._id.equals(comment.targetId)
            : chapter?.storyId.equals(item._id),
        )
        return {
          id: String(comment._id),
          targetType: comment.targetType,
          targetId: String(comment.targetId),
          storyId: story ? String(story._id) : null,
          chapterId: chapter ? String(chapter._id) : null,
          author:
            comment.authorAccountId?.status === 'active'
              ? comment.authorAccountId.displayName
              : 'Tài khoản đã ngừng hoạt động',
          canReply: Boolean(story?.publicationStatus === 'published'),
          body: comment.body,
          createdAt: comment.createdAt,
        }
      }),
    feedbackTotal: feedbackTotal + chapterFeedbackTotal,
    writingGoal: null,
    writingStreak: null,
    ai: null,
    guild: null,
  }
}
