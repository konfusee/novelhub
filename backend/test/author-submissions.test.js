import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  PublicationSubmission,
  RightsDeclaration,
  Story,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
const write = (path, cookie, body, method = 'post') =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body);
async function fixture() {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const reader = await authenticatedAccount();
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  });
  const created = await write('/api/author/stories', author.cookie, {
    title: 'Bản nháp của tôi',
    description: 'Tóm tắt thật để gửi duyệt.',
    categoryIds: [String(category._id)],
  });
  const storyId = created.body.story.id;
  const prepare = () =>
    request(app)
      .get(`/api/author/submissions/prepare?storyId=${storyId}`)
      .set('Cookie', author.cookie);
  const prepared = (await prepare()).body;
  const body = {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  };
  return { author, other, reader, category, storyId, body, prepare };
}
describe('exact owner submission packages', () => {
  it('blocks inactive genres and unhandled media without freezing or creating evidence', async () => {
    const f = await fixture();
    f.category.status = 'retired';
    await f.category.save();
    expect((await f.prepare()).body.checks.find((row) => row.code === 'categories').ok).toBe(false);
    expect((await write('/api/author/submissions', f.author.cookie, f.body)).status).toBe(409);
    f.category.status = 'active';
    await f.category.save();
    const story = await Story.findById(f.storyId);
    story.theme = { coverBannerMediaId: f.category._id };
    await story.save();
    expect((await f.prepare()).body.checks.find((row) => row.code === 'media').ok).toBe(false);
    expect(
      (
        await write('/api/author/submissions', f.author.cookie, {
          ...f.body,
          expectedVersion: story.version,
        })
      ).status,
    ).toBe(409);
    expect(await PublicationSubmission.countDocuments()).toBe(0);
    expect(await EvidenceBatch.countDocuments()).toBe(0);
    expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeUndefined();
  });
  it('freezes once atomically, preserves the public snapshot and replays identical concurrent submissions', async () => {
    const f = await fixture();
    const story = await Story.findById(f.storyId);
    const publicRevision = await ContentRevision.create({
      storyId: story._id,
      authorAccountId: f.author.account._id,
      contentType: 'story',
      revisionNumber: 2,
      formatVersion: 'story-v1',
      status: 'approved',
      content: {
        title: 'Tên đang công khai',
        description: 'Public snapshot',
        categoryIds: [String(f.category._id)],
      },
    });
    story.publicationStatus = 'published';
    story.publishedRevisionId = publicRevision._id;
    await story.save();
    f.body.expectedVersion = story.version;
    const results = await Promise.all([
      write('/api/author/submissions', f.author.cookie, f.body),
      write('/api/author/submissions', f.author.cookie, f.body),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
    expect(results[0].body.submission.id).toBe(results[1].body.submission.id);
    for (const Model of [
      PublicationSubmission,
      EvidenceBatch,
      RightsDeclaration,
      AuditEvent,
      ModerationHistory,
    ])
      expect(await Model.countDocuments()).toBe(1);
    const revision = await ContentRevision.findById(f.body.revisionId);
    expect(revision.status).toBe('submitted');
    expect(revision.immutableAt).toBeTruthy();
    expect(revision.packageDigest).toMatch(/^[a-f0-9]{64}$/);
    revision.set('content', { ...revision.content, title: 'Không được ghi đè' });
    await expect(revision.save()).rejects.toThrow();
    const saved = await Story.findById(f.storyId);
    expect(saved.publicationStatus).toBe('published');
    expect(String(saved.publishedRevisionId)).toBe(String(publicRevision._id));
    expect(saved.authoringFrozen).toBe(true);
    expect((await EvidenceBatch.findOne()).status).toBe('pending');
    expect((await PublicationSubmission.findOne()).status).toBe('validated');
    const list = await request(app).get('/api/author/submissions').set('Cookie', f.author.cookie);
    expect(list.body.items[0]).toMatchObject({
      title: 'Bản nháp của tôi',
      status: 'validated',
      processing: { status: 'pending' },
    });
    expect(list.body.items[0].history[0].action).toBe('submitted');
    expect(
      (await request(app).get('/api/author/submissions').set('Cookie', f.other.cookie)).body.items,
    ).toEqual([]);
    expect(
      (
        await write('/api/author/submissions', f.author.cookie, {
          ...f.body,
          rights: { ...f.body.rights, basis: 'licensed' },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await write(
          `/api/author/stories/${f.storyId}`,
          f.author.cookie,
          {
            title: 'Stale save',
            description: 'Không sửa khi chờ duyệt',
            expectedVersion: saved.version,
          },
          'put',
        )
      ).status,
    ).toBe(409);
  });
  it('rejects forged ownership, missing rights, stale versions and invalid package content', async () => {
    const f = await fixture();
    expect((await write('/api/author/submissions', f.other.cookie, f.body)).status).toBe(404);
    expect((await write('/api/author/submissions', f.reader.cookie, f.body)).status).toBe(403);
    expect(
      (
        await write('/api/author/submissions', f.author.cookie, {
          ...f.body,
          authorAccountId: String(f.other.account._id),
        })
      ).status,
    ).toBe(400);
    expect(
      (await write('/api/author/submissions', f.author.cookie, { ...f.body, rights: undefined }))
        .status,
    ).toBe(400);
    expect(
      (await write('/api/author/submissions', f.author.cookie, { ...f.body, expectedVersion: 100 }))
        .status,
    ).toBe(409);
    const revision = await ContentRevision.findById(f.body.revisionId);
    revision.content = { ...revision.content, description: '<script>alert(1)</script>' };
    await revision.save();
    expect((await f.prepare()).body.checks.find((check) => check.code === 'content').ok).toBe(
      false,
    );
    expect((await write('/api/author/submissions', f.author.cookie, f.body)).status).toBe(409);
    expect(await PublicationSubmission.countDocuments()).toBe(0);
  });
  it('rolls back revision locks and all related records when the final audit write fails', async () => {
    const f = await fixture();
    vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
    expect((await write('/api/author/submissions', f.author.cookie, f.body)).status).toBe(500);
    expect((await ContentRevision.findById(f.body.revisionId)).immutableAt).toBeFalsy();
    expect((await Story.findById(f.storyId)).authoringFrozen).toBe(false);
    for (const Model of [
      PublicationSubmission,
      EvidenceBatch,
      RightsDeclaration,
      ModerationHistory,
    ])
      expect(await Model.countDocuments()).toBe(0);
  });
  it('submits a chapter only under an approved parent with frozen story rights', async () => {
    const f = await fixture();
    const created = await write(`/api/author/stories/${f.storyId}/chapters`, f.author.cookie, {
      title: 'Chương thật',
      paragraphs: ['Nội dung chương hoàn chỉnh.'],
    });
    const chapterId = created.body.chapter.id;
    const prepare = () =>
      request(app)
        .get(`/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${chapterId}`)
        .set('Cookie', f.author.cookie);
    expect((await prepare()).body.checks.find((check) => check.code === 'parent').ok).toBe(false);
    const story = await Story.findById(f.storyId);
    const revision = await ContentRevision.findById(story.currentRevisionId);
    revision.status = 'approved';
    revision.immutableAt = new Date();
    await revision.save();
    const submission = await PublicationSubmission.create({
      storyId: story._id,
      revisionId: revision._id,
      authorAccountId: f.author.account._id,
      status: 'approved',
    });
    await RightsDeclaration.create({
      storyId: story._id,
      submissionId: submission._id,
      revisionId: revision._id,
      basis: 'original',
      asserted: true,
      declaredBy: f.author.account._id,
      status: 'asserted',
      immutableAt: new Date(),
    });
    story.publicationStatus = 'approved';
    await story.save();
    const prepared = (await prepare()).body;
    expect(prepared.ready).toBe(true);
    expect(prepared.requiresRights).toBe(false);
    const body = {
      storyId: f.storyId,
      chapterId,
      revisionId: prepared.target.revisionId,
      expectedVersion: prepared.target.version,
    };
    expect((await write('/api/author/submissions', f.author.cookie, body)).status).toBe(201);
    expect((await Chapter.findById(chapterId)).status).toBe('submitted');
    expect(await RightsDeclaration.countDocuments()).toBe(1);
  });
});
