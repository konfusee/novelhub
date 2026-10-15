import { describe, expect, it } from 'vitest';
import { seedReferenceData } from '../seed/seed-reference-data.js';
import { Account, Category, Story, Wallet, LedgerEntry } from '../src/models/index.js';
import { useTestDatabase } from './db.js';
import { catalogPresentation } from '../src/modules/catalog-presentation.js';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { testConfig } from './config.js';
import { issueSession } from '../src/auth/session.js';
useTestDatabase();
describe('reference data import into existing schemas', () => {
  it('imports relational data and presentation metadata, then reruns without duplicates or overwrites', async () => {
    const input = { password: 'ReferenceTest-2026!' };
    const first = await seedReferenceData(input);
    expect(first.stories).toBeGreaterThan(10);
    expect(await Category.countDocuments()).toBe(9);
    const forest = await Story.findOne({ title: 'The Silent Forest' });
    expect(forest.publishedRevisionId).toBeTruthy();
    const app = createApp(testConfig());
    const reader = await Account.findOne({ email: 'reader@seed.novelhub.local' });
    const { token } = await issueSession(reader, 1);
    const cookie = `novelhub_session=${token}`;
    const history = await request(app).get('/api/reader/history').set('Cookie', cookie);
    expect(history.status).toBe(200);
    expect(history.body.items).toHaveLength(6);
    expect(history.body.stats.genres.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
    expect(
      (await request(app).get('/api/reader/balance').set('Cookie', cookie)).body.readerCoins,
    ).toBe(1420);
    const legacy = await request(app).get('/api/catalog/stories/demo');
    expect(legacy.status).toBe(200);
    expect(legacy.body.story.id).toBe(String(forest._id));
    expect(legacy.body.story.ratings).toBe(0);
    expect(legacy.body.story.ratingBreakdown).toEqual([0, 0, 0, 0, 0]);
    const chapter = legacy.body.chapters.find((item) => item.orderKey === 1);
    expect(chapter).toBeTruthy();
    const preview = await request(app).get('/api/catalog/stories/demo/chapters/chapter-1');
    expect(preview.status).toBe(200);
    expect(preview.body.chapter.id).toBe(chapter.id);
    expect(preview.body.chapter.blocks.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/catalog/stories/demo/chapters/chapter-999')).status).toBe(
      404,
    );
    const category = await Category.findOne({ name: 'Kỳ ảo' });
    expect((await catalogPresentation().findOne({ _id: category._id })).icon).toBe('Sparkles');
    const accountCount = await Account.countDocuments();
    const stories = await Story.countDocuments();
    const wallets = await Wallet.find().lean();
    for (const wallet of wallets) {
      const entries = await LedgerEntry.find({ walletId: wallet._id }).lean();
      expect(
        entries.reduce(
          (sum, item) => sum + (item.direction === 'credit' ? item.amount : -item.amount),
          0,
        ),
      ).toBe(wallet.availableBalance);
    }
    forest.title = 'Tên do người dùng sửa';
    await forest.save();
    expect(await seedReferenceData(input)).toEqual({});
    expect(await Account.countDocuments()).toBe(accountCount);
    expect(await Story.countDocuments()).toBe(stories);
    expect((await Story.findById(forest._id)).title).toBe('Tên do người dùng sửa');
  });
});
