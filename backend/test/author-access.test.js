import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { Account } from '../src/models/identity/account.model.js';
import { AuthorApplication } from '../src/models/identity/author-application.model.js';
import { RoleAssignment } from '../src/models/identity/role-assignment.model.js';
import { AuditEvent } from '../src/models/audit/audit-event.model.js';
import { Notification } from '../src/models/notifications/notification.model.js';
import { decideApplication } from '../src/modules/author-access/service.js';

useTestDatabase();
const app = createApp(
  testConfig({ cookieName: 'novelhub_session', corsOrigin: 'http://localhost:5173' }),
);
const base = '/api/admin/author-applications';
let reader, admin;
beforeEach(async () => {
  reader = await authenticatedAccount();
  admin = await authenticatedAccount('admin');
});
afterEach(() => vi.restoreAllMocks());
const submit = (user = reader) =>
  request(app)
    .post('/api/auth/author-application')
    .set('Cookie', user.cookie)
    .set('Origin', 'http://localhost:5173')
    .send({});
const decide = (application, body = {}, user = admin) =>
  request(app)
    .post(`${base}/${application.id}/decision`)
    .set('Cookie', user.cookie)
    .set('Origin', 'http://localhost:5173')
    .send({
      decision: 'approve',
      reason: 'Meets author requirements',
      expectedVersion: application.version,
      ...body,
    });
const pending = async () => (await submit()).body.application;

