import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuthorRevenueRate,
  PolicyVersion,
  RevenueAllocation,
  AuditEvent,
  RoleAssignment,
  Wallet,
} from '../src/models/index.js';
import { authorAgreement, saveAuthorAgreement } from '../src/modules/author-agreement.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('restricts access and never substitutes another author for a missing account', async () => {
  const admin = await authenticatedAccount('admin');
  const reader = await authenticatedAccount('reader');
  const url = `/api/admin/authors/${reader.account._id}/agreement`;
  expect((await request(app).get(url)).status).toBe(401);
  expect((await request(app).get(url).set('Cookie', reader.cookie)).status).toBe(403);
  expect((await request(app).get(url).set('Cookie', admin.cookie)).status).toBe(404);
  expect(
    (await request(app).get('/api/admin/authors/invalid/agreement').set('Cookie', admin.cookie))
      .status,
  ).toBe(400);
});
it('uses the effective personal rate before policy and excludes future rates from current values', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const now = new Date('2026-10-17T12:00:00Z');
  const base = { actorAccountId: admin.account._id };
  await PolicyVersion.create({
    ...base,
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    authorSharePercent: 65,
    platformSharePercent: 35,
  });
  await PolicyVersion.create({
    ...base,
    status: 'effective',
    effectiveAt: new Date('2027-01-01'),
    authorSharePercent: 99,
    platformSharePercent: 1,
  });
  expect(await authorAgreement(author.account.id, now)).toMatchObject({
    authorShare: 65,
    platformShare: 35,
    source: 'policy',
    history: [],
  });
  await AuthorRevenueRate.create([
    {
      ...base,
      authorAccountId: author.account._id,
      percentage: 75,
      effectiveAt: new Date('2026-02-01'),
    },
    {
      ...base,
      authorAccountId: author.account._id,
      percentage: 90,
      effectiveAt: new Date('2027-02-01'),
    },
    {
      ...base,
      authorAccountId: other.account._id,
      percentage: 10,
      effectiveAt: new Date('2026-03-01'),
    },
  ]);
  const result = await authorAgreement(author.account.id, now);
  expect(result).toMatchObject({
    author: { id: author.account.id },
    authorShare: 75,
    platformShare: 25,
    source: 'agreement',
  });
  expect(result.history.map((item) => [item.percentage, item.scheduled])).toEqual([
    [90, true],
    [75, false],
  ]);
  expect(result).not.toHaveProperty('email');
  const response = await request(app)
    .get(`/api/admin/authors/${author.account.id}/agreement`)
    .set('Cookie', admin.cookie);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
});
it('returns 70/30 without policy and supports former authors while hiding anonymized accounts', async () => {
  const author = await authenticatedAccount('author');
  expect(await authorAgreement(author.account.id)).toMatchObject({
    authorShare: 70,
    platformShare: 30,
    source: 'default',
  });
  await Account.updateOne({ _id: author.account._id }, { $set: { status: 'anonymized' } });
  await expect(authorAgreement(author.account.id)).rejects.toMatchObject({ status: 404 });
});

async function writeFixture() {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const url = `/api/admin/authors/${author.account.id}/agreement`;
  const view = (await request(app).get(url).set('Cookie', admin.cookie)).body;
  const input = {
    percentage: 77,
    reason: 'Điều chỉnh theo thỏa thuận mới',
    expectedAccountVersion: view.accountVersion,
    expectedLatestRateId: view.latestRateId,
  };
  return { admin, author, url, input };
}
const post = (f, input = f.input, cookie = f.admin.cookie) =>
  request(app).post(f.url).set('Cookie', cookie).set('Origin', 'http://localhost:5173').send(input);
