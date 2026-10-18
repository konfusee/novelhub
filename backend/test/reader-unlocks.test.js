import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  AuditEvent,
  AuthorRevenueRate,
  Chapter,
  ContentRevision,
  LedgerEntry,
  PolicyVersion,
  RevenueAllocation,
  Story,
  UnlockEntitlement,
  UnlockRequest,
  Wallet,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
import { unlockChapter } from '../src/modules/reader-unlocks.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const app = createApp(testConfig());
async function fixture(balance = 1000) {
  const author = await authenticatedAccount('author'),
    reader = await authenticatedAccount('reader');
  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() - 1000),
    actorAccountId: author.account._id,
  });
  const story = await Story.create({
    authorAccountId: author.account._id,
    title: 'Truyện công khai',
    categoryIds: [author.account._id],
    publicationStatus: 'published',
  });
  const parent = await ContentRevision.create({
    contentType: 'story',
    storyId: story._id,
    authorAccountId: author.account._id,
    revisionNumber: 1,
    content: { title: story.title },
    formatVersion: '1',
    status: 'approved',
  });
  story.publishedRevisionId = parent._id;
  await story.save();
  const chapter = await Chapter.create({
    storyId: story._id,
    orderKey: 1,
    title: 'Chương đọc sớm',
    status: 'published',
    earlyAccess: {
      enabled: true,
      coinPrice: 201,
      durationDays: 2,
      endsAt: new Date(Date.now() + 172800000),
      policyVersionId: policy._id,
    },
  });
  const revision = await ContentRevision.create({
    contentType: 'chapter',
    storyId: story._id,
    chapterId: chapter._id,
    authorAccountId: author.account._id,
    revisionNumber: 1,
    content: { title: chapter.title, paragraphs: ['Nội dung chương'] },
    formatVersion: '1',
    status: 'approved',
  });
  chapter.publishedRevisionId = revision._id;
  await chapter.save();
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: balance,
  });
  const input = {
    publishedRevisionId: String(revision._id),
    expectedPriceCoins: 201,
    idempotencyKey: 'unlock-1',
  };
  const path = `/api/reader/stories/${story._id}/chapters/${chapter._id}/unlock`;
  const buy = (body = input, cookie = reader.cookie) =>
    request(app).post(path).set('Cookie', cookie).set('Origin', 'http://localhost:5173').send(body);
  return { author, reader, policy, story, chapter, revision, wallet, input, path, buy };
}
it('debits once and atomically conserves coins across author/platform allocations with exact floor rounding', async () => {
  const f = await fixture();
  const results = await Promise.all([
    f.buy(),
    f.buy(),
    f.buy({ ...f.input, idempotencyKey: 'other-key' }),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  expect(new Set(results.map((r) => r.body.entitlementId)).size).toBe(1);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(799);
  expect(
    (await Wallet.findOne({ ownerId: f.author.account._id, purpose: 'author-earnings' }))
      .availableBalance,
  ).toBe(140);
  expect((await Wallet.findOne({ ownerType: 'system' })).availableBalance).toBe(61);
  expect(await UnlockRequest.countDocuments({})).toBe(1);
  expect(await UnlockEntitlement.countDocuments({})).toBe(1);
  expect(await RevenueAllocation.countDocuments({})).toBe(1);
  expect(await LedgerEntry.countDocuments({})).toBe(3);
  const legs = await LedgerEntry.find({});
  expect(legs.reduce((sum, e) => sum + (e.direction === 'credit' ? e.amount : -e.amount), 0)).toBe(
    0,
  );
  const entitlement = await UnlockEntitlement.findOne({});
  expect(String(entitlement.publishedRevisionId)).toBe(String(f.revision._id));
  expect(entitlement.pricePolicySnapshot.priceCoins).toBe(201);
  expect(entitlement.expiresAt).toEqual(f.chapter.earlyAccess.endsAt);
  const access = await request(app).get(f.path).set('Cookie', f.reader.cookie);
  expect(access.body.entitled).toBe(true);
  expect(access.body.balance).toBe(799);
  const conflict = await f.buy({ ...f.input, expectedPriceCoins: 202 });
  expect(conflict.status).toBe(409);
});
it('uses the negotiated effective author rate and snapshots it instead of applying a future rate', async () => {
  const f = await fixture();
  const rate = await AuthorRevenueRate.create({
    authorAccountId: f.author.account._id,
    percentage: 65,
    effectiveAt: new Date(Date.now() - 500),
    actorAccountId: f.author.account._id,
  });
  await AuthorRevenueRate.create({
    authorAccountId: f.author.account._id,
    percentage: 90,
    effectiveAt: new Date(Date.now() + 3600000),
    actorAccountId: f.author.account._id,
  });
  await unlockChapter(f.reader.account, String(f.story._id), String(f.chapter._id), f.input);
  expect((await Wallet.findOne({ purpose: 'author-earnings' })).availableBalance).toBe(130);
  expect((await Wallet.findOne({ purpose: 'system-earnings' })).availableBalance).toBe(71);
  expect((await RevenueAllocation.findOne({})).negotiatedAllocationSnapshot.id).toBe(
    String(rate._id),
  );
});
it('rolls back every financial leg and entitlement if audit fails', async () => {
  const f = await fixture();
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await f.buy()).status).toBe(500);
  spy.mockRestore();
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(1000);
  expect(await Wallet.countDocuments({})).toBe(1);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect(await UnlockEntitlement.countDocuments({})).toBe(0);
  expect(await UnlockRequest.countDocuments({})).toBe(0);
  expect(await RevenueAllocation.countDocuments({})).toBe(0);
  expect((await f.buy()).status).toBe(200);
});
it('shares a single platform wallet across simultaneous purchases from different authors', async () => {
  const first = await fixture(),
    second = await fixture();
  const responses = await Promise.all([first.buy(), second.buy()]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(await Wallet.countDocuments({ purpose: 'system-earnings' })).toBe(1);
  expect((await Wallet.findOne({ purpose: 'system-earnings' })).availableBalance).toBe(122);
  expect(await LedgerEntry.countDocuments({})).toBe(6);
});
it('rejects insufficient funds and changed prices/revisions with no charge', async () => {
  const f = await fixture(100);
  expect((await f.buy()).status).toBe(409);
  expect((await f.buy({ ...f.input, expectedPriceCoins: 200 })).status).toBe(409);
  expect(
    (await f.buy({ ...f.input, publishedRevisionId: String(f.author.account._id) })).status,
  ).toBe(409);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(100);
});
it('never charges free windows or hidden chapters and requires authentication/origin', async () => {
  const f = await fixture();
  expect((await request(app).get(f.path)).status).toBe(401);
  expect(
    (await request(app).post(f.path).set('Cookie', f.reader.cookie).send(f.input)).status,
  ).toBe(403);
  const quote = await request(app).get(f.path).set('Cookie', f.reader.cookie);
  expect(quote.body).toMatchObject({
    priceCoins: 201,
    balance: 1000,
    free: false,
    entitled: false,
  });
  await Chapter.updateOne(
    { _id: f.chapter._id },
    { $set: { 'earlyAccess.endsAt': new Date(Date.now() - 1000) } },
  );
  expect((await f.buy()).body.free).toBe(true);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  await Story.updateOne({ _id: f.story._id }, { $set: { publicationStatus: 'unpublished' } });
  expect((await f.buy()).status).toBe(404);
});
it('keeps a charged policy/rate snapshot unchanged and rejects repurposing an idempotency key', async () => {
  const f = await fixture();
  expect((await f.buy()).status).toBe(200);
  const allocation = await RevenueAllocation.findOne({});
  const second = await fixture();
  const conflict = await request(app)
    .post(second.path)
    .set('Cookie', f.reader.cookie)
    .set('Origin', 'http://localhost:5173')
    .send({ ...second.input, idempotencyKey: f.input.idempotencyKey });
  expect(conflict.status).toBe(409);
  await AuthorRevenueRate.create({
    authorAccountId: f.author.account._id,
    percentage: 10,
    effectiveAt: new Date(),
    actorAccountId: f.author.account._id,
  });
  expect((await f.buy()).status).toBe(200);
  expect((await RevenueAllocation.findById(allocation._id)).policySnapshot.authorSharePercent).toBe(
    70,
  );
  expect(await LedgerEntry.countDocuments({})).toBe(3);
});
