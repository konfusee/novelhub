import { Chapter, ContentRevision, Follow, ReadingProgress } from '../models/index.js';
import { queryPublishedStories } from './catalog-query.js';

async function cardsFor(ids) {
  const unique = [...new Set(ids.map(String))];
  const cards = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    cards.push(
      ...(await queryPublishedStories({ ids: unique.slice(offset, offset + 100), pageSize: 100 }))
        .items,
    );
  }
  return cards;
}
async function publishedChapters(storyIds) {
  const chapters = await Chapter.find({
    storyId: { $in: storyIds },
    status: 'published',
    publishedRevisionId: { $ne: null },
  })
    .sort({ orderKey: 1 })
    .select('storyId orderKey publishedRevisionId')
    .lean();
  const revisions = await ContentRevision.find({
    _id: { $in: chapters.map((item) => item.publishedRevisionId) },
    contentType: 'chapter',
    status: { $in: ['approved', 'immutable'] },
  })
    .select('storyId chapterId')
    .lean();
  const byId = new Map(revisions.map((item) => [String(item._id), item]));
  return chapters.filter((item) => {
    const revision = byId.get(String(item.publishedRevisionId));
    return (
      revision &&
      String(revision.chapterId) === String(item._id) &&
      String(revision.storyId) === String(item.storyId)
    );
  });
}

export async function readerLibrary(accountId) {
  const follows = await Follow.find({ accountId, status: 'active' })
    .sort({ createdAt: -1 })
    .select('storyId createdAt')
    .lean();
  const cards = await cardsFor(follows.map((item) => item.storyId));
  const chapters = await publishedChapters(cards.map((item) => item.id));
  const progress = await ReadingProgress.find({
    accountId,
    storyId: { $in: cards.map((item) => item.id) },
    mode: 'text',
  })
    .sort({ lastReadAt: -1 })
    .lean();
  const weekAgo = Date.now() - 7 * 86400000;
  const items = cards
    .map((card) => {
      const available = chapters.filter((item) => String(item.storyId) === card.id);
      const reads = progress.filter(
        (item) =>
          String(item.storyId) === card.id &&
          available.some(
            (chapter) =>
              String(chapter._id) === String(item.chapterId) &&
              String(chapter.publishedRevisionId) === String(item.revisionId),
          ),
      );
      const latest = reads[0];
      const position = available.length
        ? Math.round(
            (100 *
              reads.reduce((sum, item) => sum + Math.min(1, Math.max(0, item.position ?? 0)), 0)) /
              available.length,
          )
        : 0;
      const chapter =
        available.find((item) => String(item._id) === String(latest?.chapterId)) ?? available[0];
      return {
        ...card,
        progress: position,
        status: position === 100 ? 'completed' : 'reading',
        type: 'story',
        chapterId: chapter ? String(chapter._id) : null,
        detail: chapter
          ? `Chương ${chapter.orderKey} / ${available.length} chương`
          : 'Chưa có chương đã xuất bản',
        activity: latest?.lastReadAt
          ? new Date(latest.lastReadAt).toLocaleDateString('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
            })
          : 'Chưa bắt đầu đọc',
        lastReadAt: latest?.lastReadAt ?? null,
        offline: false,
      };
    })
    .sort((a, b) => new Date(b.lastReadAt ?? 0) - new Date(a.lastReadAt ?? 0));
  return {
    items,
    activeThisWeek: items.filter((item) => new Date(item.lastReadAt ?? 0).getTime() >= weekAgo)
      .length,
  };
}

export async function readerHistory(accountId) {
  const records = await ReadingProgress.find({ accountId, lastReadAt: { $type: 'date' } })
    .sort({ lastReadAt: -1, _id: -1 })
    .lean();
  const cards = await cardsFor(records.map((item) => item.storyId));
  const byStory = new Map(cards.map((item) => [item.id, item]));
  const chapters = await publishedChapters(cards.map((item) => item.id));
  const byChapter = new Map(chapters.map((item) => [String(item._id), item]));
  const items = records.flatMap((record) => {
    const card = byStory.get(String(record.storyId));
    const chapter = byChapter.get(String(record.chapterId));
    if (!card || !chapter || String(chapter.storyId) !== card.id) return [];
    return [
      {
        ...card,
        historyId: String(record._id),
        chapterId: String(chapter._id),
        detail: `Chương ${chapter.orderKey}`,
        type: record.mode === 'audio' ? 'audio' : 'story',
        progress: Math.round(100 * Math.min(1, Math.max(0, record.position ?? 0))),
        when: record.lastReadAt,
        duration:
          record.duration == null
            ? 'Chưa ghi nhận thời lượng'
            : `${Math.round(record.duration / 60)} phút`,
        completedAt: record.completedAt ?? null,
      },
    ];
  });
  const localNow = new Date(Date.now() + 7 * 3600000);
  const month = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1) - 7 * 3600000,
  );
  const monthCompleted = new Set(
    items
      .filter((item) => item.completedAt && new Date(item.completedAt) >= month)
      .map((item) => item.chapterId),
  ).size;
  const genreCounts = new Map();
  for (const item of items)
    for (const genre of item.genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  const genreTotal = [...genreCounts.values()].reduce((sum, value) => sum + value, 0);
  const genres = [...genreCounts].map(([name, count]) => ({
    name,
    percent: Math.floor((100 * count) / genreTotal),
    fraction: ((100 * count) / genreTotal) % 1,
  }));
  const remainder = 100 - genres.reduce((sum, item) => sum + item.percent, 0);
  [...genres]
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, remainder)
    .forEach((item) => item.percent++);
  return {
    items,
    stats: {
      activeStories: new Set(items.filter((item) => item.progress < 100).map((item) => item.id))
        .size,
      monthCompleted,
      audioHours: null,
      streak: null,
      weekly: { week: [0, 0, 0, 0, 0, 0, 0], last: [0, 0, 0, 0, 0, 0, 0] },
      genres: genres.map(({ name, percent }) => ({ name, percent })),
      monthlyTarget: null,
      timeTrackingAvailable: false,
    },
  };
}
