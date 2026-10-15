import { Category } from '../models/index.js';
import { queryPublishedStories } from './catalog-query.js';
import { publishedChapters, readerHistory, readerLibrary } from './reader-collections.js';

export async function readerHome(accountId, picksPage = 1) {
  const [history, library, recommendations] = await Promise.all([
    readerHistory(accountId),
    readerLibrary(accountId),
    queryPublishedStories({ sort: 'reads', pageSize: 4 }),
  ]);
  const savedIds = new Set(library.items.map((item) => item.id));
  const withSaved = (item) => ({ ...item, saved: savedIds.has(item.id) });
  const textHistory = history.items.filter((item) => item.type === 'story');
  const seen = new Set();
  const continuing = textHistory
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 2)
    .map(withSaved);
  const genreCounts = new Map();
  for (const item of textHistory)
    for (const id of item.categoryIds) genreCounts.set(id, (genreCounts.get(id) ?? 0) + 1);
  const categoryId = [...genreCounts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];
  const category = categoryId
    ? await Category.findOne({ _id: categoryId, status: 'active' }).select('name').lean()
    : null;
  const picks = await queryPublishedStories({
    sort: 'newest',
    category: category ? categoryId : undefined,
    pageSize: 3,
    page: picksPage,
  });
  const chapters = await publishedChapters(library.items.map((item) => item.id));
  const cards = new Map(library.items.map((item) => [item.id, item]));
  const updates = chapters
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0) ||
        b.orderKey - a.orderKey ||
        String(b._id).localeCompare(String(a._id)),
    )
    .slice(0, 5)
    .map((chapter) => ({
      ...cards.get(String(chapter.storyId)),
      chapterId: String(chapter._id),
      chapter: chapter.publishedTitle,
      number: chapter.orderKey,
      publishedAt: chapter.publishedAt ?? null,
    }));
  const now = new Date();
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  const today = local.getTime() - 7 * 3600000;
  const monday = today - ((local.getUTCDay() + 6) % 7) * 86400000;
  const activity = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(monday + index * 86400000 + 7 * 3600000).toISOString().slice(0, 10),
    active: textHistory.some(
      (item) =>
        new Date(item.when).getTime() >= monday + index * 86400000 &&
        new Date(item.when).getTime() <
          Math.min(monday + (index + 1) * 86400000, now.getTime() + 1),
    ),
  }));
  return {
    continuing,
    recommendations: recommendations.items.map(withSaved),
    picks: picks.items.map(withSaved),
    picksGenre: category?.name ?? null,
    picksPage,
    picksPageCount: Math.max(1, Math.ceil(picks.total / 3)),
    updates,
    releases: [],
    nowPlaying: null,
    activity,
    todayChapters: textHistory.filter(
      (item) => new Date(item.when).getTime() >= today && new Date(item.when) <= now,
    ).length,
    dailyGoal: null,
    streak: null,
    timeTrackingAvailable: false,
    scheduleAvailable: false,
  };
}

export async function readerFollowing(accountId) {
  const [library, discovery] = await Promise.all([
    readerLibrary(accountId),
    queryPublishedStories({ pageSize: 24, sort: 'newest' }),
  ]);
  const chapters = await publishedChapters(library.items.map((item) => item.id));
  const savedStories = library.items
    .map((story) => {
      const latest = chapters
        .filter((item) => String(item.storyId) === story.id)
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0) || b.orderKey - a.orderKey,
        )[0];
      return {
        ...story,
        latestChapterTitle: latest?.publishedTitle ?? null,
        latestPublishedAt: latest?.publishedAt ?? null,
        favorite: null,
        alerts: null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latestPublishedAt ?? b.savedAt ?? 0) -
        new Date(a.latestPublishedAt ?? a.savedAt ?? 0),
    );
  const groups = new Map();
  for (const story of savedStories)
    for (const genre of story.genres) {
      if (!groups.has(genre)) groups.set(genre, { id: genre, title: genre, count: 0, story });
      groups.get(genre).count++;
    }
  const authors = [
    ...new Map(
      discovery.items
        .filter((item) => item.authorId)
        .map((story) => [
          story.authorId,
          { id: story.authorId, name: story.author, meta: story.genre, storyId: story.id },
        ]),
    ).values(),
  ].slice(0, 4);
  return {
    savedStories,
    collections: [...groups.values()],
    authors,
    capabilities: {
      authorFollowing: false,
      favorites: false,
      customCollections: false,
      alerts: false,
      weeklyGoal: false,
    },
  };
}