it('appends the exact author rate and required audit atomically, keeping old rates and balances', async () => {
  const f = await writeFixture();
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: f.author.account._id,
    purpose: 'author-earnings',
    availableBalance: 4321,
  });
  const old = await AuthorRevenueRate.create({
    authorAccountId: f.author.account._id,
    percentage: 71,
    effectiveAt: new Date('2025-01-01'),
    actorAccountId: f.admin.account._id,
  });
  f.input.expectedLatestRateId = old.id;
  const response = await post(f);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ authorId: f.author.account.id, rate: { percentage: 77 } });
  expect(await AuthorRevenueRate.countDocuments({ authorAccountId: f.author.account._id })).toBe(2);
  expect((await AuthorRevenueRate.findById(old._id)).percentage).toBe(71);
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(4321);
  const audit = await AuditEvent.findOne({ action: 'author-agreement.created' }).lean();
  expect(audit).toMatchObject({ reason: f.input.reason, result: 'accepted' });
  expect(String(audit.targetId)).toBe(f.author.account.id);
  expect(String(audit.actorId)).toBe(f.admin.account.id);
  expect(audit.dataDigest).toBeTruthy();
  const fresh = (await request(app).get(f.url).set('Cookie', f.admin.cookie)).body;
  expect(fresh).toMatchObject({ authorShare: 77, latestRateId: response.body.rate.id });
});
it('requires Admin and validates integer bounds, reason, versions and strict request fields', async () => {
  const f = await writeFixture();
  const reader = await authenticatedAccount('reader');
  expect((await request(app).post(f.url).send(f.input)).status).toBe(401);
  expect((await post(f, f.input, reader.cookie)).status).toBe(403);
  for (const bad of [
    { percentage: -1 },
    { percentage: 101 },
    { percentage: 70.5 },
    { percentage: '77' },
    { reason: '  ' },
    { reason: 'x'.repeat(1001) },
    { expectedAccountVersion: -1 },
    { expectedLatestRateId: 'bad' },
    { effectiveAt: '2000-01-01' },
  ]) {
    expect((await post(f, { ...f.input, ...bad })).status).toBe(400);
  }
  expect(await AuthorRevenueRate.countDocuments()).toBe(0);
});
it('rejects stale versions and duplicate or concurrent commands without duplicate records', async () => {
  const f = await writeFixture();
  const responses = await Promise.all([post(f), post(f)]);
  expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
  expect((await post(f)).status).toBe(409);
  expect(await AuthorRevenueRate.countDocuments()).toBe(1);
  expect(await AuditEvent.countDocuments({ action: 'author-agreement.created' })).toBe(1);
});
it('rejects a changed latest record even when the account version is unchanged', async () => {
  const f = await writeFixture();
  await AuthorRevenueRate.create({
    authorAccountId: f.author.account._id,
    percentage: 80,
    effectiveAt: new Date('2027-01-01'),
    actorAccountId: f.admin.account._id,
  });
  expect((await post(f)).status).toBe(409);
  expect(await AuthorRevenueRate.countDocuments()).toBe(1);
  expect((await Account.findById(f.author.account._id)).version).toBe(
    f.input.expectedAccountVersion,
  );
});
it('rolls back the rate and both account locks when required audit recording fails', async () => {
  const f = await writeFixture();
  const beforeAdmin = await Account.findById(f.admin.account._id).lean();
  const fail = vi
    .spyOn(AuditEvent, 'create')
    .mockRejectedValueOnce(new Error('Injected audit failure'));
  try {
    expect((await post(f)).status).toBe(500);
  } finally {
    fail.mockRestore();
  }
  expect(await AuthorRevenueRate.countDocuments()).toBe(0);
  expect((await Account.findById(f.author.account._id)).version).toBe(
    f.input.expectedAccountVersion,
  );
  expect((await Account.findById(f.admin.account._id)).version).toBe(beforeAdmin.version);
});
it('rejects former Authors and stale Admin authorization inside the transaction', async () => {
  const f = await writeFixture();
  await RoleAssignment.updateOne(
    { accountId: f.author.account._id, role: 'author' },
    { $set: { status: 'revoked' } },
  );
  expect((await post(f)).status).toBe(409);
  expect((await authorAgreement(f.author.account.id)).canEdit).toBe(false);
  await expect(
    saveAuthorAgreement(
      { ...f.admin.account.toObject(), authorizationEpoch: -1 },
      f.author.account.id,
      f.input,
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(await AuthorRevenueRate.countDocuments()).toBe(0);
});
it('keeps an Admin with past Author history read-only under the exclusive staff-role rule', async () => {
  const admin = await authenticatedAccount('admin', { everAuthor: true });
  const view = await authorAgreement(admin.account.id);
  expect(view.canEdit).toBe(false);
  await expect(
    saveAuthorAgreement(admin.account, admin.account.id, {
      percentage: 0,
      reason: 'Thỏa thuận mới',
      expectedAccountVersion: view.accountVersion,
      expectedLatestRateId: view.latestRateId,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await AuthorRevenueRate.countDocuments()).toBe(0);
  expect((await Account.findById(admin.account._id)).version).toBe(view.accountVersion);
});
it('accepts 0 and 100 percent while preserving a future agreement and immutable allocations', async () => {
  const f = await writeFixture();
  const future = await AuthorRevenueRate.create({
    authorAccountId: f.author.account._id,
    percentage: 85,
    effectiveAt: new Date('2030-01-01'),
    actorAccountId: f.admin.account._id,
  });
  const allocation = await RevenueAllocation.create({
    unlockRequestId: new Account.base.Types.ObjectId(),
    ledgerEntryIds: [new Account.base.Types.ObjectId()],
    beneficiaries: [f.author.account._id],
    amount: 99,
    negotiatedAllocationSnapshot: { authorShare: 70, platformShare: 30 },
  });
  const original = JSON.stringify(await RevenueAllocation.findById(allocation._id).lean());
  const zero = await post(f, { ...f.input, percentage: 0, expectedLatestRateId: future.id });
  expect(zero.status).toBe(201);
  let fresh = await authorAgreement(f.author.account.id);
  expect(fresh).toMatchObject({ authorShare: 0, platformShare: 100 });
  const full = await post(f, {
    ...f.input,
    percentage: 100,
    expectedAccountVersion: fresh.accountVersion,
    expectedLatestRateId: fresh.latestRateId,
  });
  expect(full.status).toBe(201);
  fresh = await authorAgreement(f.author.account.id);
  expect(fresh).toMatchObject({ authorShare: 100, platformShare: 0 });
  expect(fresh.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: future.id, percentage: 85, scheduled: true }),
    ]),
  );
  expect(JSON.stringify(await RevenueAllocation.findById(allocation._id).lean())).toBe(original);
});
