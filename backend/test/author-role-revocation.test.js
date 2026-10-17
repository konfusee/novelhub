import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  AuditEvent,
  Account,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
import { releaseDueChapters } from '../src/modules/chapter-scheduler.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
const write = (cookie, url, body, method = 'post') =>
  request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(body);
const get = (cookie, url) => request(app).get(url).set('Cookie', cookie);

// Human decisions are isolated fixtures; author endpoints never grant approval.
async function approve(sent) {
  const submission = await PublicationSubmission.findById(sent.body.submission.id);
  submission.status = 'approved';
  await submission.save();
  const revision = await ContentRevision.findById(submission.revisionId);
  revision.status = 'approved';
  await revision.save();
  const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId);
  batch.status = 'available-for-human-review';
  batch.stage = 'llm';
  await batch.save();
  const Model = submission.chapterId ? Chapter : Story;
  const entity = await Model.findById(submission.chapterId ?? submission.storyId);
  if (submission.chapterId) entity.status = 'approved';
  else {
    entity.publicationStatus = 'approved';
    entity.authoringFrozen = false;
  }
  await entity.save();
  return { submission, revision, batch, entity };
}
async function fixture({ rich = false, preceding = false } = {}) {
  const author = await authenticatedAccount('author');
  const cookie = author.cookie;
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao',
    createdBy: author.account._id,
  });
  const created = await write(cookie, '/api/author/stories', {
    title: 'Truyện công khai',
    description: 'Mô tả truyện thật.',
    categoryIds: [String(category._id)],
  });
  const storyId = created.body.story.id;
  const prep = (await get(cookie, `/api/author/submissions/prepare?storyId=${storyId}`)).body;
  const sent = await write(cookie, '/api/author/submissions', {
    storyId,
    revisionId: prep.target.revisionId,
    expectedVersion: prep.target.version,
    rights: { asserted: true, basis: 'original', sourceLicenceNote: '' },
  });
  expect(sent.status).toBe(201);
  const parent = await approve(sent);
  const released = await write(cookie, `/api/author/stories/${storyId}/release`, {
    revisionId: String(parent.revision._id),
    submissionId: String(parent.submission._id),
    expectedVersion: parent.entity.version,
  });
  expect(released.status).toBe(201);
  let earlier;
  if (preceding)
    earlier = (
      await write(cookie, `/api/author/stories/${storyId}/chapters`, {
        title: 'Chương trước',
        paragraphs: ['Nội dung trước.'],
      })
    ).body.chapter;
  const chapter = (
    await write(cookie, `/api/author/stories/${storyId}/chapters`, {
      title: 'Chương được duyệt',
      paragraphs: ['Nội dung xuất bản thật.'],
    })
  ).body.chapter;
  const chapterId = chapter.id;
  if (rich)
    expect(
      (
        await write(
          cookie,
          `/api/author/stories/${storyId}/chapters/${chapterId}`,
          {
            expectedVersion: chapter.version,
            document: {
              title: 'Chương được duyệt',
              blocks: [
                { type: 'paragraph', inlines: [{ text: 'Nội dung in đậm.', marks: ['bold'] }] },
              ],
            },
          },
          'put',
        )
      ).status,
    ).toBe(200);
  const prepared = (
    await get(cookie, `/api/author/submissions/prepare?storyId=${storyId}&chapterId=${chapterId}`)
  ).body;
  const chapterSent = await write(cookie, '/api/author/submissions', {
    storyId,
    chapterId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
  });
  expect(chapterSent.status).toBe(201);
  const approvedChapter = await approve(chapterSent);
  const endpoint = `/api/author/stories/${storyId}/chapters/${chapterId}/release`;
  const prepare = () => get(cookie, endpoint);
  const target = (await prepare()).body.target;
  const body = {
    revisionId: target.revisionId,
    submissionId: target.submissionId,
    expectedVersion: target.version,
    expectedStoryVersion: target.storyVersion,
  };
  return {
    author,
    cookie,
    storyId,
    chapterId,
    earlier,
    parent,
    ...approvedChapter,
    endpoint,
    prepare,
    body,
  };
}

