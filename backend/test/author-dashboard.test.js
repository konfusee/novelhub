import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Category,
  Chapter,
  Comment,
  ContentRevision,
  Follow,
  Story,
  Wallet,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const get = (cookie) => request(app).get('/api/author/dashboard').set('Cookie', cookie);
describe('author dashboard', () => {
  it('requires author role and does not fabricate metrics for an empty account', async () => {
    expect((await request(app).get('/api/author/dashboard')).status).toBe(401);
    const reader = await authenticatedAccount();
    expect((await get(reader.cookie)).status).toBe(403);
    const author = await authenticatedAccount('author');
    expect((await get(author.cookie)).body).toMatchObject({
      stories: [],
      drafts: [],
      feedback: [],
      stats: { views: 0, followers: 0, audioPlays: null, earnings: '0' },
      draftWords: 0,
      writingGoal: null,
      ai: null,
    });
  });
  it('scopes story/draft/feedback/balance data and counts each follower once across owned works', async () => {
    const author = await authenticatedAccount('author');
    const other = await authenticatedAccount('author');
    const reader = await authenticatedAccount();
    const category = await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'kỳ ảo',
      createdBy: author.account._id,
    });
    const first = await Story.create({
      title: 'Truyện của tôi',
      authorAccountId: author.account._id,
      categoryIds: [category._id],
    });
    const second = await Story.create({
      title: 'Truyện thứ hai',
      authorAccountId: author.account._id,
      categoryIds: [category._id],
    });
    const privateStory = await Story.create({
      title: 'OTHER PRIVATE',
      authorAccountId: other.account._id,
      categoryIds: [category._id],
    });
    for (const story of [first, second])
      await Follow.create({ accountId: reader.account._id, storyId: story._id });
    const chapter = await Chapter.create({ storyId: first._id, title: 'Chương nháp', orderKey: 7 });
    const revision = await ContentRevision.create({
      storyId: first._id,
      chapterId: chapter._id,
      authorAccountId: author.account._id,
      contentType: 'chapter',
      revisionNumber: 1,
      formatVersion: 'blocks-v1',
      content: { title: 'Bản nháp hiện tại', blocks: [{ type: 'paragraph', text: 'Một hai ba' }] },
    });
    chapter.draftRevisionId = revision._id;
    await chapter.save();
    await Comment.create({
      targetType: 'story',
      targetId: first._id,
      authorAccountId: reader.account._id,
      body: 'Nhận xét của độc giả',
    });
    await Comment.create({
      targetType: 'story',
      targetId: privateStory._id,
      authorAccountId: reader.account._id,
      body: 'OTHER COMMENT',
    });
    await Wallet.create({
      ownerType: 'account',
      ownerId: author.account._id,
      purpose: 'author-earnings',
      availableBalance: '12345',
    });
    await Wallet.create({
      ownerType: 'account',
      ownerId: other.account._id,
      purpose: 'author-earnings',
      availableBalance: '999999',
    });
    const result = (await get(author.cookie)).body;
    expect(result.stats).toMatchObject({ followers: 1, earnings: '12345' });
    expect(result.stories).toHaveLength(2);
    expect(result.drafts[0]).toMatchObject({
      id: String(first._id),
      chapterId: String(chapter._id),
      chapter: 'Bản nháp hiện tại',
      written: 3,
    });
    expect(result.draftWords).toBe(3);
    expect(result.feedback[0]).toMatchObject({ body: 'Nhận xét của độc giả', canReply: false });
    expect(JSON.stringify(result)).not.toContain('OTHER');
    expect(JSON.stringify(result)).not.toContain('999999');
    expect(JSON.stringify(result)).not.toContain(reader.account.email);
    await Story.updateOne({ _id: first._id }, { $set: { authoringFrozen: true } });
    expect((await get(author.cookie)).body.drafts).toEqual([]);
    expect((await get(other.cookie)).body.stats.earnings).toBe('999999');
  });
});
