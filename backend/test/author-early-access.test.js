import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  PolicyVersion,
  Story,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const get = (path, cookie) => request(app).get(path).set('Cookie', cookie);
const put = (f, body = f.input, cookie = f.author.cookie) =>
  request(app).put(f.path).set('Cookie', cookie).set('Origin', 'http://localhost:5173').send(body);
async function fixture() {
  const author = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao',
    createdBy: author.account._id,
  });
  const story = await Story.create({
    authorAccountId: author.account._id,
    title: 'Truyện thử',
    categoryIds: [category._id],
  });
  const chapter = await Chapter.create({ storyId: story._id, orderKey: 1, title: 'Chương nháp' });
  const revision = await ContentRevision.create({
    contentType: 'chapter',
    storyId: story._id,
    chapterId: chapter._id,
    authorAccountId: author.account._id,
    revisionNumber: 1,
    formatVersion: 'blocks-v1',
    content: { title: 'Chương nháp', blocks: [{ type: 'paragraph', text: 'Nội dung.' }] },
  });
  chapter.draftRevisionId = revision._id;
  chapter.currentRevisionId = revision._id;
  await chapter.save();
  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2020-01-01'),
    actorAccountId: author.account._id,
  });
  const path = `/api/author/stories/${story.id}/chapters/${chapter.id}/early-access`;
  const input = {
    enabled: true,
    coinPrice: 250,
    durationDays: 3,
    expectedVersion: chapter.version,
    expectedStoryVersion: story.version,
    policyId: policy.id,
    expectedPolicyVersion: policy.version,
  };
  return { author, story, chapter, revision, policy, path, input };
}
it('saves and reloads draft settings, pins policy, creates audit, and never sets a release/end date', async () => {
  const f = await fixture();
  const before = await ContentRevision.findById(f.revision._id).lean();
  const initial = await get(f.path, f.author.cookie);
  expect(initial.status).toBe(200);
  expect(initial.body.canEdit).toBe(true);
  expect(initial.headers['cache-control']).toBe('private, no-store');
  expect((await put(f)).status).toBe(200);
  const chapter = await Chapter.findById(f.chapter._id);
  expect(chapter.earlyAccess.toObject()).toMatchObject({
    enabled: true,
    coinPrice: 250,
    durationDays: 3,
  });
  expect(chapter.earlyAccess.endsAt).toBeUndefined();
  expect(chapter.firstReleasedAt).toBeUndefined();
  expect(chapter.status).toBe('draft');
  expect((await get(f.path, f.author.cookie)).body.settings).toEqual({
    enabled: true,
    coinPrice: 250,
    durationDays: 3,
  });
  expect(await ContentRevision.findById(f.revision._id).lean()).toEqual(before);
  expect(await AuditEvent.countDocuments({ action: 'chapter.early-access-configured' })).toBe(1);
  expect((await PolicyVersion.findById(f.policy._id)).version).toBe(f.policy.version + 1);
  const workspace = await get(`/api/author/stories/${f.story.id}/workspace`, f.author.cookie);
  expect(workspace.body.chapters[0]).toMatchObject({
    canConfigureEarlyAccess: true,
    earlyAccess: { enabled: true, coinPrice: 250, durationDays: 3 },
  });
});
it('rejects guests, Readers, other owners and malformed payloads or IDs', async () => {
  const f = await fixture(),
    other = await authenticatedAccount('author'),
    reader = await authenticatedAccount();
  expect((await request(app).get(f.path)).status).toBe(401);
  expect((await get(f.path, reader.cookie)).status).toBe(403);
  expect((await get(f.path, other.cookie)).status).toBe(404);
  expect((await put(f, f.input, other.cookie)).status).toBe(404);
  for (const bad of [
    { coinPrice: 199 },
    { coinPrice: 5001 },
    { coinPrice: 250.5 },
    { durationDays: 0 },
    { durationDays: 15 },
    { durationDays: 1.5 },
    { endsAt: '2030-01-01' },
    { enabled: false },
  ])
    expect((await put(f, { ...f.input, ...bad })).status).toBe(400);
  expect((await get(f.path.replace(f.chapter.id, 'bad'), f.author.cookie)).status).toBe(400);
  expect(await AuditEvent.countDocuments({ action: 'chapter.early-access-configured' })).toBe(0);
});
it('requires an effective current policy, excludes future/draft policies and rejects policy version changes', async () => {
  const f = await fixture();
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2030-01-01'),
    priceMinCoins: 999,
    actorAccountId: f.author.account._id,
  });
  expect((await get(f.path, f.author.cookie)).body.policy.id).toBe(f.policy.id);
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $inc: { version: 1 } });
  expect((await put(f)).status).toBe(409);
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $set: { status: 'superseded' } });
  expect((await get(f.path, f.author.cookie)).body.policy).toBe(null);
  expect((await put(f)).status).toBe(409);
});
it('turns off settings even without a policy and clears all draft price/duration fields', async () => {
  const f = await fixture();
  expect((await put(f)).status).toBe(200);
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $set: { status: 'superseded' } });
  const prepared = (await get(f.path, f.author.cookie)).body;
  expect(
    (
      await put(f, {
        enabled: false,
        expectedVersion: prepared.version,
        expectedStoryVersion: prepared.storyVersion,
      })
    ).status,
  ).toBe(200);
  expect((await Chapter.findById(f.chapter._id)).earlyAccess).toBeUndefined();
});
it('allows at most one concurrent write and rejects replay with prepared old versions', async () => {
  const f = await fixture();
  const result = await Promise.all([put(f), put(f)]);
  expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await put(f)).status).toBe(409);
  expect(await AuditEvent.countDocuments({ action: 'chapter.early-access-configured' })).toBe(1);
});
it('rolls back chapter, story, policy and account on an audit failure', async () => {
  const f = await fixture();
  const account = await Account.findById(f.author.account._id);
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Audit failed'));
  expect((await put(f)).status).toBe(500);
  expect((await Chapter.findById(f.chapter._id)).earlyAccess).toBeUndefined();
  expect((await Chapter.findById(f.chapter._id)).version).toBe(f.chapter.version);
  expect((await Story.findById(f.story._id)).version).toBe(f.story.version);
  expect((await PolicyVersion.findById(f.policy._id)).version).toBe(f.policy.version);
  expect((await Account.findById(f.author.account._id)).version).toBe(account.version);
});
it.each(['published', 'submitted', 'scheduled', 'archived', 'cancelled'])(
  'blocks %s chapters even when their revision is editable',
  async (status) => {
    const f = await fixture();
    await Chapter.updateOne({ _id: f.chapter._id }, { $set: { status } });
    expect((await get(f.path, f.author.cookie)).body.canEdit).toBe(false);
    expect((await put(f)).status).toBe(409);
  },
);
it('blocks frozen stories and previously released chapters even after a private correction', async () => {
  const f = await fixture();
  await Story.updateOne({ _id: f.story._id }, { $set: { authoringFrozen: true } });
  expect((await put(f)).status).toBe(409);
  await Story.updateOne({ _id: f.story._id }, { $set: { authoringFrozen: false } });
  const released = await Chapter.findById(f.chapter._id);
  released.firstReleasedAt = new Date();
  await released.save();
  expect((await get(f.path, f.author.cookie)).body.canEdit).toBe(false);
  expect((await put(f)).status).toBe(409);
});
