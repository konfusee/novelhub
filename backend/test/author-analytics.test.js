import request from 'supertest';
import { Types } from 'mongoose';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Category, Story, StatisticsEvent, Chapter, ReadingProgress } from '../src/models/index.js';
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
  expect(result.audience).toEqual({ accounts: 1, guestDevices: 1 });
  expect(result.returningReaders).toBe(1);
  expect(result.returnRate).toBe(50);
  expect(result.retention).toBeNull();
  expect(result.earnings).toBeNull();
  expect(result.verifiedUnlockIncome).toBe(0);
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
it('filters actual views and distinct readers by an owned chapter without changing source events', async () => {
  const author = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Phân tích',
    normalizedName: 'phân tích',
    createdBy: author.account._id,
  });
  const story = await Story.create({
    title: 'Truyện có hai chương',
    authorAccountId: author.account._id,
    categoryIds: [category._id],
  });
  const [one, two, empty] = await Chapter.create(
    [1, 2, 3].map((number) => ({
      storyId: story._id,
      title: `Nội dung ${number}`,
      orderKey: number,
    })),
  );
  const event = (key, chapter, viewerKey, viewerType = 'account', day = '2026-10-16') => ({
    sourceEventKey: key,
    eventType: 'view',
    storyId: story._id,
    chapterId: chapter._id,
    viewerType,
    viewerKey,
    day,
    occurredAt: new Date(`${day}T00:00:00Z`),
  });
  await Chapter.create({
    storyId: story._id,
    title: 'Nháp đã xóa',
    orderKey: 4,
    status: 'archived',
    publicationTransition: { result: 'author-draft-deleted' },
  });
  await StatisticsEvent.create([
    event('one-account', one, 'private-shared'),
    event('one-guest', one, 'private-shared', 'guest-device'),
    event('two-account', two, 'private-shared'),
    event('two-other', two, 'private-other'),
    event('old', one, 'old', 'account', '2026-10-01'),
    event('future', one, 'future', 'account', '2026-10-18'),
    {
      sourceEventKey: 'earning',
      eventType: 'earning',
      storyId: story._id,
      chapterId: one._id,
      day: '2026-10-16',
      occurredAt: new Date('2026-10-16'),
    },
  ]);
  const now = new Date('2026-10-16T12:00:00Z');
  const all = await authorAnalytics(author.account._id, { days: 7, storyId: story.id }, now);
  expect(all).toMatchObject({ reads: 4, readers: 3 });
  expect(all.chapters).toEqual(
    [one, two, empty].map((c) => ({ id: c.id, title: c.title, number: c.orderKey })),
  );
  const filtered = await authorAnalytics(
    author.account._id,
    { days: 7, storyId: story.id, chapterId: one.id },
    now,
  );
  expect(filtered).toMatchObject({
    reads: 2,
    readers: 2,
    daily: [0, 0, 0, 0, 0, 0, 2],
    retention: null,
    earnings: null,
  });
  expect(JSON.stringify(filtered)).not.toContain('private-shared');
  expect(
    (
      await authorAnalytics(
        author.account._id,
        { days: 7, storyId: story.id, chapterId: empty.id },
        now,
      )
    ).daily,
  ).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect((await authorAnalytics(author.account._id, { days: 7 }, now)).chapters).toEqual([]);
  expect(await StatisticsEvent.countDocuments()).toBe(7);
});
it('rejects cross-story and foreign chapters, malformed filters and chapter-only requests', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Kiểm tra',
    normalizedName: 'kiểm tra',
    createdBy: author.account._id,
  });
  const create = (owner, title) =>
    Story.create({ title, authorAccountId: owner._id, categoryIds: [category._id] });
  const a = await create(author.account, 'Truyện A'),
    b = await create(author.account, 'Truyện B'),
    foreign = await create(other.account, 'Truyện riêng');
  const chapter = await Chapter.create({ storyId: b._id, title: 'Chương B', orderKey: 1 });
  const hidden = await Chapter.create({
    storyId: foreign._id,
    title: 'Không được lộ',
    orderKey: 1,
  });
  const get = (query) =>
    request(app).get(`/api/author/analytics?${query}`).set('Cookie', author.cookie);
  expect((await get(`chapterId=${chapter.id}`)).status).toBe(400);
  expect((await get(`storyId=${a.id}&chapterId=bad`)).status).toBe(400);
  expect((await get(`storyId=${a.id}&chapterId=${chapter.id}`)).status).toBe(404);
  expect((await get(`storyId=${a.id}&chapterId=${hidden.id}`)).status).toBe(404);
  expect((await get(`storyId=${foreign.id}&chapterId=${hidden.id}`)).status).toBe(404);
  const response = await get(`storyId=${b.id}&chapterId=${chapter.id}&days=7`);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.body.chapters.map((c) => c.title)).toEqual(['Chương B']);
  expect(JSON.stringify(response.body)).not.toContain('Không được lộ');
  expect(response.body.reads).toBe(0);
});
it('counts returners on distinct days, separates guest/account identities and respects chapter scope', async () => {
  const author = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Quay lại',
    normalizedName: 'quay lại',
    createdBy: author.account._id,
  });
  const story = await Story.create({
    title: 'Truyện',
    authorAccountId: author.account._id,
    categoryIds: [category._id],
  });
  const [one, two, empty] = await Chapter.create(
    [1, 2, 3].map((orderKey) => ({ storyId: story._id, title: `Chương ${orderKey}`, orderKey })),
  );
  const event = (key, chapter, day, viewerKey, viewerType = 'account') => ({
    sourceEventKey: key,
    eventType: 'view',
    storyId: story._id,
    chapterId: chapter._id,
    day,
    viewerType,
    viewerKey,
    occurredAt: new Date(`${day}T00:00:00Z`),
  });
  await StatisticsEvent.create([
    event('a1', one, '2026-10-15', 'private-a'),
    event('a2', two, '2026-10-15', 'private-a'),
    event('a3', two, '2026-10-16', 'private-a'),
    event('g1', one, '2026-10-15', 'private-a', 'guest-device'),
    event('g2', one, '2026-10-16', 'private-a', 'guest-device'),
    event('b1', one, '2026-10-16', 'private-b'),
    event('b-old', one, '2026-10-01', 'private-b'),
    event('b-future', one, '2026-10-18', 'private-b'),
  ]);
  const now = new Date('2026-10-16T12:00:00Z');
  const read = (chapterId) =>
    authorAnalytics(author.account._id, { days: 7, storyId: story.id, chapterId }, now);
  const all = await read();
  expect(all).toMatchObject({ readers: 3, returningReaders: 2 });
  expect(all.returnRate).toBeCloseTo(200 / 3);
  expect((await read(one.id)).returnRate).toBeCloseTo(100 / 3);
  expect(await read(two.id)).toMatchObject({ readers: 1, returningReaders: 1, returnRate: 100 });
  expect(await read(empty.id)).toMatchObject({ readers: 0, returningReaders: 0, returnRate: null });
  expect(JSON.stringify(all)).not.toContain('private-a');
  expect(await StatisticsEvent.countDocuments()).toBe(8);
});

