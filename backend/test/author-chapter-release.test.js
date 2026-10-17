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
  PublicationSubmission,
  RightsDeclaration,
  RoleAssignment,
  Story,
  UnlockEntitlement,
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
it.each([false, true])(
  'publishes the exact approved free chapter (rich=%s) to the real reader API',
  async (rich) => {
    const f = await fixture({ rich });
    const publicUrl = `/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`;
    expect((await request(app).get(publicUrl)).status).toBe(404);
    expect((await f.prepare()).body.ready).toBe(true);
    expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
    const read = await request(app).get(publicUrl);
    expect(read.status).toBe(200);
    expect(read.body.chapter.revisionId).toBe(f.body.revisionId);
    expect(read.body.chapter.blocks).toEqual(
      rich
        ? [{ type: 'paragraph', inlines: [{ text: 'Nội dung in đậm.', marks: ['bold'] }] }]
        : [{ type: 'paragraph', text: 'Nội dung xuất bản thật.' }],
    );
    const chapter = await Chapter.findById(f.chapterId);
    expect(chapter.firstReleasedAt).toBeInstanceOf(Date);
    expect(chapter.draftRevisionId).toBeUndefined();
    expect(
      (await request(app).get(`/api/catalog/stories/${f.storyId}`)).body.chapters,
    ).toHaveLength(1);
  },
);
it('serializes concurrent replay without changing first release, version or duplicating audit', async () => {
  const f = await fixture();
  const results = await Promise.all([
    write(f.cookie, f.endpoint, f.body),
    write(f.cookie, f.endpoint, f.body),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
  const before = await Chapter.findById(f.chapterId);
  expect((await write(f.cookie, f.endpoint, f.body)).body.chapter.replayed).toBe(true);
  const after = await Chapter.findById(f.chapterId);
  expect(after.firstReleasedAt).toEqual(before.firstReleasedAt);
  expect(after.version).toBe(before.version);
  expect(await AuditEvent.countDocuments({ action: 'chapter.published' })).toBe(1);
});
it('blocks an unreleased earlier chapter including archived drafts; skips only deleted drafts', async () => {
  const f = await fixture({ preceding: true });
  expect((await f.prepare()).body.checks.find((c) => c.code === 'order').ok).toBe(false);
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409);
  const earlier = await Chapter.findById(f.earlier.id);
  earlier.status = 'archived';
  await earlier.save();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409);
  earlier.publicationTransition = { result: 'author-draft-deleted' };
  await earlier.save();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
});
it('allows an earlier previously released chapter even when unpublished', async () => {
  const f = await fixture({ preceding: true });
  const earlier = await Chapter.findById(f.earlier.id);
  earlier.firstReleasedAt = new Date('2026-01-01');
  earlier.status = 'unpublished';
  await earlier.save();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
});
it.each(['pending', 'embedding-complete', 'discovery-complete', 'llm-complete'])(
  'blocks incomplete %s evidence despite an inconsistent approval fixture',
  async (status) => {
    const f = await fixture();
    f.batch.status = status;
    await f.batch.save();
    expect((await write(f.cookie, f.endpoint, f.body)).body.error.code).toBe('release_not_ready');
  },
);
it('does not convert early-access content to free, including expired early access', async () => {
  const f = await fixture();
  f.entity.earlyAccess = {
    enabled: true,
    coinPrice: 10,
    durationDays: 1,
    endsAt: new Date('2020-01-01'),
  };
  await f.entity.save();
  f.body.expectedVersion = f.entity.version;
  expect((await f.prepare()).body.checks.find((c) => c.code === 'free').ok).toBe(false);
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409);
  expect((await Chapter.findById(f.chapterId)).earlyAccess.coinPrice).toBe(10);
});
it('rejects stale parent/chapter versions and client-supplied approval or price', async () => {
  const f = await fixture();
  for (const extra of [{ expectedVersion: 999 }, { expectedStoryVersion: 999 }])
    expect((await write(f.cookie, f.endpoint, { ...f.body, ...extra })).status).toBe(409);
  for (const extra of [{ status: 'approved' }, { earlyAccess: { enabled: false } }])
    expect((await write(f.cookie, f.endpoint, { ...f.body, ...extra })).status).toBe(400);
});
it('enforces authentication, author role, ownership and chapter/story binding', async () => {
  const f = await fixture();
  expect((await request(app).get(f.endpoint)).status).toBe(401);
  for (const role of ['reader', 'admin', 'moderator']) {
    const other = await authenticatedAccount(role);
    expect((await get(other.cookie, f.endpoint)).status).toBe(403);
  }
  const other = await authenticatedAccount('author');
  expect((await get(other.cookie, f.endpoint)).status).toBe(404);
  expect((await write(other.cookie, f.endpoint, f.body)).status).toBe(404);
  expect(
    (await get(f.cookie, f.endpoint.replace(f.chapterId, String(other.account._id)))).status,
  ).toBe(404);
});
it.each(['parent', 'frozen', 'rights', 'approval', 'digest'])(
  'blocks a changed %s condition before publication',
  async (condition) => {
    const f = await fixture();
    if (condition === 'parent' || condition === 'frozen') {
      const story = await Story.findById(f.storyId);
      if (condition === 'parent') story.publicationStatus = 'unpublished';
      else story.authoringFrozen = true;
      await story.save();
      f.body.expectedStoryVersion = story.version;
    } else if (condition === 'rights') {
      const rights = await RightsDeclaration.findById(f.revision.rightsDeclarationId);
      rights.status = 'superseded';
      await rights.save();
    } else if (condition === 'approval') {
      f.submission.status = 'rejected';
      await f.submission.save();
    } else
      await ContentRevision.collection.updateOne(
        { _id: f.revision._id },
        { $set: { 'content.title': 'Bị thay ngoài luồng' } },
      );
    expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409);
    expect((await Chapter.findById(f.chapterId)).publishedRevisionId).toBeUndefined();
  },
);
it('rolls back publication and declaration/approval pins when audit fails', async () => {
  const f = await fixture();
  const rights = await RightsDeclaration.findById(f.revision.rightsDeclarationId);
  const sub = await PublicationSubmission.findById(f.submission._id);
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(500);
  const chapter = await Chapter.findById(f.chapterId);
  expect(chapter.firstReleasedAt).toBeUndefined();
  expect(chapter.publishedRevisionId).toBeUndefined();
  expect(chapter.version).toBe(f.body.expectedVersion);
  expect((await Story.findById(f.storyId)).version).toBe(f.body.expectedStoryVersion);
  expect((await RightsDeclaration.findById(rights._id)).version).toBe(rights.version);
  expect((await PublicationSubmission.findById(sub._id)).version).toBe(sub.version);
});
it('allows a human-approved terminal failure without rewriting the failed evidence', async () => {
  const f = await fixture();
  f.batch.status = 'failed';
  f.batch.failedStage = 'comparison';
  await f.batch.save();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
  expect((await EvidenceBatch.findById(f.batch._id)).status).toBe('failed');
});
it('rejects mismatched evidence digests and a ready batch at an unfinished stage', async () => {
  const f = await fixture();
  f.batch.stage = 'embedding';
  await f.batch.save();
  expect((await f.prepare()).body.checks.find((c) => c.code === 'evidence').ok).toBe(false);
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409);
  f.batch.stage = 'llm';
  f.batch.packageDigest = '0'.repeat(64);
  await f.batch.save();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(409);
});
it('preserves the first release time when a separately approved replacement is published', async () => {
  const f = await fixture();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
  const first = await Chapter.findById(f.chapterId);
  // Revision creation is normally driven by the revise/resubmit workflow.
  const source = f.revision.toObject();
  for (const key of [
    '_id',
    'createdAt',
    'updatedAt',
    'version',
    'immutableAt',
    'packageDigest',
    'rightsDigest',
    'mediaDigest',
    'rightsDeclarationId',
  ])
    delete source[key];
  source.revisionNumber += 1;
  source.status = 'editable';
  source.content = {
    title: 'Bản thay thế',
    blocks: [{ type: 'paragraph', text: 'Nội dung thay thế.' }],
  };
  const draft = await ContentRevision.create(source);
  first.draftRevisionId = draft._id;
  first.currentRevisionId = draft._id;
  first.status = 'draft';
  await first.save();
  const url = `/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`;
  expect(String(first.publishedRevisionId)).toBe(f.body.revisionId);
  const prepared = (
    await get(
      f.cookie,
      `/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${f.chapterId}`,
    )
  ).body;
  const sent = await write(f.cookie, '/api/author/submissions', {
    storyId: f.storyId,
    chapterId: f.chapterId,
    revisionId: String(draft._id),
    expectedVersion: prepared.target.version,
  });
  expect(sent.status).toBe(201);
  const replacement = await approve(sent);
  const candidate = (await f.prepare()).body.target;
  expect(
    (
      await write(f.cookie, f.endpoint, {
        revisionId: String(replacement.revision._id),
        submissionId: String(replacement.submission._id),
        expectedVersion: candidate.version,
        expectedStoryVersion: candidate.storyVersion,
      })
    ).status,
  ).toBe(201);
  expect((await Chapter.findById(f.chapterId)).firstReleasedAt).toEqual(first.firstReleasedAt);
  expect((await request(app).get(url)).body.chapter.title).toBe('Bản thay thế');
});

