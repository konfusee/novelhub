import {
  Chapter,
  Comment,
  Follow,
  LedgerEntry,
  Rating,
  Story,
  StatisticsEvent,
  ReadingProgress,
  UnlockEntitlement,
  Wallet,
} from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { authorCohortRetention } from './author-cohort-retention.js'
export async function authorAnalytics(
  accountId,
  { days = 30, storyId, chapterId, from, to, groupBy = 'day' } = {},
  now = new Date(),
) {
  const stories = await Story.find({
    authorAccountId: accountId,
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  })
    .sort({
      updatedAt: -1,
    })
    .select('title')
    .lean()
  if (storyId && !stories.some(story => String(story._id) === storyId))
    throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.')
  if (chapterId && !storyId)
    throw new HttpError(400, 'validation_error', 'Cần chọn truyện trước khi lọc chương.')
  const chapters = storyId
    ? await Chapter.find({
        storyId,
        'publicationTransition.result': {
          $ne: 'author-draft-deleted',
        },
      })
        .sort({
          orderKey: 1,
          _id: 1,
        })
        .select('title orderKey')
        .lean()
    : []
  const selectedChapter = chapters.find(chapter => String(chapter._id) === chapterId)
  if (chapterId && !selectedChapter)
    throw new HttpError(404, 'not_found', 'Không tìm thấy chương trong truyện.')
  // Calendar days in Vietnam. UTC arithmetic runs on the shifted calendar, avoiding host timezone differences.
  const today = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const endDay = to && to < today ? to : today
  const startDay =
    from ??
    new Date(Date.parse(`${endDay}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10)
  if (startDay > endDay)
    throw new HttpError(400, 'validation_error', 'Khoảng thời gian thống kê không hợp lệ.')
  const spanDays =
    Math.floor(
      (Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86400000,
    ) + 1
  if (spanDays > 366)
    throw new HttpError(400, 'validation_error', 'Khoảng thời gian thống kê tối đa 366 ngày.')
  const dayLabels = []
  for (
    let cursor = Date.parse(`${startDay}T00:00:00Z`), end = Date.parse(`${endDay}T00:00:00Z`);
    cursor <= end;
    cursor += 86400000
  )
    dayLabels.push(new Date(cursor).toISOString().slice(0, 10))
  const groupKey = day => {
    if (groupBy === 'month') return day.slice(0, 7)
    if (groupBy === 'week') {
      const date = new Date(`${day}T00:00:00Z`)
      const offset = (date.getUTCDay() + 6) % 7
      return new Date(date.getTime() - offset * 86400000).toISOString().slice(0, 10)
    }
    return day
  }
  const labels = [...new Set(dayLabels.map(groupKey))]
  const selected = stories
    .filter(story => !storyId || String(story._id) === storyId)
    .map(story => story._id)
  const selectedChapters = selectedChapter
    ? [selectedChapter._id]
    : await Chapter.find({
        storyId: { $in: selected },
        'publicationTransition.result': { $ne: 'author-draft-deleted' },
      })
        .select('_id')
        .lean()
        .then(rows => rows.map(row => row._id))
  const match = {
    storyId: {
      $in: selected,
    },
    eventType: 'view',
    chapterId: { $in: selectedChapters },
    day: { $gte: startDay, $lte: endDay },
  }
  const progressStart = new Date(`${startDay}T00:00:00+07:00`)
  const rangeEnd = new Date(`${endDay}T23:59:59.999+07:00`)
  const range = { $gte: progressStart, $lte: rangeEnd < now ? rangeEnd : now }
  const [
    daily,
    readers,
    cohortRetention,
    progress,
    followers,
    ratings,
    unlocks,
    earnings,
    comments,
  ] = await Promise.all([
    StatisticsEvent.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: '$day',
          count: {
            $sum: 1,
          },
        },
      },
    ]),
    StatisticsEvent.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: {
            type: '$viewerType',
            key: '$viewerKey',
          },
          days: {
            $addToSet: '$day',
          },
        },
      },
      {
        $group: {
          _id: null,
          count: {
            $sum: 1,
          },
          accounts: {
            $sum: {
              $cond: [
                {
                  $eq: ['$_id.type', 'account'],
                },
                1,
                0,
              ],
            },
          },
          guestDevices: {
            $sum: {
              $cond: [
                {
                  $eq: ['$_id.type', 'guest-device'],
                },
                1,
                0,
              ],
            },
          },
          returning: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    {
                      $size: '$days',
                    },
                    2,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    authorCohortRetention(match, startDay, endDay),
    ReadingProgress.aggregate([
      {
        $match: {
          storyId: {
            $in: selected,
          },
          mode: 'text',
          ...(selectedChapter
            ? {
                chapterId: selectedChapter._id,
              }
            : {}),
          position: {
            $gte: 0,
            $lte: 1,
          },
          lastReadAt: {
            ...range,
          },
        },
      },
      {
        $lookup: {
          from: Chapter.collection.name,
          localField: 'chapterId',
          foreignField: '_id',
          pipeline: [
            {
              $match: {
                'publicationTransition.result': {
                  $ne: 'author-draft-deleted',
                },
              },
            },
            {
              $project: {
                storyId: 1,
              },
            },
          ],
          as: 'chapter',
        },
      },
      {
        $match: {
          $expr: {
            $eq: [
              '$storyId',
              {
                $arrayElemAt: ['$chapter.storyId', 0],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: 1,
          },
          completed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$position', 1],
                    },
                    {
                      $eq: [
                        {
                          $type: '$completedAt',
                        },
                        'date',
                      ],
                    },
                    {
                      $gte: ['$completedAt', progressStart],
                    },
                    {
                      $lte: ['$completedAt', now],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Follow.countDocuments({ storyId: { $in: selected }, status: 'active' }),
    Rating.aggregate([
      { $match: { storyId: { $in: selected }, status: 'active' } },
      { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } },
    ]),
    UnlockEntitlement.countDocuments({
      chapterId: { $in: selectedChapters },
      purchasedAt: range,
    }),
    (async () => {
      const wallet = await Wallet.findOne({
        ownerType: 'account',
        ownerId: accountId,
        purpose: 'author-earnings',
      })
        .select('_id')
        .lean()
      if (!wallet) return 0
      const [row] = await LedgerEntry.aggregate([
        {
          $match: {
            walletId: wallet._id,
            ledgerType: 'allocation-credit',
            direction: 'credit',
            sourceType: 'UnlockRequest',
            occurredAt: range,
          },
        },
        {
          $lookup: {
            from: 'unlockRequests',
            localField: 'sourceId',
            foreignField: '_id',
            as: 'unlockRequest',
          },
        },
        { $unwind: '$unlockRequest' },
        { $match: { 'unlockRequest.chapterId': { $in: selectedChapters } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ])
      return row?.amount ?? 0
    })(),
    Comment.aggregate([
      {
        $match: {
          $or: [
            { targetType: 'story', targetId: { $in: selected } },
            { targetType: 'chapter', targetId: { $in: selectedChapters } },
          ],
          createdAt: range,
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ])
  const countsByGroup = new Map()
  for (const item of daily) {
    const key = groupKey(item._id)
    countsByGroup.set(key, (countsByGroup.get(key) ?? 0) + item.count)
  }
  const counts = labels.map(label => countsByGroup.get(label) ?? 0)
  const readerCount = readers[0]?.count ?? 0
  const returningReaders = readers[0]?.returning ?? 0
  return {
    stories: stories.map(story => ({
      id: String(story._id),
      title: story.title,
    })),
    chapters: chapters.map(chapter => ({
      id: String(chapter._id),
      title: chapter.title,
      number: chapter.orderKey,
    })),
    daily: counts,
    labels,
    reads: counts.reduce((sum, count) => sum + count, 0),
    readers: readerCount,
    audience: {
      accounts: readers[0]?.accounts ?? 0,
      guestDevices: readers[0]?.guestDevices ?? 0,
    },
    returningReaders,
    returnRate: readerCount ? (returningReaders / readerCount) * 100 : null,
    cohortRetention,
    completionProgress: {
      total: progress[0]?.total ?? 0,
      completed: progress[0]?.completed ?? 0,
      rate: progress[0]?.total ? (progress[0].completed / progress[0].total) * 100 : null,
    },
    followers,
    rating: {
      average: ratings[0]?.average == null ? null : Math.round(ratings[0].average * 10) / 10,
      count: ratings[0]?.count ?? 0,
    },
    paidUnlocks: unlocks,
    earnings,
    comments: Object.fromEntries(comments.map(item => [item._id, item.count])),
    groupBy,
    completion: null,
    formats: null,
    retention: null,
    channels: null,
    devices: null,
  }
}