async function revocationFixture({ published = false } = {}) {
  const f = await fixture();
  if (published) expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
  else {
    const schedule = {
      ...f.body,
      requestedReleaseAt: new Date(Date.now() + 86400000).toISOString(),
    };
    expect(
      (await write(f.cookie, f.endpoint.replace(/release$/, 'schedule'), schedule, 'put')).status,
    ).toBe(200);
  }
  const admin = await authenticatedAccount('admin');
  const url = `/api/admin/authors/${f.author.account._id}`;
  const prep = (await get(admin.cookie, `${url}/role`)).body;
  return {
    ...f,
    admin,
    url: `${url}/revoke`,
    roleUrl: `${url}/role`,
    revoke: {
      roleId: prep.role.id,
      expectedRoleVersion: prep.role.version,
      expectedAccountVersion: prep.accountVersion,
      reason: 'Thu hồi quyền tác giả theo quyết định quản trị.',
    },
  };
}
it('atomically cancels future schedules and pending review, releases claims and preserves live parent approval', async () => {
  const f = await revocationFixture();
  const created = await write(f.cookie, `/api/author/stories/${f.storyId}/chapters`, {
    title: 'Chương chờ duyệt',
    paragraphs: ['Nội dung riêng tư.'],
  });
  const pendingId = created.body.chapter.id;
  const prep = (
    await get(
      f.cookie,
      `/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${pendingId}`,
    )
  ).body;
  const sent = await write(f.cookie, '/api/author/submissions', {
    storyId: f.storyId,
    chapterId: pendingId,
    revisionId: prep.target.revisionId,
    expectedVersion: prep.target.version,
  });
  expect(sent.status).toBe(201);
  const pending = await PublicationSubmission.findById(sent.body.submission.id);
  pending.claimOwnerAccountId = f.admin.account._id;
  pending.claimExpiresAt = new Date(Date.now() + 60000);
  await pending.save();
  const current = (await get(f.admin.cookie, f.roleUrl)).body;
  f.revoke.expectedAccountVersion = current.accountVersion;
  const epoch = (await Account.findById(f.author.account._id)).authorizationEpoch;
  const result = await write(f.admin.cookie, f.url, f.revoke);
  expect(result.status).toBe(200);
  expect(result.body.cancelledChapters).toBe(2);
  expect(result.body.cancelledSubmissions).toBe(2);
  const cancelled = await Chapter.findById(f.chapterId);
  expect(cancelled.status).toBe('cancelled');
  expect(cancelled.cancellationReason).toBe('author-role-removed');
  expect(cancelled.cancelledAt).toBeInstanceOf(Date);
  expect(String(cancelled.currentRevisionId)).toBe(f.body.revisionId);
  const removed = await PublicationSubmission.findById(pending._id);
  expect(removed.status).toBe('cancelled');
  expect(removed.claimOwnerAccountId).toBeUndefined();
  expect(removed.claimReleaseHistory[0].reason).toBe('author-role-removed');
  expect(removed.claimVersion).toBe(pending.claimVersion + 1);
  expect((await Account.findById(f.author.account._id)).authorizationEpoch).toBe(epoch + 1);
  expect((await Story.findById(f.storyId)).authoringFrozen).toBe(true);
  expect((await PublicationSubmission.findById(f.parent.submission._id)).status).toBe('approved');
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(200);
  expect((await get(f.cookie, '/api/author/stories')).status).toBe(401);
  await releaseDueChapters(testConfig(), { now: new Date(Date.now() + 172800000) });
  expect((await Chapter.findById(f.chapterId)).publishedRevisionId).toBeUndefined();
  expect(await AuditEvent.countDocuments({ action: 'author-role.revoked' })).toBe(1);
});
it('keeps published text, release dates, approvals and access policy intact', async () => {
  const f = await revocationFixture({ published: true });
  const before = await Chapter.findById(f.chapterId).lean();
  const revision = await ContentRevision.findById(f.revision._id).lean();
  expect((await write(f.admin.cookie, f.url, f.revoke)).status).toBe(200);
  const after = await Chapter.findById(f.chapterId).lean();
  expect(after).toEqual(before);
  expect(await ContentRevision.findById(f.revision._id).lean()).toEqual(revision);
  expect((await PublicationSubmission.findById(f.submission._id)).status).toBe('approved');
  expect(
    (await request(app).get(`/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`)).status,
  ).toBe(200);
  expect((await Story.findById(f.storyId)).publicationStatus).toBe('published');
});
it('rolls back role, account epoch, frozen stories and cancellations when audit persistence fails', async () => {
  const f = await revocationFixture();
  const account = await Account.findById(f.author.account._id).lean();
  const story = await Story.findById(f.storyId).lean();
  const chapter = await Chapter.findById(f.chapterId).lean();
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
  expect((await write(f.admin.cookie, f.url, f.revoke)).status).toBe(500);
  expect(await Account.findById(f.author.account._id).lean()).toEqual(account);
  expect(await Story.findById(f.storyId).lean()).toEqual(story);
  expect(await Chapter.findById(f.chapterId).lean()).toEqual(chapter);
  expect((await RoleAssignment.findById(f.revoke.roleId)).status).toBe('active');
});
it('requires admin authorization, exact role/account versions and a non-empty reason', async () => {
  const f = await revocationFixture();
  expect((await write(f.cookie, f.url, f.revoke)).status).toBe(403);
  expect((await request(app).get(f.roleUrl)).status).toBe(401);
  expect((await write(f.admin.cookie, f.url, { ...f.revoke, reason: ' ' })).status).toBe(400);
  expect(
    (await write(f.admin.cookie, f.url, { ...f.revoke, expectedAccountVersion: 999 })).status,
  ).toBe(409);
  expect(
    (await write(f.admin.cookie, f.url, { ...f.revoke, expectedRoleVersion: 999 })).status,
  ).toBe(409);
  expect((await RoleAssignment.findById(f.revoke.roleId)).status).toBe('active');
});
it('serializes duplicate revocations and records one completed action', async () => {
  const f = await revocationFixture();
  const results = await Promise.all([
    write(f.admin.cookie, f.url, f.revoke),
    write(f.admin.cookie, f.url, f.revoke),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect(await AuditEvent.countDocuments({ action: 'author-role.revoked' })).toBe(1);
});
it('does not reactivate a cancelled schedule after a subsequent author grant', async () => {
  const f = await revocationFixture();
  expect((await write(f.admin.cookie, f.url, f.revoke)).status).toBe(200);
  await RoleAssignment.create({
    accountId: f.author.account._id,
    role: 'author',
    grantedBy: f.admin.account._id,
  });
  expect(
    (await releaseDueChapters(testConfig(), { now: new Date(Date.now() + 172800000) })).published,
  ).toBe(0);
  expect((await Chapter.findById(f.chapterId)).status).toBe('cancelled');
  expect((await Story.findById(f.storyId)).authoringFrozen).toBe(true);
});
it('suspends automatic release temporarily and allows release after reinstatement without cancelling', async () => {
  const f = await revocationFixture();
  await Account.updateOne({ _id: f.author.account._id }, { status: 'suspended' });
  const now = new Date(Date.now() + 172800000);
  expect((await releaseDueChapters(testConfig(), { now })).published).toBe(0);
  expect((await Chapter.findById(f.chapterId)).status).toBe('due');
  expect((await Chapter.findById(f.chapterId)).cancellationReason).toBeUndefined();
  await Account.updateOne({ _id: f.author.account._id }, { status: 'active' });
  expect((await releaseDueChapters(testConfig(), { now })).published).toBe(1);
});
it('serializes revocation with an in-flight release and preserves whichever transition committed first', async () => {
  const f = await revocationFixture();
  const [, response] = await Promise.all([
    releaseDueChapters(testConfig(), { now: new Date(Date.now() + 172800000) }),
    write(f.admin.cookie, f.url, f.revoke),
  ]);
  expect([200, 409]).toContain(response.status);
  if (response.status === 409) {
    const latest = (await get(f.admin.cookie, f.roleUrl)).body;
    expect(
      (
        await write(f.admin.cookie, f.url, {
          ...f.revoke,
          expectedAccountVersion: latest.accountVersion,
          expectedRoleVersion: latest.role.version,
        })
      ).status,
    ).toBe(200);
  }
  const chapter = await Chapter.findById(f.chapterId);
  expect(['published', 'cancelled']).toContain(chapter.status);
  expect((await Story.findById(f.storyId)).authoringFrozen).toBe(true);
  expect((await RoleAssignment.findById(f.revoke.roleId)).status).toBe('revoked');
  const count = await AuditEvent.countDocuments({ action: 'chapter.published' });
  expect(
    (await releaseDueChapters(testConfig(), { now: new Date(Date.now() + 259200000) })).published,
  ).toBe(0);
  expect(await AuditEvent.countDocuments({ action: 'chapter.published' })).toBe(count);
});
it('rolls back claim cancellation and role removal if moderation history cannot be written', async () => {
  const f = await revocationFixture();
  vi.spyOn(ModerationHistory, 'create').mockRejectedValueOnce(
    new Error('Injected moderation history failure'),
  );
  expect((await write(f.admin.cookie, f.url, f.revoke)).status).toBe(500);
  expect((await PublicationSubmission.findById(f.submission._id)).status).toBe('approved');
  expect((await Chapter.findById(f.chapterId)).status).toBe('scheduled');
  expect((await RoleAssignment.findById(f.revoke.roleId)).status).toBe('active');
  expect(await AuditEvent.countDocuments({ action: 'author-role.revoked' })).toBe(0);
});
it('preserves deleted draft tombstones rather than resurfacing them as cancelled chapters', async () => {
  const f = await revocationFixture();
  const deleted = await Chapter.create({
    storyId: f.storyId,
    title: 'Bản nháp đã xóa',
    orderKey: 2,
    status: 'archived',
    publicationTransition: { result: 'author-draft-deleted' },
  });
  const before = await Chapter.findById(deleted._id).lean();
  expect((await write(f.admin.cookie, f.url, f.revoke)).status).toBe(200);
  expect(await Chapter.findById(deleted._id).lean()).toEqual(before);
});
it('lists only current author accounts, supports literal search and pagination, and rejects non-admin access', async () => {
  const f = await revocationFixture();
  const url = '/api/admin/authors?page=1&pageSize=1&query=';
  const response = await get(f.admin.cookie, url);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.body.total).toBe(1);
  expect(response.body.items[0].accountId).toBe(String(f.author.account._id));
  expect(response.body.items[0]).not.toHaveProperty('password');
  expect((await get(f.admin.cookie, '/api/admin/authors?query=.*')).body.total).toBe(0);
  expect((await get(f.admin.cookie, '/api/admin/authors?pageSize=999')).status).toBe(400);
  expect((await get(f.cookie, url)).status).toBe(403);
  expect((await request(app).get(url)).status).toBe(401);
  expect((await write(f.admin.cookie, f.url, f.revoke)).status).toBe(200);
  expect((await get(f.admin.cookie, url)).body.total).toBe(0);
});
it('paginates distinct author accounts and escapes all search metacharacters literally', async () => {
  const admin = await authenticatedAccount('admin');
  const first = await authenticatedAccount('author', { displayName: 'Tác giả .* [A]' });
  const second = await authenticatedAccount('author', {
    displayName: 'Tác giả khác',
    status: 'suspended',
  });
  await authenticatedAccount('author', { status: 'anonymized' });
  const a = (await get(admin.cookie, '/api/admin/authors?page=1&pageSize=1')).body;
  const b = (await get(admin.cookie, '/api/admin/authors?page=2&pageSize=1')).body;
  expect(a.total).toBe(2);
  expect(b.total).toBe(2);
  expect(new Set([...a.items, ...b.items].map((item) => item.accountId))).toEqual(
    new Set([String(first.account._id), String(second.account._id)]),
  );
  const literal = await get(
    admin.cookie,
    `/api/admin/authors?query=${encodeURIComponent('.* [A]')}`,
  );
  expect(literal.status).toBe(200);
  expect(literal.body.total).toBe(1);
  expect(literal.body.items[0].accountId).toBe(String(first.account._id));
  expect((await get(admin.cookie, '/api/admin/authors?query=%5B')).status).toBe(200);
});
