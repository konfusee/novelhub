import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  AuditEvent,
  Category,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  Notification,
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
const write = (path, cookie, body) =>
  request(app).post(path).set('Cookie', cookie).set('Origin', 'http://localhost:5173').send(body);
async function fixture() {
  const author = await authenticatedAccount('author'),
    mod = await authenticatedAccount('moderator');
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() - 1000),
    actorAccountId: mod.account._id,
    claimExpiryHours: 2,
  });
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  });
  const created = await write('/api/author/stories', author.cookie, {
    title: 'Thông tin cần duyệt',
    description: 'Tóm tắt hợp lệ để gửi duyệt.',
    categoryIds: [String(category._id)],
  });
  const storyId = created.body.story.id;
  const prepared = (
    await request(app)
      .get(`/api/author/submissions/prepare?storyId=${storyId}`)
      .set('Cookie', author.cookie)
  ).body;
  const sent = await write('/api/author/submissions', author.cookie, {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  });
  expect(sent.status).toBe(201);
  const id = sent.body.submission.id;
  const path = `/api/moderator/manual-reviews/${id}`;
  const read = () => request(app).get(path).set('Cookie', mod.cookie);
  const admit = async () => {
    const s = (await read()).body;
    return write(`${path}/admit`, mod.cookie, {
      expectedVersion: s.submission.version,
      revisionId: s.revision.id,
      expectedEvidenceVersion: s.evidence.version,
      confirmedManualReview: true,
      reason: 'Tiếp nhận duyệt thủ công khi AI đang tạm hoãn.',
    });
  };
  const claim = async () => {
    const s = (await read()).body;
    return write(`/api/moderator/review-claims/${id}`, mod.cookie, {
      expectedVersion: s.submission.version,
      expectedClaimVersion: s.submission.claimVersion,
    });
  };
  const decision = async (outcome = 'approved') => {
    const s = (await read()).body;
    return {
      expectedVersion: s.submission.version,
      expectedClaimVersion: s.submission.claimVersion,
      revisionId: s.revision.id,
      expectedRevisionVersion: s.revision.version,
      evidenceBatchId: s.evidence.id,
      expectedEvidenceVersion: s.evidence.version,
      outcome,
      confirmedManualReview: true,
      reason: 'Đã đọc và đối chiếu nội dung cùng khai báo quyền.',
    };
  };
  return { author, mod, storyId, id, path, read, admit, claim, decision };
}
it('admits, claims and approves a real submitted package without faking AI, then allows Author release', async () => {
  const f = await fixture();
  expect((await f.read()).body.canAdmit).toBe(true);
  expect((await f.admit()).status).toBe(200);
  expect((await f.claim()).status).toBe(200);
  const input = await f.decision();
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(200);
  const submission = await PublicationSubmission.findById(f.id);
  expect(submission.status).toBe('approved');
  expect(submission.claimOwnerAccountId).toBeUndefined();
  expect((await Story.findById(f.storyId)).authoringFrozen).toBe(false);
  expect((await Story.findById(f.storyId)).publicationStatus).toBe('approved');
  expect((await EvidenceBatch.findById(submission.currentEvidenceBatchId)).status).toBe('pending');
  expect(
    await ModerationHistory.countDocuments({
      action: 'manual-review.decided',
      outcome: 'approved',
    }),
  ).toBe(1);
  expect(await Notification.countDocuments({ eventType: 'publication.decided' })).toBe(1);
  const history = await request(app)
    .get('/api/moderator/manual-reviews/history')
    .set('Cookie', f.mod.cookie);
  expect(history.status).toBe(200);
  expect(history.headers['cache-control']).toBe('private, no-store');
  expect(history.body.items[0]).toMatchObject({
    submissionId: f.id,
    revisionId: input.revisionId,
    outcome: 'approved',
    reason: input.reason,
  });
  const otherModerator = await authenticatedAccount('moderator');
  expect(
    (
      await request(app)
        .get('/api/moderator/manual-reviews/history')
        .set('Cookie', otherModerator.cookie)
    ).body.items,
  ).toEqual([]);
  expect(
    (
      await request(app)
        .get('/api/moderator/manual-reviews/history?outcome=rejected')
        .set('Cookie', f.mod.cookie)
    ).body.items,
  ).toEqual([]);
  expect(
    (
      await request(app)
        .get('/api/moderator/manual-reviews/history?outcome=unknown')
        .set('Cookie', f.mod.cookie)
    ).status,
  ).toBe(400);
  const releasePath = `/api/author/stories/${f.storyId}/release`;
  const ready = (await request(app).get(releasePath).set('Cookie', f.author.cookie)).body;
  expect(ready.ready).toBe(true);
  expect(
    (
      await write(releasePath, f.author.cookie, {
        revisionId: input.revisionId,
        submissionId: f.id,
        expectedVersion: ready.target.version,
      })
    ).status,
  ).toBe(201);
  expect((await request(app).get(`/api/catalog/stories/${f.storyId}`)).status).toBe(200);
  const notifications = (
    await request(app).get('/api/reader/notifications').set('Cookie', f.author.cookie)
  ).body;
  expect(notifications.items.find((n) => n.status === 'approved').href).toBe('/author/submissions');
  const chapter = (
    await write(`/api/author/stories/${f.storyId}/chapters`, f.author.cookie, {
      title: 'Chương duyệt thủ công',
      paragraphs: ['Nội dung chương được duyệt thật.'],
    })
  ).body.chapter;
  const prepared = (
    await request(app)
      .get(`/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${chapter.id}`)
      .set('Cookie', f.author.cookie)
  ).body;
  const sent = await write('/api/author/submissions', f.author.cookie, {
    storyId: f.storyId,
    chapterId: chapter.id,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
  });
  expect(sent.status).toBe(201);
  const chapterReviewPath = `/api/moderator/manual-reviews/${sent.body.submission.id}`;
  const readChapterReview = async () =>
    (await request(app).get(chapterReviewPath).set('Cookie', f.mod.cookie)).body;
  let next = await readChapterReview();
  expect(next.paragraphs).toEqual(['Nội dung chương được duyệt thật.']);
  expect(
    (
      await write(`${chapterReviewPath}/admit`, f.mod.cookie, {
        expectedVersion: next.submission.version,
        revisionId: next.revision.id,
        expectedEvidenceVersion: next.evidence.version,
        confirmedManualReview: true,
        reason: input.reason,
      })
    ).status,
  ).toBe(200);
  next = await readChapterReview();
  expect(
    (
      await write(`/api/moderator/review-claims/${next.submission.id}`, f.mod.cookie, {
        expectedVersion: next.submission.version,
        expectedClaimVersion: next.submission.claimVersion,
      })
    ).status,
  ).toBe(200);
  next = await readChapterReview();
  expect(
    (
      await write(`${chapterReviewPath}/decision`, f.mod.cookie, {
        expectedVersion: next.submission.version,
        expectedClaimVersion: next.submission.claimVersion,
        revisionId: next.revision.id,
        expectedRevisionVersion: next.revision.version,
        evidenceBatchId: next.evidence.id,
        expectedEvidenceVersion: next.evidence.version,
        confirmedManualReview: true,
        reason: input.reason,
        outcome: 'approved',
      })
    ).status,
  ).toBe(200);
  const chapterReleasePath = `/api/author/stories/${f.storyId}/chapters/${chapter.id}/release`;
  const chapterReady = (await request(app).get(chapterReleasePath).set('Cookie', f.author.cookie))
    .body;
  expect(chapterReady.ready).toBe(true);
  expect(
    (
      await write(chapterReleasePath, f.author.cookie, {
        revisionId: chapterReady.target.revisionId,
        submissionId: chapterReady.target.submissionId,
        expectedVersion: chapterReady.target.version,
        expectedStoryVersion: chapterReady.target.storyVersion,
      })
    ).status,
  ).toBe(201);
  expect(
    (await request(app).get(`/api/catalog/stories/${f.storyId}/chapters/${chapter.id}`)).status,
  ).toBe(200);
  const publicChapter = `/api/catalog/stories/${f.storyId}/chapters/${chapter.id}`;
  const beforeEdit = (await request(app).get(publicChapter)).body;
  const approvedSource = await PublicationSubmission.findById(chapterReady.target.submissionId);
  expect(
    (
      await write(`/api/author/submissions/${approvedSource._id}/revise`, f.author.cookie, {
        expectedVersion: approvedSource.version,
      })
    ).status,
  ).toBe(201);
  const editorPath = `/api/author/stories/${f.storyId}/chapters/${chapter.id}`;
  const editor = (await request(app).get(editorPath).set('Cookie', f.author.cookie)).body.chapter;
  expect(
    (
      await request(app)
        .put(editorPath)
        .set('Cookie', f.author.cookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          expectedVersion: editor.version,
          title: 'Bản sửa đang duyệt',
          paragraphs: ['Nội dung sửa cần duyệt lại.'],
        })
    ).status,
  ).toBe(200);
  const editPrep = (
    await request(app)
      .get(`/api/author/submissions/prepare?storyId=${f.storyId}&chapterId=${chapter.id}`)
      .set('Cookie', f.author.cookie)
  ).body;
  const editSent = await write('/api/author/submissions', f.author.cookie, {
    storyId: f.storyId,
    chapterId: chapter.id,
    revisionId: editPrep.target.revisionId,
    expectedVersion: editPrep.target.version,
  });
  expect(editSent.status).toBe(201);
  const editPath = `/api/moderator/manual-reviews/${editSent.body.submission.id}`;
  const readEdit = async () => (await request(app).get(editPath).set('Cookie', f.mod.cookie)).body;
  let edit = await readEdit();
  expect(
    (
      await write(`${editPath}/admit`, f.mod.cookie, {
        expectedVersion: edit.submission.version,
        revisionId: edit.revision.id,
        expectedEvidenceVersion: edit.evidence.version,
        confirmedManualReview: true,
        reason: input.reason,
      })
    ).status,
  ).toBe(200);
  edit = await readEdit();
  expect(
    (
      await write(`/api/moderator/review-claims/${edit.submission.id}`, f.mod.cookie, {
        expectedVersion: edit.submission.version,
        expectedClaimVersion: edit.submission.claimVersion,
      })
    ).status,
  ).toBe(200);
  edit = await readEdit();
  expect(
    (
      await write(`${editPath}/decision`, f.mod.cookie, {
        expectedVersion: edit.submission.version,
        expectedClaimVersion: edit.submission.claimVersion,
        revisionId: edit.revision.id,
        expectedRevisionVersion: edit.revision.version,
        evidenceBatchId: edit.evidence.id,
        expectedEvidenceVersion: edit.evidence.version,
        confirmedManualReview: true,
        reason: input.reason,
        outcome: 'approved',
      })
    ).status,
  ).toBe(200);
  expect((await request(app).get(publicChapter)).body.chapter.revisionId).toBe(
    beforeEdit.chapter.revisionId,
  );
  const replacement = (await request(app).get(chapterReleasePath).set('Cookie', f.author.cookie))
    .body;
  expect(replacement.ready).toBe(true);
  expect(
    (
      await write(chapterReleasePath, f.author.cookie, {
        revisionId: replacement.target.revisionId,
        submissionId: replacement.target.submissionId,
        expectedVersion: replacement.target.version,
        expectedStoryVersion: replacement.target.storyVersion,
      })
    ).status,
  ).toBe(201);
  expect((await request(app).get(publicChapter)).body.chapter.revisionId).toBe(
    replacement.target.revisionId,
  );
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(409);
});
it('requires a live owned claim and exact revision/evidence versions, permitting only one concurrent decision', async () => {
  const f = await fixture();
  await f.admit();
  expect((await write(`${f.path}/decision`, f.mod.cookie, await f.decision())).status).toBe(409);
  await f.claim();
  const input = await f.decision();
  expect(
    (await write(`${f.path}/decision`, f.mod.cookie, { ...input, expectedEvidenceVersion: 99 }))
      .status,
  ).toBe(409);
  const results = await Promise.all([
    write(`${f.path}/decision`, f.mod.cookie, input),
    write(`${f.path}/decision`, f.mod.cookie, { ...input, outcome: 'rejected' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await ModerationHistory.countDocuments({ action: 'manual-review.decided' })).toBe(1);
});
it('keeps actionable revision feedback and creates a fresh editable revision through the Author API', async () => {
  const f = await fixture();
  await f.admit();
  await f.claim();
  const input = await f.decision('revision-requested');
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(200);
  const s = await PublicationSubmission.findById(f.id);
  expect(s.decisionSummary).toBe(input.reason);
  const revised = await write(`/api/author/submissions/${f.id}/revise`, f.author.cookie, {
    expectedVersion: s.version,
  });
  expect(revised.status).toBe(201);
  expect((await ContentRevision.findById(input.revisionId)).immutableAt).toBeTruthy();
  expect((await PublicationSubmission.findById(f.id)).status).toBe('revision-requested');
  expect((await f.read()).status).toBe(200);
});
it('does not approve retired categories or release against changed evidence', async () => {
  const f = await fixture();
  await f.admit();
  await f.claim();
  const input = await f.decision();
  await Category.updateMany({}, { $set: { status: 'retired' } });
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(409);
  expect((await PublicationSubmission.findById(f.id)).status).toBe('pending-review');
  await Category.updateMany({}, { $set: { status: 'active' } });
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(200);
  await EvidenceBatch.updateOne({ _id: input.evidenceBatchId }, { $inc: { version: 1 } });
  const ready = (
    await request(app)
      .get(`/api/author/stories/${f.storyId}/release`)
      .set('Cookie', f.author.cookie)
  ).body;
  expect(ready.ready).toBe(false);
  expect(ready.checks.find((c) => c.code === 'evidence').ok).toBe(false);
});
it('rolls back decision, claim release, target status and notification when audit fails', async () => {
  const f = await fixture();
  await f.admit();
  await f.claim();
  const input = await f.decision();
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(500);
  spy.mockRestore();
  const s = await PublicationSubmission.findById(f.id);
  expect(s.status).toBe('pending-review');
  expect(String(s.claimOwnerAccountId)).toBe(String(f.mod.account._id));
  expect((await ContentRevision.findById(input.revisionId)).status).toBe('submitted');
  expect(await Notification.countDocuments({ eventType: 'publication.decided' })).toBe(0);
  expect(await ModerationHistory.countDocuments({ action: 'manual-review.decided' })).toBe(0);
});
it('blocks expired claims and rejects false manual acknowledgement, Author access and missing origin', async () => {
  const f = await fixture();
  await f.admit();
  await f.claim();
  const input = await f.decision();
  expect(
    (await write(`${f.path}/decision`, f.mod.cookie, { ...input, confirmedManualReview: false }))
      .status,
  ).toBe(400);
  expect(
    (await write(`${f.path}/decision`, f.mod.cookie, { ...input, reason: 'short' })).status,
  ).toBe(400);
  expect((await write(`${f.path}/decision`, f.author.cookie, input)).status).toBe(403);
  expect(
    (await request(app).post(`${f.path}/decision`).set('Cookie', f.mod.cookie).send(input)).status,
  ).toBe(403);
  await PublicationSubmission.updateOne(
    { _id: f.id },
    { $set: { claimExpiresAt: new Date(Date.now() - 1000) } },
  );
  expect((await write(`${f.path}/decision`, f.mod.cookie, input)).status).toBe(409);
});
