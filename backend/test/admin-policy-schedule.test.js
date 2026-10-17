import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { Account, AuditEvent, AuthorRevenueRate, PolicyVersion } from '../src/models/index.js';
import {
  activatePolicy,
  adminPolicy,
  adminPolicyHistory,
  cancelFuturePolicy,
} from '../src/modules/admin-policy.js';
import { currentAuthorAgreement } from '../src/modules/author-agreement.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
async function fixture() {
  const admin = await authenticatedAccount('admin');
  const current = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
    authorSharePercent: 70,
    platformSharePercent: 30,
    orderExpiryHours: 12,
    claimExpiryHours: 48,
  });
  const input = {
    expectedPolicyId: current.id,
    expectedPolicyVersion: current.version,
    priceMinCoins: 400,
    priceMaxCoins: 900,
    durationMinDays: 2,
    durationMaxDays: 8,
    authorSharePercent: 82,
    withdrawalThresholdCoins: 150000,
    effectiveAt: '2099-01-01T00:00:00.000Z',
    reason: 'Hẹn chính sách mới',
  };
  return { admin, current, input };
}
const post = (f, input = f.input) =>
  request(app)
    .post('/api/admin/policy')
    .set('Cookie', f.admin.cookie)
    .set('Origin', 'http://localhost:5173')
    .send(input);
it('keeps the current policy effective before the exact boundary and selects the scheduled policy at/after it', async () => {
  const f = await fixture();
  const author = await authenticatedAccount('author');
  const negotiated = await authenticatedAccount('author');
  await AuthorRevenueRate.create({
    actorAccountId: f.admin.account._id,
    authorAccountId: negotiated.account._id,
    percentage: 85,
    effectiveAt: new Date('2025-01-01'),
  });
  const result = await post(f);
  expect(result.status).toBe(201);
  expect(result.body.effectiveAt).toBe(f.input.effectiveAt);
  expect(result.headers['cache-control']).toBe('private, no-store');
  const original = await PolicyVersion.findById(f.current.id).lean();
  expect(original).toMatchObject({
    status: 'effective',
    version: f.current.version + 1,
    priceMinCoins: 200,
    authorSharePercent: 70,
  });
  const scheduled = await PolicyVersion.findById(result.body.policyId).lean();
  expect(scheduled).toMatchObject({
    status: 'effective',
    priceMinCoins: 400,
    authorSharePercent: 82,
    platformSharePercent: 18,
    orderExpiryHours: 12,
    claimExpiryHours: 48,
  });
  const before = new Date('2098-12-31T23:59:59.999Z'),
    at = new Date(f.input.effectiveAt),
    after = new Date('2099-01-01T00:00:00.001Z');
  expect((await adminPolicy(before)).policy.id).toBe(f.current.id);
  expect((await adminPolicy(at)).policy.id).toBe(result.body.policyId);
  expect((await adminPolicy(after)).policy.id).toBe(result.body.policyId);
  expect(await currentAuthorAgreement(author.account.id, before)).toMatchObject({
    authorShare: 70,
  });
  expect(await currentAuthorAgreement(author.account.id, at)).toMatchObject({ authorShare: 82 });
  expect(await currentAuthorAgreement(negotiated.account.id, at)).toMatchObject({
    authorShare: 85,
    source: 'agreement',
  });
  const history = await adminPolicyHistory({ page: 1, pageSize: 5 }, before);
  expect(history.items.find((item) => item.id === result.body.policyId)).toMatchObject({
    current: false,
    future: true,
    reason: 'Hẹn chính sách mới',
  });
  expect(await AuditEvent.findOne({ targetId: result.body.policyId }).lean()).toMatchObject({
    action: 'policy.scheduled',
    reason: f.input.reason,
  });
});
it('permits only one pending schedule and supports cancelling it without superseding the current policy', async () => {
  const f = await fixture();
  const result = await post(f);
  expect(result.status).toBe(201);
  expect((await post(f)).status).toBe(409);
  const current = await PolicyVersion.findById(f.current.id);
  const pending = await PolicyVersion.findById(result.body.policyId);
  await cancelFuturePolicy(f.admin.account, pending.id, {
    expectedVersion: pending.version,
    reason: 'Hủy lịch',
  });
  expect((await adminPolicy()).policy.id).toBe(current.id);
  expect((await post(f, { ...f.input, expectedPolicyVersion: current.version })).status).toBe(201);
});
it('serializes scheduling by different Admins against the same current policy', async () => {
  const f = await fixture();
  const other = await authenticatedAccount('admin');
  const results = await Promise.all([post(f), post({ ...f, admin: other })]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await PolicyVersion.countDocuments()).toBe(2);
  expect(await AuditEvent.countDocuments({ action: 'policy.scheduled' })).toBe(1);
});
it('rolls back the schedule, current pin and actor if the scheduling audit fails', async () => {
  const f = await fixture();
  const original = JSON.stringify(await PolicyVersion.findById(f.current.id).lean());
  const actorVersion = (await Account.findById(f.admin.account.id)).version;
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try {
    await expect(activatePolicy(f.admin.account, f.input)).rejects.toThrow('audit unavailable');
  } finally {
    spy.mockRestore();
  }
  expect(await PolicyVersion.countDocuments()).toBe(1);
  expect(JSON.stringify(await PolicyVersion.findById(f.current.id).lean())).toBe(original);
  expect((await Account.findById(f.admin.account.id)).version).toBe(actorVersion);
});
it('rejects stale snapshots, invalid/backdated/local dates, and scheduling before initial policy creation', async () => {
  const f = await fixture();
  for (const effectiveAt of [
    '2020-01-01T00:00:00Z',
    'invalid',
    '2099-01-01T00:00',
    '2099-02-30T00:00:00Z',
  ])
    expect((await post(f, { ...f.input, effectiveAt })).status).toBe(400);
  expect((await post(f, { ...f.input, expectedPolicyVersion: f.current.version + 1 })).status).toBe(
    409,
  );
  const admin = await authenticatedAccount('admin');
  await PolicyVersion.updateOne({ _id: f.current.id }, { $set: { status: 'superseded' } });
  expect(
    (
      await post({
        admin,
        input: { ...f.input, expectedPolicyId: null, expectedPolicyVersion: null },
      })
    ).status,
  ).toBe(409);
  expect(await PolicyVersion.countDocuments()).toBe(1);
});
it('normalizes explicit offsets and accepts scheduling unchanged terms with a new effective date', async () => {
  const f = await fixture();
  const result = await post(f, {
    ...f.input,
    priceMinCoins: 200,
    priceMaxCoins: 5000,
    durationMinDays: 1,
    durationMaxDays: 14,
    authorSharePercent: 70,
    withdrawalThresholdCoins: 100000,
    effectiveAt: '2099-01-01T07:00:00+07:00',
  });
  expect(result.status).toBe(201);
  expect(result.body.effectiveAt).toBe('2099-01-01T00:00:00.000Z');
});
it('serializes immediate activation against scheduling by a different Admin', async () => {
  const f = await fixture();
  const other = await authenticatedAccount('admin');
  const immediate = { ...f.input };
  delete immediate.effectiveAt;
  const results = await Promise.all([post(f), post({ ...f, admin: other }, immediate)]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await PolicyVersion.countDocuments()).toBe(2);
  expect(await AuditEvent.countDocuments()).toBe(1);
  expect(
    await PolicyVersion.countDocuments({ status: 'effective', effectiveAt: { $gt: new Date() } }),
  ).toBeLessThanOrEqual(1);
  expect((await adminPolicy()).policy).not.toBeNull();
});
