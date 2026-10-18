import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Account, AuditEvent, AuthorApplication } from '../src/models/index.js';
import { adminDashboard } from '../src/modules/admin-dashboard.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('reports actual current account/application counts and immutable audit fields without telemetry samples', async () => {
  const author = await authenticatedAccount('author'),
    reader = await authenticatedAccount('reader'),
    suspended = await authenticatedAccount('author');
  await Account.updateOne({ _id: suspended.account._id }, { $set: { status: 'suspended' } });
  await AuthorApplication.create({ applicantAccountId: reader.account._id });
  await AuditEvent.create({
    actorType: 'system',
    action: 'test.accepted',
    result: 'accepted',
    targetType: 'Account',
    targetId: author.account._id,
    occurredAt: new Date('2026-10-01'),
    reason: 'PRIVATE_REASON',
  });
  const report = await adminDashboard(new Date('2026-10-02'));
  expect(Object.fromEntries(report.kpis)).toEqual({
    activeAccounts: 2,
    activeAuthors: 1,
    publishedStories: 0,
    pendingApplications: 1,
    reviewQueue: 0,
    pendingPayouts: 0,
  });
  expect(report.actions).toEqual([
    ['2026-10-01T00:00:00.000Z', 'system', 'test.accepted', 'accepted'],
  ]);
  expect(JSON.stringify(report)).not.toContain('PRIVATE_REASON');
  expect(JSON.stringify(report)).not.toContain(reader.account.email);
  expect(report).not.toHaveProperty('uptime');
});
it('requires Admin authorization and serves private responses', async () => {
  const admin = await authenticatedAccount('admin'),
    reader = await authenticatedAccount('reader');
  expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
  expect((await request(app).get('/api/admin/dashboard').set('Cookie', reader.cookie)).status).toBe(
    403,
  );
  const result = await request(app).get('/api/admin/dashboard').set('Cookie', admin.cookie);
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toContain('no-store');
});