describe('author application decisions', () => {
  it('requires Admin and validates pagination and IDs', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    for (const user of [
      reader,
      await authenticatedAccount('author'),
      await authenticatedAccount('moderator'),
    ]) {
      expect((await request(app).get(base).set('Cookie', user.cookie)).status).toBe(403);
    }
    for (const suffix of ['?page=0', '?pageSize=51', '?status=unknown', '/invalid']) {
      expect(
        (
          await request(app)
            .get(base + suffix)
            .set('Cookie', admin.cookie)
        ).status,
      ).toBe(400);
    }
    expect(
      (await request(app).get(`${base}/507f1f77bcf86cd799439011`).set('Cookie', admin.cookie))
        .status,
    ).toBe(404);
  });

  it('lists only matching applications, paginates and exposes no account secrets', async () => {
    const application = await pending();
    await submit(await authenticatedAccount());
    const res = await request(app).get(`${base}?pageSize=1`).set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(res.body.items).toHaveLength(1);
    const detail = await request(app).get(`${base}/${application.id}`).set('Cookie', admin.cookie);
    expect(detail.body.application.applicant).toEqual({
      id: reader.account.id,
      name: reader.account.displayName,
      email: reader.account.email,
      status: 'active',
    });
    expect(JSON.stringify(detail.body)).not.toMatch(
      /password|bankDetails|credentialVersion|authorizationEpoch/,
    );
  });

  it('serializes duplicate submissions without granting any role', async () => {
    const results = await Promise.all([submit(), submit(), submit()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(await AuthorApplication.countDocuments()).toBe(1);
    expect(await RoleAssignment.countDocuments({ accountId: reader.account._id })).toBe(0);
  });

  it('atomically grants Author, preserves Reader, invalidates old sessions and writes audit/notice', async () => {
    const application = await pending();
    const res = await decide(application);
    expect(res.status).toBe(200);
    expect(res.body.application).toMatchObject({
      status: 'approved',
      version: 1,
      decisionReason: 'Meets author requirements',
    });
    const account = await Account.findById(reader.account._id);
    expect(account.everAuthor).toBe(true);
    expect(account.authorizationEpoch).toBe(1);
    expect((await request(app).get('/api/auth/me').set('Cookie', reader.cookie)).status).toBe(401);
    const { issueSession } = await import('../src/auth/session.js');
    const session = await issueSession(account, 1);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `novelhub_session=${session.token}`);
    expect(me.body.user.roles).toEqual(['reader', 'author']);
    expect(await AuditEvent.countDocuments({ targetId: application.id, result: 'approved' })).toBe(
      1,
    );
    expect(await Notification.countDocuments({ recipientAccountId: account._id })).toBe(1);
  });

  it('permits one decision when two Admins decide concurrently', async () => {
    const application = await pending();
    const secondAdmin = await authenticatedAccount('admin');
    const responses = await Promise.all([
      decide(application),
      decide(application, { decision: 'reject' }, secondAdmin),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await AuditEvent.countDocuments()).toBe(1);
    expect(await Notification.countDocuments()).toBe(1);
    const saved = await AuthorApplication.findById(application.id);
    expect(await RoleAssignment.countDocuments({ accountId: reader.account._id })).toBe(
      saved.status === 'approved' ? 1 : 0,
    );
  });

  it('rejects stale decisions, blank reasons, role injection and missing Origin', async () => {
    const application = await pending();
    expect((await decide(application, { expectedVersion: 4 })).status).toBe(409);
    expect((await decide(application, { reason: ' ' })).status).toBe(400);
    expect((await decide(application, { role: 'admin' })).status).toBe(400);
    expect(
      (
        await request(app)
          .post(`${base}/${application.id}/decision`)
          .set('Cookie', admin.cookie)
          .send({})
      ).status,
    ).toBe(403);
    expect(await AuditEvent.countDocuments()).toBe(0);
  });

  it('returns the rejection reason to the applicant and allows a new application', async () => {
    const application = await pending();
    expect(
      (await decide(application, { decision: 'reject', reason: 'Please complete your profile' }))
        .status,
    ).toBe(200);
    const own = await request(app).get('/api/auth/author-application').set('Cookie', reader.cookie);
    expect(own.body.application).toMatchObject({
      status: 'rejected',
      decisionReason: 'Please complete your profile',
    });
    const reapplied = await submit();
    expect(reapplied.status).toBe(201);
    expect(reapplied.body.application.id).not.toBe(application.id);
    expect(await AuthorApplication.countDocuments()).toBe(2);
    const all = await request(app).get(`${base}?status=all`).set('Cookie', admin.cookie);
    expect(all.body.total).toBe(2);
  });

  it('does not let one Reader see another Reader application', async () => {
    await pending();
    const other = await authenticatedAccount();
    expect(
      (await request(app).get('/api/auth/author-application').set('Cookie', other.cookie)).body
        .application,
    ).toBeNull();
    expect((await request(app).get(base).set('Cookie', other.cookie)).status).toBe(403);
  });

  it('rejects approval if the applicant has gained a staff role or been suspended', async () => {
    const application = await pending();
    await RoleAssignment.create({
      accountId: reader.account._id,
      role: 'moderator',
      grantedBy: admin.account._id,
    });
    expect((await decide(application)).status).toBe(409);
    expect((await AuthorApplication.findById(application.id)).status).toBe('submitted');
    await Account.updateOne({ _id: reader.account._id }, { $set: { status: 'suspended' } });
    expect((await decide(application)).status).toBe(409);
    expect(await AuditEvent.countDocuments()).toBe(0);
  });

  it('blocks staff accounts from submitting another application', async () => {
    expect((await submit(await authenticatedAccount('author'))).status).toBe(409);
    expect((await submit(admin)).status).toBe(409);
  });

  it('rechecks stale Admin authority inside the transaction', async () => {
    const application = await pending();
    await Account.updateOne({ _id: admin.account._id }, { $inc: { authorizationEpoch: 1 } });
    await expect(
      decideApplication(admin.account, application.id, {
        decision: 'approve',
        reason: 'Approved',
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await RoleAssignment.countDocuments({ accountId: reader.account._id })).toBe(0);
  });

  it('rolls back the grant and application if a transactional notification write fails', async () => {
    const application = await pending();
    vi.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('notification insert failed'));
    expect((await decide(application)).status).toBe(500);
    expect((await AuthorApplication.findById(application.id)).status).toBe('submitted');
    expect((await Account.findById(reader.account._id)).everAuthor).toBe(false);
    expect(await RoleAssignment.countDocuments({ accountId: reader.account._id })).toBe(0);
    expect(await AuditEvent.countDocuments()).toBe(0);
  });
});
