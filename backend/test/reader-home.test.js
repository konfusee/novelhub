import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Category,
  Chapter,
  ContentRevision,
  Follow,
  ReadingProgress,
  Story,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const get = (path, cookie) => request(app).get(`/api/reader/${path}`).set('Cookie', cookie);
async function published(author, category, number = 1) {
  const story = await Story.create({
    title: 'SECRET draft',
    authorAccountId: author._id,
    categoryIds: [category._id],
    publicationStatus: 'published',
    publishedAt: new Date(),
  });
  const revision = await ContentRevision.create({
    storyId: story._id,
    authorAccountId: author._id,
    contentType: 'story',
    revisionNumber: 1,
    status: 'approved',
    formatVersion: 'story-v1',
    content: { title: `Public ${number}`, categoryIds: [String(category._id)] },
  });
  story.publishedRevisionId = revision._id;
  await story.save();
  const chapter = await Chapter.create({
    storyId: story._id,
    title: 'SECRET chapter draft',
    orderKey: 7,
    status: 'published',
    publishedAt: new Date(),
  });
  const chapterRevision = await ContentRevision.create({
    storyId: story._id,
    chapterId: chapter._id,
    authorAccountId: author._id,
    contentType: 'chapter',
    revisionNumber: 1,
    status: 'approved',
    formatVersion: 'blocks-v1',
    content: { title: `Published chapter ${number}`, blocks: [] },
  });
  chapter.publishedRevisionId = chapterRevision._id;
  await chapter.save();
  return { story, chapter, revision: chapterRevision };
}
describe('reader home and following from MongoDB', () => {
  it('requires authentication and returns genuine empty/unknown metrics', async () => {
    expect((await request(app).get('/api/reader/home')).status).toBe(401);
    const reader = await authenticatedAccount();
    const home = (await get('home', reader.cookie)).body;
    expect(home).toMatchObject({
      continuing: [],
      recommendations: [],
      picks: [],
      updates: [],
      releases: [],
      nowPlaying: null,
      todayChapters: 0,
      dailyGoal: null,
      streak: null,
    });
    expect(home.activity).toHaveLength(7);
    expect(home.activity.some((day) => day.active)).toBe(false);
    expect((await get('following', reader.cookie)).body).toMatchObject({
      savedStories: [],
      collections: [],
      authors: [],
    });
    expect((await get('home?picksPage=0', reader.cookie)).status).toBe(400);
  });
  it('isolates reading/follows by owner and returns only published chapter titles and exact resume IDs', async () => {
    const author = await authenticatedAccount('author');
    const reader = await authenticatedAccount();
    const other = await authenticatedAccount();
    const category = await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'kỳ ảo',
      createdBy: author.account._id,
    });
    const { story, chapter, revision } = await published(author.account, category);
    await Follow.create({ accountId: reader.account._id, storyId: story._id });
    await ReadingProgress.create({
      accountId: reader.account._id,
      storyId: story._id,
      chapterId: chapter._id,
      revisionId: revision._id,
      mode: 'text',
      position: 0.65,
      lastReadAt: new Date(),
    });
    const home = (await get('home', reader.cookie)).body;
    expect(home.continuing[0]).toMatchObject({
      id: String(story._id),
      chapterId: String(chapter._id),
      progress: 65,
      saved: true,
    });
    expect(home.updates[0]).toMatchObject({ chapter: 'Published chapter 1', number: 7 });
    expect(home.todayChapters).toBe(1);
    expect(home.picksGenre).toBe('Kỳ ảo');
    expect(home.recommendations[0].saved).toBe(true);
    expect(JSON.stringify(home)).not.toContain('SECRET');
    const following = (await get('following', reader.cookie)).body;
    expect(following.savedStories[0]).toMatchObject({
      id: String(story._id),
      chapterId: String(chapter._id),
      latestChapterTitle: 'Published chapter 1',
      favorite: null,
      alerts: null,
    });
    expect(following.collections[0]).toMatchObject({ title: 'Kỳ ảo', count: 1 });
    expect(following.capabilities).toMatchObject({
      favorites: false,
      authorFollowing: false,
      weeklyGoal: false,
    });
    expect((await get('home', other.cookie)).body).toMatchObject({
      continuing: [],
      updates: [],
      todayChapters: 0,
    });
    expect((await get('following', other.cookie)).body.savedStories).toEqual([]);
    await ReadingProgress.updateOne(
      { accountId: reader.account._id },
      { $set: { revisionId: story.publishedRevisionId } },
    );
    expect((await get('home', reader.cookie)).body.continuing).toEqual([]);
    expect((await get('history', reader.cookie)).body.items).toEqual([]);
  });
  it('refreshes recommendations with real database pagination rather than rotating fixtures', async () => {
    const author = await authenticatedAccount('author');
    const reader = await authenticatedAccount();
    const category = await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'kỳ ảo',
      createdBy: author.account._id,
    });
    for (let index = 0; index < 5; index++) await published(author.account, category, index);
    const first = (await get('home?picksPage=1', reader.cookie)).body;
    const second = (await get('home?picksPage=2', reader.cookie)).body;
    expect(first.picksPageCount).toBe(2);
    expect(first.picks).toHaveLength(3);
    expect(second.picks).toHaveLength(2);
    expect(new Set([...first.picks, ...second.picks].map((item) => item.id)).size).toBe(5);
    expect(first.recommendations).toHaveLength(4);
  });
});