it('measures only current text progress active in the Vietnam range without changing or exposing source rows', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Completion',
    normalizedName: 'completion',
    createdBy: author.account._id,
  });
  const story = await Story.create({
    title: 'Completion',
    authorAccountId: author.account._id,
    categoryIds: [category._id],
  });
  const foreign = await Story.create({
    title: 'Foreign',
    authorAccountId: other.account._id,
    categoryIds: [category._id],
  });
  const [one, two, deleted] = await Chapter.create(
    [1, 2, 3].map((orderKey) => ({
      title: 'Chapter ' + orderKey,
      storyId: story._id,
      orderKey,
      ...(orderKey === 3 ? { publicationTransition: { result: 'author-draft-deleted' } } : {}),
    })),
  );
  const now = new Date('2026-10-16T12:00:00Z');
  const start = new Date('2026-10-09T17:00:00Z');
  const make = (extra = {}) => ({
    accountId: new Types.ObjectId(),
    storyId: story._id,
    chapterId: one._id,
    mode: 'text',
    position: 0.5,
    lastReadAt: now,
    ...extra,
  });
  await ReadingProgress.create([
    make({ position: 1, completedAt: now }),
    make({ lastReadAt: start }),
    make({ chapterId: two._id, position: 1, completedAt: new Date(now.getTime() + 1) }),
    make({ mode: 'audio', position: 1, completedAt: now }),
    make({ lastReadAt: new Date(start.getTime() - 1) }),
    make({ lastReadAt: new Date(now.getTime() + 1) }),
    make({ chapterId: deleted._id }),
    make({ chapterId: new Types.ObjectId() }),
    make({ storyId: foreign._id }),
    make({ position: 2 }),
  ]);
  const before = await ReadingProgress.find().sort({ _id: 1 }).lean();
  const result = await authorAnalytics(
    author.account._id,
    { days: 7, storyId: String(story._id) },
    now,
  );
  expect(result.completionProgress).toMatchObject({ total: 3, completed: 1 });
  expect(result.completionProgress.rate).toBeCloseTo(33.333333333, 8);
  const selected = await authorAnalytics(
    author.account._id,
    { days: 7, storyId: String(story._id), chapterId: String(two._id) },
    now,
  );
  expect(selected.completionProgress).toEqual({ total: 1, completed: 0, rate: 0 });
  const empty = await authorAnalytics(other.account._id, {}, now);
  expect(empty.completionProgress).toEqual({ total: 0, completed: 0, rate: null });
  expect(JSON.stringify(result)).not.toContain(String(before[0].accountId));
  expect(await ReadingProgress.find().sort({ _id: 1 }).lean()).toEqual(before);
});

