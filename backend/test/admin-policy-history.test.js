import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Account, PolicyVersion, AuditEvent } from '../src/models/index.js';
import { adminPolicyHistory } from '../src/modules/admin-policy.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('requires an Admin and validates bounded pagination without unknown filters', async () => {
  expect((await request(app).get('/api/admin/policy/history')).status).toBe(401);
  for (const role of ['reader', 'author', 'moderator']) {
    const user = await authenticatedAccount(role);
    expect(
      (await request(app).get('/api/admin/policy/history').set('Cookie', user.cookie)).status,
    ).toBe(403);
  }
  const admin = await authenticatedAccount('admin');
  for (const query of [
    'page=0',
    'page=abc',
    'page=100001',
    'pageSize=21',
    'pageSize=0',
    'actorAccountId=secret',
  ])
    expect(
      (
        await request(app)
          .get('/api/admin/policy/history?' + query)
          .set('Cookie', admin.cookie)
      ).status,
    ).toBe(400);
  const response = await request(app).get('/api/admin/policy/history').set('Cookie', admin.cookie);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.body).toEqual({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 });
});
it('paginates deterministically and distinguishes future/draft/superseded/current policies', async () => {
  const admin = await authenticatedAccount('admin');
  const base = { actorAccountId: admin.account._id };
  const future = await PolicyVersion.create({
    ...base,
    status: 'effective',
    effectiveAt: new Date('2099-01-01'),
  });
  const draft = await PolicyVersion.create({
    ...base,
    status: 'draft',
    effectiveAt: new Date('2098-01-01'),
  });
  const superseded = await PolicyVersion.create({
    ...base,
    status: 'superseded',
    effectiveAt: new Date('2026-02-01'),
  });
  const low = await PolicyVersion.create({
    ...base,
    _id: new Account.base.Types.ObjectId('111111111111111111111111'),
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
  });
  const high = await PolicyVersion.create({
    ...base,
    _id: new Account.base.Types.ObjectId('222222222222222222222222'),
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
  });
  const now = new Date('2026-03-01');
  const first = await adminPolicyHistory({ page: 1, pageSize: 2 }, now);
  const second = await adminPolicyHistory({ page: 2, pageSize: 2 }, now);
  const third = await adminPolicyHistory({ page: 3, pageSize: 2 }, now);
  expect(first).toMatchObject({ total: 5, totalPages: 3 });
  expect(first.items.map((item) => item.id)).toEqual([future.id, draft.id]);
  expect(first.items[0]).toMatchObject({ current: false, future: true });
  expect(first.items[1]).toMatchObject({ current: false, future: false, status: 'draft' });
  expect(second.items.map((item) => item.id)).toEqual([superseded.id, high.id]);
  expect(second.items[1].current).toBe(true);
  expect(third.items.map((item) => item.id)).toEqual([low.id]);
  expect(third.items[0].current).toBe(false);
  expect((await adminPolicyHistory({ page: 4, pageSize: 2 }, now)).items).toEqual([]);
});
it('joins only accepted activation reasons and returns no actor/account/audit internals or invented date', async () => {
  const admin = await authenticatedAccount('admin');
  const policy = await PolicyVersion.create({ actorAccountId: admin.account._id });
  const event = {
    actorType: 'account',
    actorId: admin.account._id,
    targetType: 'policy',
    targetId: policy._id,
    occurredAt: new Date('2026-01-01'),
    action: 'policy.activated',
    result: 'accepted',
  };
  await AuditEvent.create([
    { ...event, reason: 'Lý do thật' },
    {
      ...event,
      result: 'rejected',
      reason: 'Không được hiển thị',
      occurredAt: new Date('2026-02-01'),
    },
  ]);
  const result = await adminPolicyHistory({ page: 1, pageSize: 5 });
  expect(result.items[0]).toMatchObject({ reason: 'Lý do thật', effectiveAt: null });
  expect(result.items[0]).not.toHaveProperty('actorAccountId');
  expect(result.items[0]).not.toHaveProperty('actorId');
  expect(result.items[0]).not.toHaveProperty('dataDigest');
  expect(result.items[0]).not.toHaveProperty('createdAt');
});
it('does not mutate policy versions, statuses or audit records when browsing', async () => {
  const admin = await authenticatedAccount('admin');
  const policy = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
  });
  const before = JSON.stringify(await PolicyVersion.findById(policy.id).lean());
  expect((await adminPolicyHistory({ page: 1, pageSize: 5 })).items[0].reason).toBeNull();
  expect(JSON.stringify(await PolicyVersion.findById(policy.id).lean())).toBe(before);
  expect(await AuditEvent.countDocuments()).toBe(0);
});
