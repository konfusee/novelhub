import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  ContentRevision,
  PolicyVersion,
  PublicationSubmission,
  Story,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const app = createApp(testConfig());
async function fixture() {
  const mod = await authenticatedAccount('moderator');
  const author = await authenticatedAccount('author');
  const story = await Story.create({
    authorAccountId: author.account._id,
    title: 'Gói đang chờ duyệt',
    categoryIds: [author.account._id],
  });
  const revision = await ContentRevision.create({
    contentType: 'story',
    storyId: story._id,
    authorAccountId: author.account._id,
    revisionNumber: 1,
    content: { title: story.title },
    formatVersion: '1',
    status: 'submitted',
  });
  const submission = await PublicationSubmission.create({
    storyId: story._id,
    revisionId: revision._id,
    authorAccountId: author.account._id,
    status: 'pending-review',
  });
  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() - 1000),
    actorAccountId: mod.account._id,
    claimExpiryHours: 2,
  });
  const input = {
    expectedVersion: submission.version,
    expectedClaimVersion: submission.claimVersion,
  };
  const acquire = (body = input, cookie = mod.cookie, release = false) =>
    request(app)
      .post(`/api/moderator/review-claims/${submission._id}${release ? '/release' : ''}`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5173')
      .send(body);
  const queue = (cookie = mod.cookie, view = 'available') =>
    request(app).get(`/api/moderator/review-claims?view=${view}`).set('Cookie', cookie);
  return { mod, author, story, submission, policy, input, acquire, queue };
}
it('fixes the effective policy deadline once and does not renew it on retries or policy changes', async () => {
  const f = await fixture();
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() + 3600000),
    actorAccountId: f.mod.account._id,
    claimExpiryHours: 10,
  });
  const start = Date.now();
  const first = await f.acquire();
  expect(first.status).toBe(200);
  expect(Math.abs(Date.parse(first.body.claim.expiresAt) - start - 7200000)).toBeLessThan(5000);
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $set: { claimExpiryHours: 8 } });
  const replay = await f.acquire();
  expect(replay.body.replayed).toBe(true);
  expect(replay.body.claim.expiresAt).toBe(first.body.claim.expiresAt);
  expect((await f.queue()).body.items).toEqual([]);
  expect((await f.queue(f.mod.cookie, 'mine')).body.items).toHaveLength(1);
  expect(await AuditEvent.countDocuments({ action: 'review.claim.acquired' })).toBe(1);
});
it('allows one concurrent claimant and fences expired owners after takeover', async () => {
  const f = await fixture();
  const other = await authenticatedAccount('moderator');
  const results = await Promise.all([f.acquire(), f.acquire(f.input, other.cookie)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const old = await PublicationSubmission.findById(f.submission._id);
  await PublicationSubmission.updateOne(
    { _id: old._id },
    { $set: { claimExpiresAt: new Date(Date.now() - 1000) } },
  );
  expect((await f.queue()).body.items).toHaveLength(1);
  const newOwner = String(old.claimOwnerAccountId) === String(f.mod.account._id) ? other : f.mod;
  const next = await f.acquire(
    { expectedVersion: old.version, expectedClaimVersion: old.claimVersion },
    newOwner.cookie,
  );
  expect(next.status).toBe(200);
  expect(next.body.claim.claimVersion).toBe(old.claimVersion + 1);
  expect(
    (
      await f.acquire(
        { expectedVersion: old.version, expectedClaimVersion: old.claimVersion },
        String(old.claimOwnerAccountId) === String(f.mod.account._id) ? f.mod.cookie : other.cookie,
        true,
      )
    ).status,
  ).toBe(409);
  const stored = await PublicationSubmission.findById(old._id);
  expect(stored.claimReleaseHistory[0].reason).toBe('claim-expired');
});
it('releases a live owned claim and returns it to the queue with immutable audit evidence', async () => {
  const f = await fixture();
  const first = await f.acquire();
  const released = await f.acquire(
    {
      expectedVersion: first.body.claim.version,
      expectedClaimVersion: first.body.claim.claimVersion,
    },
    f.mod.cookie,
    true,
  );
  expect(released.status).toBe(200);
  expect(released.body.claim.ownerAccountId).toBeNull();
  expect((await f.queue()).body.items).toHaveLength(1);
  expect(
    (await PublicationSubmission.findById(f.submission._id)).claimReleaseHistory[0].reason,
  ).toBe('moderator-released');
  expect(await AuditEvent.countDocuments({ action: 'review.claim.released' })).toBe(1);
});
it('rejects non-Moderators, former Authors, unavailable packages and missing policy', async () => {
  const f = await fixture();
  expect((await f.acquire(f.input, f.author.cookie)).status).toBe(403);
  await Account.updateOne({ _id: f.mod.account._id }, { $set: { everAuthor: true } });
  expect((await f.acquire()).status).toBe(403);
  const replacement = await authenticatedAccount('moderator');
  await Story.updateOne({ _id: f.story._id }, { $set: { authoringFrozen: true } });
  expect((await f.acquire(f.input, replacement.cookie)).status).toBe(409);
  await Story.updateOne({ _id: f.story._id }, { $set: { authoringFrozen: false } });
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $set: { claimExpiryHours: 0 } });
  expect((await f.acquire(f.input, replacement.cookie)).status).toBe(409);
  expect(
    (await PublicationSubmission.findById(f.submission._id)).claimOwnerAccountId,
  ).toBeUndefined();
});
it('rolls back acquisition when audit fails and keeps validated/finished submissions out of formal claims', async () => {
  const f = await fixture();
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await f.acquire()).status).toBe(500);
  spy.mockRestore();
  expect((await PublicationSubmission.findById(f.submission._id)).claimVersion).toBe(0);
  await PublicationSubmission.updateOne(
    { _id: f.submission._id },
    { $set: { status: 'validated' } },
  );
  expect((await f.acquire()).status).toBe(409);
  expect((await f.queue()).body.items).toEqual([]);
});