it('measures exact day-1/day-7 returns only for mature new cohorts using all scoped history', async () => {
  const author = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Cohort',
    normalizedName: 'cohort',
    createdBy: author.account._id,
  });
  const story = await Story.create({
    title: 'Cohort',
    authorAccountId: author.account._id,
    categoryIds: [category._id],
  });
  const [one, two] = await Chapter.create(
    [1, 2].map((orderKey) => ({ storyId: story._id, title: 'Chapter ' + orderKey, orderKey })),
  );
  let sequence = 0;
  const event = (key, day, chapterId = one._id, viewerType = 'account') => ({
    sourceEventKey: 'cohort-' + sequence++,
    eventType: 'view',
    day,
    viewerType,
    viewerKey: key,
    storyId: story._id,
    chapterId,
    occurredAt: new Date(day + 'T00:00:00Z'),
  });
  await StatisticsEvent.create([
    event('private-cohort-a', '2026-10-08'),
    event('private-cohort-a', '2026-10-09'),
    event('private-cohort-a', '2026-10-15', two._id),
    event('private-cohort-a', '2026-10-16', two._id),
    event('b', '2026-10-08'),
    event('b', '2026-10-10'),
    event('b', '2026-10-16'),
    event('recent', '2026-10-16'),
    event('today', '2026-10-17'),
    event('future', '2026-10-20'),
    event('day1-only', '2026-10-15'),
    event('old', '2026-09-01'),
    event('old', '2026-10-08'),
    event('old', '2026-10-09'),
    event('private-cohort-a', '2026-10-08', one._id, 'guest-device'),
    event('private-cohort-a', '2026-10-09', one._id, 'guest-device'),
  ]);
  const before = await StatisticsEvent.find().sort({ _id: 1 }).lean();
  const now = new Date('2026-10-16T18:00:00Z');
  const report = await authorAnalytics(
    author.account._id,
    { days: 30, storyId: String(story._id) },
    now,
  );
  expect(report.cohortRetention[0]).toEqual({ day: 1, eligible: 4, returned: 2, rate: 50 });
  expect(report.cohortRetention[1]).toMatchObject({ day: 7, eligible: 3, returned: 1 });
  expect(report.cohortRetention[1].rate).toBeCloseTo(33.3333333, 6);
  const chapter = await authorAnalytics(
    author.account._id,
    { days: 30, storyId: String(story._id), chapterId: String(two._id) },
    now,
  );
  expect(chapter.cohortRetention).toEqual([
    { day: 1, eligible: 1, returned: 1, rate: 100 },
    { day: 7, eligible: 0, returned: 0, rate: null },
  ]);
  const short = await authorAnalytics(
    author.account._id,
    { days: 7, storyId: String(story._id) },
    now,
  );
  expect(short.cohortRetention).toEqual([
    { day: 1, eligible: 1, returned: 0, rate: 0 },
    { day: 7, eligible: 0, returned: 0, rate: null },
  ]);
  expect(JSON.stringify(report.cohortRetention)).not.toContain('private-cohort-a');
  expect(await StatisticsEvent.find().sort({ _id: 1 }).lean()).toEqual(before);
});
