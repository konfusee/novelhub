import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  Category,
  ContentRevision,
  RoleAssignment,
  Session,
  Story,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
const change = (admin, id, body) =>
  request(app)
    .post(`/api/admin/accounts/${id}/status`)
    .set('Cookie', admin.cookie)
    .set('Origin', origin)
    .send(body);
it('suspends and restores an Author, hides public stories, invalidates sessions and preserves revisions and roles', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  });
  const created = await request(app)
    .post('/api/author/stories')
    .set('Cookie', author.cookie)
    .set('Origin', origin)
    .send({
      title: 'Truyện công khai',
      description: 'Mô tả.',
      categoryIds: [String(category._id)],
    });
  const story = await Story.findById(created.body.story.id);
  const revision = await ContentRevision.findById(story.currentRevisionId);
  revision.status = 'approved';
  revision.immutableAt = new Date();
  await revision.save();
  story.publicationStatus = 'published';
  story.publishedRevisionId = revision._id;
  await story.save();
  const before = await Story.findById(story._id).lean();
  expect((await request(app).get('/api/catalog/stories')).body.total).toBe(1);
  const baseline = await Account.findById(author.account._id);
  const suspended = await change(admin, author.account._id, {
    action: 'suspend',
    expectedVersion: baseline.version,
    reason: 'Tạm khóa có lý do',
  });
  expect(suspended.status).toBe(200);
  expect(suspended.body.account.status).toBe('suspended');
  expect(await Session.countDocuments({ accountId: author.account._id, status: 'active' })).toBe(0);
  expect(
    (await request(app).get('/api/author/dashboard').set('Cookie', author.cookie)).status,
  ).toBe(401);
  expect((await request(app).get('/api/catalog/stories')).body.total).toBe(0);
  expect((await request(app).get(`/api/catalog/stories/${story._id}`)).status).toBe(404);
  const restored = await change(admin, author.account._id, {
    action: 'restore',
    expectedVersion: suspended.body.account.version,
    reason: 'Mở lại sau kiểm tra',
  });
  expect(restored.status).toBe(200);
  expect(restored.body.account.status).toBe('active');
  expect(
    (await request(app).get('/api/author/dashboard').set('Cookie', author.cookie)).status,
  ).toBe(401);
  expect((await request(app).get('/api/catalog/stories')).body.total).toBe(1);
  expect(await Story.findById(story._id).lean()).toEqual(before);
  expect(
    await RoleAssignment.countDocuments({
      accountId: author.account._id,
      role: 'author',
      status: 'active',
    }),
  ).toBe(1);
  expect(
    await AuditEvent.countDocuments({
      targetId: author.account._id,
      operationType: 'author-account-status',
    }),
  ).toBe(2);
});
it('enforces permission, CSRF, status/version and protected-account guards', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const reader = await authenticatedAccount('reader');
  const body = { action: 'suspend', expectedVersion: 0, reason: 'Kiểm tra' };
  expect((await change(reader, author.account._id, body)).status).toBe(403);
  expect(
    (
      await request(app)
        .post(`/api/admin/accounts/${author.account._id}/status`)
        .set('Cookie', admin.cookie)
        .send(body)
    ).status,
  ).toBe(403);
  expect((await change(admin, author.account._id, { ...body, reason: ' ' })).status).toBe(400);
  expect((await change(admin, author.account._id, { ...body, expectedVersion: 99 })).status).toBe(
    409,
  );
  expect((await change(admin, author.account._id, { ...body, action: 'restore' })).status).toBe(
    409,
  );
  expect((await change(admin, reader.account._id, body)).status).toBe(409);
  expect((await change(admin, admin.account._id, body)).status).toBe(409);
  const results = await Promise.all([
    change(admin, author.account._id, body),
    change(admin, author.account._id, body),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
});
it('rolls back status and session revocation when audit fails', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit offline'));
  expect(
    (
      await change(admin, author.account._id, {
        action: 'suspend',
        expectedVersion: 0,
        reason: 'Kiểm tra rollback',
      })
    ).status,
  ).toBe(500);
  expect((await Account.findById(author.account._id)).status).toBe('active');
  expect(await Session.countDocuments({ accountId: author.account._id, status: 'active' })).toBe(1);
});
