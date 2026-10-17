import { Chapter, Story, StatisticsEvent, ReadingProgress } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';
import { authorCohortRetention } from './author-cohort-retention.js';

export async function authorAnalytics(
  accountId,
  { days = 30, storyId, chapterId } = {},
  now = new Date(),
) {
  const stories = await Story.find({ authorAccountId: accountId })
    .sort({ updatedAt: -1 })
    .select('title')
    .lean();
  if (storyId && !stories.some((story) => String(story._id) === storyId))
    throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
  if (chapterId && !storyId)
    throw new HttpError(400, 'validation_error', 'Cần chọn truyện trước khi lọc chương.');
  const chapters = storyId
    ? await Chapter.find({
        storyId,
        'publicationTransition.result': { $ne: 'author-draft-deleted' },
      })
        .sort({ orderKey: 1, _id: 1 })
        .select('title orderKey')
        .lean()
    : [];
  const selectedChapter = chapters.find((chapter) => String(chapter._id) === chapterId);
  if (chapterId && !selectedChapter)
    throw new HttpError(404, 'not_found', 'Không tìm thấy chương trong truyện.');
  // Calendar days in Vietnam. UTC arithmetic runs on the shifted calendar, avoiding host timezone differences.
  const today = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const labels = Array.from({ length: days }, (_, index) =>
    new Date(Date.parse(`${today}T00:00:00Z`) - (days - index - 1) * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const selected = stories
    .filter((story) => !storyId || String(story._id) === storyId)
    .map((story) => story._id);
  const match = {
    storyId: { $in: selected },
    eventType: 'view',
    ...(selectedChapter ? { chapterId: selectedChapter._id } : {}),
    day: { $gte: labels[0], $lte: today },
  };
  const progressStart = new Date(`${labels[0]}T00:00:00+07:00`);
  const [daily, readers, cohortRetention, progress] = await Promise.all([
    StatisticsEvent.aggregate([{ $match: match }, { $group: { _id: '$day', count: { $sum: 1 } } }]),
    StatisticsEvent.aggregate([
      { $match: match },
      { $group: { _id: { type: '$viewerType', key: '$viewerKey' }, days: { $addToSet: '$day' } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          accounts: { $sum: { $cond: [{ $eq: ['$_id.type', 'account'] }, 1, 0] } },
          guestDevices: { $sum: { $cond: [{ $eq: ['$_id.type', 'guest-device'] }, 1, 0] } },
          returning: { $sum: { $cond: [{ $gte: [{ $size: '$days' }, 2] }, 1, 0] } },
        },
      },
    ]),
    authorCohortRetention(match, labels[0], today),
    ReadingProgress.aggregate([
      {
        $match: {
          storyId: { $in: selected },
          mode: 'text',
          ...(selectedChapter ? { chapterId: selectedChapter._id } : {}),
          position: { $gte: 0, $lte: 1 },
          lastReadAt: { $gte: progressStart, $lte: now },
        },
      },
      {
        $lookup: {
          from: Chapter.collection.name,
          localField: 'chapterId',
          foreignField: '_id',
          pipeline: [
            { $match: { 'publicationTransition.result': { $ne: 'author-draft-deleted' } } },
            { $project: { storyId: 1 } },
          ],
          as: 'chapter',
        },
      },
      { $match: { $expr: { $eq: ['$storyId', { $arrayElemAt: ['$chapter.storyId', 0] }] } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$position', 1] },
                    { $eq: [{ $type: '$completedAt' }, 'date'] },
                    { $gte: ['$completedAt', progressStart] },
                    { $lte: ['$completedAt', now] },
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
  ]);
  const counts = labels.map((day) => daily.find((item) => item._id === day)?.count ?? 0);
  const readerCount = readers[0]?.count ?? 0;
  const returningReaders = readers[0]?.returning ?? 0;
  return {
    stories: stories.map((story) => ({ id: String(story._id), title: story.title })),
    chapters: chapters.map((chapter) => ({
      id: String(chapter._id),
      title: chapter.title,
      number: chapter.orderKey,
    })),
    daily: counts,
    labels,
    reads: counts.reduce((sum, count) => sum + count, 0),
    readers: readerCount,
    audience: { accounts: readers[0]?.accounts ?? 0, guestDevices: readers[0]?.guestDevices ?? 0 },
    returningReaders,
    returnRate: readerCount ? (returningReaders / readerCount) * 100 : null,
    cohortRetention,
    completionProgress: {
      total: progress[0]?.total ?? 0,
      completed: progress[0]?.completed ?? 0,
      rate: progress[0]?.total ? (progress[0].completed / progress[0].total) * 100 : null,
    },
    completion: null,
    earnings: null,
    formats: null,
    retention: null,
    channels: null,
    devices: null,
  };
}
