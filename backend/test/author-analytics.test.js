import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Category, Story, StatisticsEvent, Chapter } from '../src/models/index.js';
import { authorAnalytics } from '../src/modules/author-analytics.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('counts actual daily events and distinct identities in the selected Vietnam calendar range', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const reader = await authenticatedAccount();
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  });
  const create = (account) =>
    Story.create({ title: 'Truyện', authorAccountId: account._id, categoryIds: [category._id] });
  const story = await create(author.account);
  const foreign = await create(other.account);
  const chapter = await Chapter.create({ storyId: story._id, title: 'Chương', orderKey: 1 });
  const event = (key, day, viewerKey, extra = {}) => ({
    sourceEventKey: key,
    eventType: 'view',
    day,
    viewerType: 'account',
    viewerKey,
    storyId: story._id,
    chapterId: chapter._id,
    occurredAt: new Date(`${day}T00:00:00Z`),
    ...extra,
  });
  await StatisticsEvent.create([
    event('one', '2026-10-15', 'private-account-key'),
    event('two', '2026-10-16', 'private-account-key'),
    event('three', '2026-10-16', 'private-device-key', { viewerType: 'guest-device' }),
    event('old', '2026-10-01', 'old'),
    event('foreign', '2026-10-16', 'other', { storyId: foreign._id }),
  ]);
  const result = await authorAnalytics(
    author.account._id,
    { days: 7, storyId: String(story._id) },
    new Date('2026-10-15T18:00:00Z'),
  );
  expect(result.labels).toEqual([
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
  ]);
  expect(result.daily).toEqual([0, 0, 0, 0, 0, 1, 2]);
  expect(result.reads).toBe(3);
  expect(result.readers).toBe(2);
  expect(result.retention).toBeNull();
  expect(result.earnings).toBeNull();
  expect(JSON.stringify(result)).not.toContain('private-account-key');
  const get = (query) =>
    request(app).get(`/api/author/analytics${query}`).set('Cookie', author.cookie);
  expect((await get(`?storyId=${foreign._id}`)).status).toBe(404);
  expect((await get('?days=8')).status).toBe(400);
  expect((await get('?days=7&owner=forged')).status).toBe(400);
  expect(
    (await request(app).get('/api/author/analytics').set('Cookie', reader.cookie)).status,
  ).toBe(403);
  expect((await request(app).get('/api/author/analytics')).status).toBe(401);
  expect((await get('?days=7')).status).toBe(200);
});
