import { AuthorRevenueRate, RevenueAllocation } from '../src/models/index.js';
import { currentAuthorAgreement } from '../src/modules/author-agreement.js';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { Account, AuditEvent, PolicyVersion, RoleAssignment } from '../src/models/index.js';
import { activatePolicy } from '../src/modules/admin-policy.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const input = {
  priceMinCoins: 300,
  priceMaxCoins: 900,
  durationMinDays: 2,
  durationMaxDays: 8,
  expectedPolicyId: null,
  expectedPolicyVersion: null,
  reason: 'Áp dụng giới hạn mới',
};
const post = (admin, body = input) =>
  request(app)
    .post('/api/admin/policy')
    .set('Cookie', admin.cookie)
    .set('Origin', 'http://localhost:5173')
    .send(body);
it('initializes a real policy with schema defaults and audit, then rejects replay', async () => {
  const admin = await authenticatedAccount('admin');
  const response = await post(admin);
  expect(response.status).toBe(201);
  expect(response.headers['cache-control']).toBe('private, no-store');
  const policy = await PolicyVersion.findById(response.body.policyId);
  expect(policy).toMatchObject({
    status: 'effective',
    priceMinCoins: 300,
    priceMaxCoins: 900,
    authorSharePercent: 70,
    platformSharePercent: 30,
    withdrawalThresholdCoins: 100000,
    orderExpiryHours: 24,
    claimExpiryHours: 24,
  });
  expect(policy.effectiveAt.getTime()).toBeLessThanOrEqual(Date.now());
  expect(await AuditEvent.findOne({ targetId: policy._id }).lean()).toMatchObject({
    action: 'policy.activated',
    reason: input.reason,
    result: 'accepted',
  });
  expect((await post(admin)).status).toBe(409);
  expect(await PolicyVersion.countDocuments()).toBe(1);
  expect(await AuditEvent.countDocuments()).toBe(1);
});
it('supersedes the exact version and inherits unrelated terms without modifying old bounds', async () => {
  const admin = await authenticatedAccount('admin');
  const previous = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
    authorSharePercent: 81,
    platformSharePercent: 19,
    withdrawalThresholdCoins: 222222,
    orderExpiryHours: 12,
    claimExpiryHours: 48,
  });
  const response = await post(admin, {
    ...input,
    expectedPolicyId: previous.id,
    expectedPolicyVersion: previous.version,
  });
  expect(response.status).toBe(201);
  expect(response.body.policyId).not.toBe(previous.id);
  expect(await PolicyVersion.findById(previous.id).lean()).toMatchObject({
    status: 'superseded',
    priceMinCoins: 200,
    priceMaxCoins: 5000,
    version: previous.version + 1,
  });
  expect(await PolicyVersion.findById(response.body.policyId).lean()).toMatchObject({
    status: 'effective',
    authorSharePercent: 81,
    platformSharePercent: 19,
    withdrawalThresholdCoins: 222222,
    orderExpiryHours: 12,
    claimExpiryHours: 48,
  });
  expect(
    (
      await post(admin, {
        ...input,
        expectedPolicyId: previous.id,
        expectedPolicyVersion: previous.version,
      })
    ).status,
  ).toBe(409);
});
it('serializes initialization by different Admins using the unique first policy identity', async () => {
  const a = await authenticatedAccount('admin');
  const b = await authenticatedAccount('admin');
  const results = await Promise.all([post(a), post(b)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await PolicyVersion.countDocuments({ status: 'effective' })).toBe(1);
  expect(await AuditEvent.countDocuments()).toBe(1);
});
it('serializes replacements by different Admins against the same previous policy', async () => {
  const a = await authenticatedAccount('admin');
  const b = await authenticatedAccount('admin');
  const old = await PolicyVersion.create({
    actorAccountId: a.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
  });
  const body = { ...input, expectedPolicyId: old.id, expectedPolicyVersion: old.version };
  const results = await Promise.all([post(a, body), post(b, body)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await PolicyVersion.countDocuments({ status: 'effective' })).toBe(1);
  expect(await PolicyVersion.countDocuments()).toBe(2);
  expect(await AuditEvent.countDocuments()).toBe(1);
});
it('rolls back policy and actor changes when audit persistence fails', async () => {
  const admin = await authenticatedAccount('admin');
  const before = (await Account.findById(admin.account.id)).version;
  const old = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
  });
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try {
    await expect(
      activatePolicy(admin.account, {
        ...input,
        expectedPolicyId: old.id,
        expectedPolicyVersion: old.version,
      }),
    ).rejects.toThrow('audit unavailable');
  } finally {
    spy.mockRestore();
  }
  expect(await PolicyVersion.countDocuments()).toBe(1);
  expect(await PolicyVersion.findById(old.id).lean()).toMatchObject({
    status: 'effective',
    version: old.version,
  });
  expect((await Account.findById(admin.account.id)).version).toBe(before);
});
it('refuses a future effective policy and stale version without changing data', async () => {
  const admin = await authenticatedAccount('admin');
  const future = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2099-01-01'),
  });
  expect((await post(admin)).status).toBe(409);
  expect(await PolicyVersion.countDocuments()).toBe(1);
  expect((await PolicyVersion.findById(future.id)).status).toBe('effective');
  expect(await AuditEvent.countDocuments()).toBe(0);
});
it('validates integer bounds, reason, tokens and unknown/backdated fields', async () => {
  const admin = await authenticatedAccount('admin');
  for (const patch of [
    { priceMinCoins: -1 },
    { priceMaxCoins: 1 },
    { durationMinDays: 0 },
    { durationMaxDays: 1 },
    { priceMinCoins: 1.2 },
    { reason: '  ' },
    { effectiveAt: '2020-01-01' },
    { platformSharePercent: 1 },
    { expectedPolicyVersion: 1 },
    { priceMaxCoins: Number.MAX_SAFE_INTEGER + 1 },
  ])
    expect((await post(admin, { ...input, ...patch })).status).toBe(400);
  expect(await PolicyVersion.countDocuments()).toBe(0);
});
it('requires an active current Admin, including inside the transaction', async () => {
  expect(
    (
      await request(app)
        .post('/api/admin/policy')
        .set('Origin', 'http://localhost:5173')
        .send(input)
    ).status,
  ).toBe(401);
  for (const role of ['reader', 'author', 'moderator']) {
    const actor = await authenticatedAccount(role);
    expect((await post(actor)).status).toBe(403);
  }
  const admin = await authenticatedAccount('admin');
  await RoleAssignment.updateOne({ accountId: admin.account.id }, { $set: { status: 'revoked' } });
  await expect(activatePolicy(admin.account, input)).rejects.toMatchObject({ status: 403 });
  expect(await PolicyVersion.countDocuments()).toBe(0);
});
it('rejects an Admin snapshot invalidated by an Author policy pin', async () => {
  const admin = await authenticatedAccount('admin');
  const policy = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
  });
  await PolicyVersion.updateOne(
    { _id: policy._id, version: policy.version },
    { $inc: { version: 1 } },
  );
  const response = await post(admin, {
    ...input,
    expectedPolicyId: policy.id,
    expectedPolicyVersion: policy.version,
  });
  expect(response.status).toBe(409);
  expect(await PolicyVersion.countDocuments()).toBe(1);
  expect(await AuditEvent.countDocuments()).toBe(0);
});
it('rolls back first initialization on audit failure and allows a subsequent retry', async () => {
  const admin = await authenticatedAccount('admin');
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try {
    await expect(activatePolicy(admin.account, input)).rejects.toThrow('audit unavailable');
  } finally {
    spy.mockRestore();
  }
  expect(await PolicyVersion.countDocuments()).toBe(0);
  expect((await post(admin)).status).toBe(201);
  expect(await PolicyVersion.countDocuments()).toBe(1);
});
it('changes default revenue/threshold while preserving individual agreements and historical allocations', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const negotiated = await authenticatedAccount('author');
  await AuthorRevenueRate.create({
    authorAccountId: negotiated.account._id,
    actorAccountId: admin.account._id,
    percentage: 85,
    effectiveAt: new Date('2025-01-01'),
  });
  const allocation = await RevenueAllocation.create({
    unlockRequestId: new Account.base.Types.ObjectId(),
    ledgerEntryIds: [new Account.base.Types.ObjectId()],
    beneficiaries: [author.account._id],
    amount: 99,
    negotiatedAllocationSnapshot: { authorShare: 70, platformShare: 30 },
  });
  const original = JSON.stringify(await RevenueAllocation.findById(allocation._id).lean());
  const first = await post(admin, { ...input, authorSharePercent: 0, withdrawalThresholdCoins: 0 });
  expect(first.status).toBe(201);
  expect(await currentAuthorAgreement(author.account.id)).toMatchObject({
    authorShare: 0,
    platformShare: 100,
    source: 'policy',
  });
  expect(await currentAuthorAgreement(negotiated.account.id)).toMatchObject({
    authorShare: 85,
    platformShare: 15,
    source: 'agreement',
  });
  const policy = await PolicyVersion.findById(first.body.policyId);
  const second = await post(admin, {
    ...input,
    expectedPolicyId: policy.id,
    expectedPolicyVersion: policy.version,
    authorSharePercent: 100,
    withdrawalThresholdCoins: 123456,
  });
  expect(second.status).toBe(201);
  expect(await currentAuthorAgreement(author.account.id)).toMatchObject({
    authorShare: 100,
    platformShare: 0,
    source: 'policy',
  });
  expect(await PolicyVersion.findById(policy.id).lean()).toMatchObject({
    status: 'superseded',
    authorSharePercent: 0,
    platformSharePercent: 100,
    withdrawalThresholdCoins: 0,
  });
  expect(await PolicyVersion.findById(second.body.policyId).lean()).toMatchObject({
    withdrawalThresholdCoins: 123456,
    orderExpiryHours: 24,
    claimExpiryHours: 24,
  });
  expect(JSON.stringify(await RevenueAllocation.findById(allocation._id).lean())).toBe(original);
});
it('rejects invalid finance policy values and forbids direct platform-share and expiry overrides', async () => {
  const admin = await authenticatedAccount('admin');
  for (const patch of [
    { authorSharePercent: -1 },
    { authorSharePercent: 101 },
    { authorSharePercent: 70.5 },
    { withdrawalThresholdCoins: -1 },
    { withdrawalThresholdCoins: 1.5 },
    { withdrawalThresholdCoins: Number.MAX_SAFE_INTEGER + 1 },
    { platformSharePercent: 30 },
    { orderExpiryHours: 12 },
    { claimExpiryHours: 12 },
  ]) {
    expect((await post(admin, { ...input, ...patch })).status).toBe(400);
  }
  expect(await PolicyVersion.countDocuments()).toBe(0);
});
