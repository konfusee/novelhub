import request from 'supertest';
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { ContentRevision, StatisticsEvent, Story } from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';

useTestDatabase();
const app = createApp(testConfig());
describe('public MongoDB rankings', () => {
  it('validates filters and returns empty audio without invented plays', async () => {
    expect((await request(app).get('/api/catalog/rankings?period=invalid')).status).toBe(400);
    expect((await request(app).get('/api/catalog/rankings?category=audio')).body).toMatchObject({
      total: 0,
      items: [],
      podium: [],
      unavailable: 'audio',
    });
  });
  it('ranks approved snapshots by actual period views and paginates without repeating the podium', async () => {
    const { account } = await authenticatedAccount('author');
    const stories = [];
    for (let index = 0; index < 18; index += 1) {
      const story = await Story.create({
        title: 'SECRET draft',
        authorAccountId: account._id,
        publicationStatus: 'published',
        categoryIds: [new mongoose.Types.ObjectId()],
      });
      const revision = await ContentRevision.create({
        storyId: story._id,
        authorAccountId: account._id,
        contentType: 'story',
        revisionNumber: 1,
        status: 'approved',
        formatVersion: 'story-v1',
        content: { title: `Public ${index}`, categoryIds: [] },
      });
      story.publishedRevisionId = revision._id;
      await story.save();
      stories.push(story);
    }
    const now = new Date();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
    await StatisticsEvent.create({
      sourceEventKey: 'today',
      eventType: 'view',
      storyId: stories[0]._id,
      chapterId: new mongoose.Types.ObjectId(),
      viewerType: 'guest-device',
      viewerKey: 'today-reader',
      day,
      occurredAt: now,
    });
    await StatisticsEvent.create({
      sourceEventKey: 'old',
      eventType: 'view',
      storyId: stories[17]._id,
      chapterId: new mongoose.Types.ObjectId(),
      viewerType: 'guest-device',
      viewerKey: 'old-reader',
      day: '2001-01-01',
      occurredAt: new Date('2001-01-01'),
    });
    const first = (await request(app).get('/api/catalog/rankings?period=day')).body;
    expect(first.total).toBe(18);
    expect(first.podium[0]).toMatchObject({
      id: String(stories[0]._id),
      rank: 1,
      reads: '1',
      title: 'Public 0',
      change: null,
    });
    expect(
      [...first.podium, ...first.items].find((item) => item.id === String(stories[17]._id)).reads,
    ).toBe('0');
    expect(first.items).toHaveLength(12);
    const second = (await request(app).get('/api/catalog/rankings?period=day&page=2')).body;
    expect(second.items.map((item) => item.rank)).toEqual([16, 17, 18]);
    expect(second.podium).toEqual(first.podium);
    expect(
      new Set([...first.podium, ...first.items, ...second.items].map((item) => item.id)).size,
    ).toBe(18);
    expect(JSON.stringify(first)).not.toContain('SECRET');
    const all = (await request(app).get('/api/catalog/rankings?period=all')).body;
    expect(
      [...all.podium, ...all.items].find((item) => item.id === String(stories[17]._id)).reads,
    ).toBe('1');
  });
});