async function publishedFixture() {
  const f = await fixture();
  expect((await write(f.cookie, f.endpoint, f.body)).status).toBe(201);
  const workspace = (await get(f.cookie, `/api/author/stories/${f.storyId}/workspace`)).body;
  const row = workspace.chapters.find((chapter) => chapter.id === f.chapterId);
  expect(row.canUnpublish).toBe(true);
  return {
    ...f,
    lifecycleUrl: `/api/author/stories/${f.storyId}/chapters/${f.chapterId}/lifecycle`,
    lifecycleBody: {
      action: 'unpublish',
      expectedVersion: row.version,
      expectedStoryVersion: workspace.story.version,
    },
  };
}
it('unpublishes an owned chapter while retaining its snapshot and first-release history', async () => {
  const f = await publishedFixture();
  const before = await Chapter.findById(f.chapterId);
  expect((await write(f.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(200);
  const after = await Chapter.findById(f.chapterId);
  expect(after.status).toBe('unpublished');
  for (const field of [
    'publishedRevisionId',
    'currentRevisionId',
    'firstReleasedAt',
    'publishedAt',
    'orderKey',
  ])
    expect(after[field]).toEqual(before[field]);
  expect(after.publicationTransition.result).toBe('author-chapter-unpublished');
  expect(
    (await request(app).get(`/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`)).status,
  ).toBe(404);
  const workspace = (await get(f.cookie, `/api/author/stories/${f.storyId}/workspace`)).body;
  expect(workspace.chapters[0].canUnpublish).toBe(false);
  expect(workspace.stats.publishedChapters).toBe(0);
  expect(await ContentRevision.countDocuments({ _id: before.publishedRevisionId })).toBe(1);
  expect(await AuditEvent.countDocuments({ action: 'chapter.unpublished' })).toBe(1);
  expect((await f.prepare()).body.ready).toBe(false);
});
it('retains paid entitlements and the original early-access window without a financial write', async () => {
  const f = await publishedFixture();
  const chapter = await Chapter.findById(f.chapterId);
  const endsAt = new Date(Date.now() + 86400000);
  chapter.earlyAccess = { enabled: true, coinPrice: 10, durationDays: 1, endsAt };
  await chapter.save();
  f.lifecycleBody.expectedVersion = chapter.version;
  const reader = await authenticatedAccount();
  const unlock = await UnlockEntitlement.create({
    accountId: reader.account._id,
    storyId: f.storyId,
    chapterId: f.chapterId,
    publishedRevisionId: chapter.publishedRevisionId,
    status: 'active',
    purchasedAt: new Date(),
    expiresAt: endsAt,
    priceCoins: 10,
  });
  expect((await write(f.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(200);
  expect((await UnlockEntitlement.findById(unlock._id)).toObject()).toEqual(unlock.toObject());
  expect((await Chapter.findById(f.chapterId)).earlyAccess.toObject()).toEqual(
    chapter.earlyAccess.toObject(),
  );
  expect(
    (await get(reader.cookie, `/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`)).status,
  ).toBe(404);
});
it('allows only one concurrent unpublish and rejects stale or forged lifecycle input', async () => {
  const f = await publishedFixture();
  expect(
    (await write(f.cookie, f.lifecycleUrl, { ...f.lifecycleBody, expectedStoryVersion: 999 }))
      .status,
  ).toBe(409);
  expect(
    (await write(f.cookie, f.lifecycleUrl, { ...f.lifecycleBody, expectedVersion: 999 })).status,
  ).toBe(409);
  expect(
    (await write(f.cookie, f.lifecycleUrl, { ...f.lifecycleBody, status: 'unpublished' })).status,
  ).toBe(400);
  expect(
    (await write(f.cookie, f.lifecycleUrl, { ...f.lifecycleBody, action: 'republish' })).status,
  ).toBe(400);
  const results = await Promise.all([
    write(f.cookie, f.lifecycleUrl, f.lifecycleBody),
    write(f.cookie, f.lifecycleUrl, f.lifecycleBody),
  ]);
  expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  expect(await AuditEvent.countDocuments({ action: 'chapter.unpublished' })).toBe(1);
});
it('blocks unpublishing by other authors or non-authors and while the parent is frozen', async () => {
  const f = await publishedFixture();
  const other = await authenticatedAccount('author');
  expect((await write(other.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(404);
  for (const role of ['reader', 'admin', 'moderator']) {
    const account = await authenticatedAccount(role);
    expect((await write(account.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(403);
  }
  const story = await Story.findById(f.storyId);
  story.authoringFrozen = true;
  await story.save();
  f.lifecycleBody.expectedStoryVersion = story.version;
  expect((await write(f.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(409);
  expect((await Chapter.findById(f.chapterId)).status).toBe('published');
});
it('rolls back chapter and parent versions when an unpublish audit fails', async () => {
  const f = await publishedFixture();
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
  expect((await write(f.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(500);
  const chapter = await Chapter.findById(f.chapterId);
  expect(chapter.status).toBe('published');
  expect(chapter.version).toBe(f.lifecycleBody.expectedVersion);
  expect((await Story.findById(f.storyId)).version).toBe(f.lifecycleBody.expectedStoryVersion);
  expect(await AuditEvent.countDocuments({ action: 'chapter.unpublished' })).toBe(0);
});
async function unpublishedFixture() {
  const f = await publishedFixture();
  expect((await write(f.cookie, f.lifecycleUrl, f.lifecycleBody)).status).toBe(200);
  const workspace = (await get(f.cookie, `/api/author/stories/${f.storyId}/workspace`)).body;
  const source = workspace.chapters[0].reviseSource;
  expect(source.id).toBe(String(f.submission._id));
  return {
    ...f,
    reviseUrl: `/api/author/submissions/${source.id}/revise`,
    reviseBody: { expectedVersion: source.version },
  };
}
it('creates one fresh private revision from unpublished approved content and preserves the old package', async () => {
  const f = await unpublishedFixture();
  const before = await Chapter.findById(f.chapterId);
  const old = await ContentRevision.findById(before.publishedRevisionId).lean();
  const feed = (await get(f.cookie, '/api/author/submissions')).body;
  expect(feed.items.find((row) => row.id === String(f.submission._id)).canRevise).toBe(true);
  const results = await Promise.all([
    write(f.cookie, f.reviseUrl, f.reviseBody),
    write(f.cookie, f.reviseUrl, f.reviseBody),
  ]);
  expect(results.map((row) => row.status).sort()).toEqual([200, 201]);
  expect(results[0].body.revision.id).toBe(results[1].body.revision.id);
  const after = await Chapter.findById(f.chapterId);
  const fresh = await ContentRevision.findById(after.draftRevisionId);
  expect(after.status).toBe('draft');
  expect(after.firstReleasedAt).toEqual(before.firstReleasedAt);
  expect(after.publishedRevisionId).toEqual(before.publishedRevisionId);
  expect(fresh.status).toBe('editable');
  expect(fresh.content).toEqual(old.content);
  expect(String(fresh.parentRevisionId)).toBe(String(old._id));
  expect(fresh.immutableAt).toBeUndefined();
  expect(fresh.packageDigest).toBeUndefined();
  expect(fresh.rightsDeclarationId).toBeUndefined();
  expect(await ContentRevision.findById(old._id).lean()).toEqual(old);
  expect(
    (await request(app).get(`/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`)).status,
  ).toBe(404);
  expect((await f.prepare()).body.ready).toBe(false);
  const prepared = (
    await get(
      f.cookie,
      `/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${f.chapterId}`,
    )
  ).body;
  expect(prepared.ready).toBe(true);
  const sent = await write(f.cookie, '/api/author/submissions', {
    storyId: f.storyId,
    chapterId: f.chapterId,
    revisionId: String(fresh._id),
    expectedVersion: prepared.target.version,
  });
  expect(sent.status).toBe(201);
  expect((await f.prepare()).body.ready).toBe(false);
  expect((await PublicationSubmission.findById(sent.body.submission.id)).status).toBe('validated');
});
it('does not offer a fresh approved-source revision while the chapter is still published', async () => {
  const f = await publishedFixture();
  const sub = await PublicationSubmission.findById(f.submission._id);
  const feed = (await get(f.cookie, '/api/author/submissions')).body;
  expect(feed.items.find((row) => row.id === String(sub._id)).canRevise).toBe(false);
  expect(
    (
      await write(f.cookie, `/api/author/submissions/${sub._id}/revise`, {
        expectedVersion: sub.version,
      })
    ).status,
  ).toBe(409);
});
it('rejects stale or foreign unpublished revision requests and a corrupt immutable source', async () => {
  const f = await unpublishedFixture();
  expect((await write(f.cookie, f.reviseUrl, { expectedVersion: 999 })).status).toBe(409);
  const other = await authenticatedAccount('author');
  expect((await write(other.cookie, f.reviseUrl, f.reviseBody)).status).toBe(404);
  await ContentRevision.collection.updateOne(
    { _id: f.revision._id },
    { $set: { 'content.title': 'Corrupt source' } },
  );
  expect((await write(f.cookie, f.reviseUrl, f.reviseBody)).status).toBe(409);
  expect((await Chapter.findById(f.chapterId)).status).toBe('unpublished');
});
it('rolls back an unpublished revision and parent versions when its audit fails', async () => {
  const f = await unpublishedFixture();
  const chapter = await Chapter.findById(f.chapterId);
  const story = await Story.findById(f.storyId);
  const count = await ContentRevision.countDocuments();
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
  expect((await write(f.cookie, f.reviseUrl, f.reviseBody)).status).toBe(500);
  expect(await ContentRevision.countDocuments()).toBe(count);
  expect((await Chapter.findById(f.chapterId)).version).toBe(chapter.version);
  expect((await Story.findById(f.storyId)).version).toBe(story.version);
});

const schedulerConfig = testConfig({ cookieName: 'novelhub_session', corsOrigin: origin });
async function scheduleFixture(options) {
  const f = await fixture(options);
  f.scheduleUrl = f.endpoint.replace(/release$/, 'schedule');
  f.releaseAt = new Date(Date.now() + 60000);
  f.scheduleBody = { ...f.body, requestedReleaseAt: f.releaseAt.toISOString() };
  return f;
}
it('persists an approved schedule without early visibility, then publishes once after restart', async () => {
  const f = await scheduleFixture();
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(200);
  expect((await Chapter.findById(f.chapterId)).status).toBe('scheduled');
  expect(await releaseDueChapters(schedulerConfig)).toEqual({ published: 0, deferred: 0 });
  expect(
    (await request(app).get(`/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`)).status,
  ).toBe(404);
  expect(await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).toEqual({
    published: 1,
    deferred: 0,
  });
  const published = await Chapter.findById(f.chapterId);
  expect(published.firstReleasedAt).toEqual(f.releaseAt);
  expect(String(published.publishedRevisionId)).toBe(f.body.revisionId);
  expect(
    (await request(app).get(`/api/catalog/stories/${f.storyId}/chapters/${f.chapterId}`)).status,
  ).toBe(200);
  await releaseDueChapters(schedulerConfig, { now: f.releaseAt });
  expect(await AuditEvent.countDocuments({ action: 'chapter.published' })).toBe(1);
});
it('keeps due chapters private while blocked and automatically retries when order permits', async () => {
  const f = await scheduleFixture({ preceding: true });
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(200);
  expect(await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).toEqual({
    published: 0,
    deferred: 1,
  });
  expect((await Chapter.findById(f.chapterId)).status).toBe('due');
  await releaseDueChapters(schedulerConfig, { now: f.releaseAt });
  expect(await AuditEvent.countDocuments({ action: 'chapter.release-deferred' })).toBe(1);
  const earlier = await Chapter.findById(f.earlier.id);
  earlier.firstReleasedAt = new Date();
  earlier.status = 'unpublished';
  await earlier.save();
  expect(await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).toEqual({
    published: 1,
    deferred: 0,
  });
});
it.each(['suspended', 'role-revoked', 'frozen', 'rights', 'approval', 'paid'])(
  'rechecks %s at the actual scheduled release and retains the private binding',
  async (guard) => {
    const f = await scheduleFixture();
    expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(200);
    if (guard === 'suspended')
      await Account.updateOne({ _id: f.author.account._id }, { status: 'suspended' });
    if (guard === 'role-revoked')
      await RoleAssignment.updateOne(
        { accountId: f.author.account._id, role: 'author' },
        { status: 'revoked' },
      );
    if (guard === 'frozen') await Story.updateOne({ _id: f.storyId }, { authoringFrozen: true });
    if (guard === 'rights')
      await RightsDeclaration.updateOne(
        { _id: f.revision.rightsDeclarationId, status: 'asserted' },
        { $set: { status: 'superseded' } },
      );
    if (guard === 'approval')
      await PublicationSubmission.updateOne({ _id: f.submission._id }, { status: 'rejected' });
    if (guard === 'paid')
      await Chapter.updateOne(
        { _id: f.chapterId },
        { earlyAccess: { enabled: true, coinPrice: 10, durationDays: 7 } },
      );
    expect((await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).published).toBe(0);
    expect((await Chapter.findById(f.chapterId)).publishedRevisionId).toBeUndefined();
  },
);
it('cancels a schedule using fresh versions and rejects stale, foreign and malformed requests', async () => {
  const f = await scheduleFixture();
  expect(
    (
      await write(
        f.cookie,
        f.scheduleUrl,
        { ...f.scheduleBody, requestedReleaseAt: 'tomorrow' },
        'put',
      )
    ).status,
  ).toBe(400);
  const other = await authenticatedAccount('author');
  expect((await write(other.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(404);
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(200);
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(409);
  const target = (await f.prepare()).body.target;
  expect(
    (
      await write(
        f.cookie,
        f.scheduleUrl,
        {
          ...f.scheduleBody,
          expectedVersion: target.version,
          expectedStoryVersion: target.storyVersion,
          requestedReleaseAt: null,
        },
        'put',
      )
    ).status,
  ).toBe(200);
  const chapter = await Chapter.findById(f.chapterId);
  expect(chapter.status).toBe('approved');
  expect(chapter.requestedReleaseAt).toBeUndefined();
  expect((await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).published).toBe(0);
});
it('rolls back a schedule and parent version when audit storage fails', async () => {
  const f = await scheduleFixture();
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(500);
  expect((await Chapter.findById(f.chapterId)).status).toBe('approved');
  expect((await Story.findById(f.storyId)).version).toBe(f.body.expectedStoryVersion);
});
it('serializes competing scheduler sweeps into one published revision and audit', async () => {
  const f = await scheduleFixture();
  await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put');
  await Promise.all([
    releaseDueChapters(schedulerConfig, { now: f.releaseAt }),
    releaseDueChapters(schedulerConfig, { now: f.releaseAt }),
  ]);
  expect((await Chapter.findById(f.chapterId)).status).toBe('published');
  expect(await AuditEvent.countDocuments({ action: 'chapter.published' })).toBe(1);
});
it('accepts an elapsed release time as due and never releases approval without an explicit schedule', async () => {
  const f = await scheduleFixture();
  expect((await releaseDueChapters(schedulerConfig)).published).toBe(0);
  expect((await Chapter.findById(f.chapterId)).status).toBe('approved');
  expect(
    (
      await write(
        f.cookie,
        f.scheduleUrl,
        { ...f.scheduleBody, requestedReleaseAt: new Date(Date.now() - 1000).toISOString() },
        'put',
      )
    ).body.chapter.status,
  ).toBe('due');
  expect((await releaseDueChapters(schedulerConfig)).published).toBe(1);
});
it('replaces a schedule with fresh versions and honors the later time', async () => {
  const f = await scheduleFixture();
  await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put');
  const target = (await f.prepare()).body.target;
  const later = new Date(f.releaseAt.getTime() + 60000);
  expect(
    (
      await write(
        f.cookie,
        f.scheduleUrl,
        {
          ...f.scheduleBody,
          expectedVersion: target.version,
          expectedStoryVersion: target.storyVersion,
          requestedReleaseAt: later.toISOString(),
        },
        'put',
      )
    ).status,
  ).toBe(200);
  expect((await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).published).toBe(0);
  expect((await releaseDueChapters(schedulerConfig, { now: later })).published).toBe(1);
});
it('allows cancelling a scheduled package even when its immutable package is no longer valid', async () => {
  const f = await scheduleFixture();
  await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put');
  await ContentRevision.collection.updateOne(
    { _id: f.revision._id },
    { $set: { 'content.title': 'Corrupt fixture' } },
  );
  const chapter = await Chapter.findById(f.chapterId);
  const story = await Story.findById(f.storyId);
  expect(
    (
      await write(
        f.cookie,
        f.scheduleUrl,
        {
          ...f.scheduleBody,
          expectedVersion: chapter.version,
          expectedStoryVersion: story.version,
          requestedReleaseAt: null,
        },
        'put',
      )
    ).status,
  ).toBe(200);
  expect((await Chapter.findById(f.chapterId)).status).toBe('approved');
});
it('rolls back a failed scheduled publication, records deferral, and retries without duplicate release', async () => {
  const f = await scheduleFixture();
  await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put');
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected release audit failure'));
  expect(await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).toEqual({
    published: 0,
    deferred: 1,
  });
  const chapter = await Chapter.findById(f.chapterId);
  expect(chapter.status).toBe('due');
  expect(chapter.publishedRevisionId).toBeUndefined();
  expect(chapter.firstReleasedAt).toBeUndefined();
  expect(chapter.publicationTransition.failure).toBe('release_error');
  expect(await AuditEvent.countDocuments({ action: 'chapter.published' })).toBe(0);
  expect((await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).published).toBe(1);
  expect(await AuditEvent.countDocuments({ action: 'chapter.published' })).toBe(1);
});
it('cascades through approved due chapters in first-release order in the same sweep', async () => {
  const f = await scheduleFixture({ preceding: true });
  const prep = (
    await get(
      f.cookie,
      `/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${f.earlier.id}`,
    )
  ).body;
  await approve(
    await write(f.cookie, '/api/author/submissions', {
      storyId: f.storyId,
      chapterId: f.earlier.id,
      revisionId: prep.target.revisionId,
      expectedVersion: prep.target.version,
    }),
  );
  const current = (await f.prepare()).body.target;
  f.scheduleBody.expectedVersion = current.version;
  f.scheduleBody.expectedStoryVersion = current.storyVersion;
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(200);
  const earlierUrl = `/api/author/stories/${f.storyId}/chapters/${f.earlier.id}`;
  const target = (await get(f.cookie, `${earlierUrl}/release`)).body.target;
  expect(
    (
      await write(
        f.cookie,
        `${earlierUrl}/schedule`,
        {
          revisionId: target.revisionId,
          submissionId: target.submissionId,
          expectedVersion: target.version,
          expectedStoryVersion: target.storyVersion,
          requestedReleaseAt: f.releaseAt.toISOString(),
        },
        'put',
      )
    ).status,
  ).toBe(200);
  expect(await releaseDueChapters(schedulerConfig, { now: f.releaseAt })).toEqual({
    published: 2,
    deferred: 0,
  });
  const audits = await AuditEvent.find({ action: 'chapter.published' }).sort({ _id: 1 });
  expect(audits.map((audit) => String(audit.targetId))).toEqual([f.earlier.id, f.chapterId]);
});
it('rejects scheduling a chapter whose parent is archived', async () => {
  const f = await scheduleFixture();
  await Story.updateOne({ _id: f.storyId }, { publicationStatus: 'archived' });
  expect((await write(f.cookie, f.scheduleUrl, f.scheduleBody, 'put')).status).toBe(409);
  expect((await Chapter.findById(f.chapterId)).status).toBe('approved');
});
