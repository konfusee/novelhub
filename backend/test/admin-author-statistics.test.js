import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuthorApplication,
  LedgerEntry,
  UnlockRequest,
  Wallet,
} from '../src/models/index.js';
import { adminAuthorStatistics } from '../src/modules/admin-author-statistics.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('counts real application decisions, current eligible Authors and committed paid unlocks at Vietnam boundaries', async () => {
  const author = await authenticatedAccount('author'),
    suspended = await authenticatedAccount('author'),
    buyer = await authenticatedAccount('reader');
  await Account.updateOne({ _id: suspended.account._id }, { $set: { status: 'suspended' } });
  await AuthorApplication.create([
    {
      applicantAccountId: author.account._id,
      status: 'approved',
      submittedAt: new Date('2026-09-01'),
      decidedAt: new Date('2026-09-30T17:00:00Z'),
      decidedBy: author.account._id,
    },
    {
      applicantAccountId: buyer.account._id,
      status: 'submitted',
      submittedAt: new Date('2026-10-01'),
    },
    {
      applicantAccountId: suspended.account._id,
      status: 'rejected',
      submittedAt: new Date('2026-10-02'),
      decidedAt: new Date('2026-10-03'),
      decidedBy: author.account._id,
    },
  ]);
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: buyer.account._id,
    purpose: 'reader-coins',
    availableBalance: 999,
  });
  for (const [index, status, amount, date] of [
    [0, 'committed', 200, '2026-09-30T17:00:00Z'],
    [1, 'committed', 300, '2026-10-05'],
    [2, 'rejected', 400, '2026-10-06'],
    [3, 'committed', 500, '2026-10-31T17:00:00Z'],
  ]) {
    const scope = { operation: 'stats-test', ownerId: buyer.account._id, key: String(index) };
    const unlock = await UnlockRequest.create({
      accountId: buyer.account._id,
      chapterId: author.account._id,
      status,
      requestedPriceCoins: amount,
      effectivePriceCoins: amount,
      idempotencyScope: scope,
    });
    await LedgerEntry.create({
      walletId: wallet._id,
      ledgerType: 'unlock-debit',
      direction: 'debit',
      amount,
      sourceType: 'UnlockRequest',
      sourceId: unlock._id,
      occurredAt: new Date(date),
      idempotencyScope: scope,
    });
  }
  const result = await adminAuthorStatistics('2026-10', new Date('2026-11-02'));
  expect(result.summary).toEqual({
    applications: 2,
    approvedApplications: 1,
    rejectedApplications: 1,
    pendingApplications: 1,
    activeAuthors: 1,
    unlocks: 2,
    unlockCoins: 500,
    buyers: 1,
  });
  expect(JSON.stringify(result)).not.toContain(buyer.account.email);
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(999);
});
it('enforces Admin access, strict periods and private responses without fabricating missing counts', async () => {
  const admin = await authenticatedAccount('admin');
  const path = '/api/admin/author-statistics';
  expect((await request(app).get(path)).status).toBe(401);
  const reader = await authenticatedAccount('reader');
  expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403);
  for (const query of ['period=2026-13', 'accountId=forged'])
    expect((await request(app).get(`${path}?${query}`).set('Cookie', admin.cookie)).status).toBe(
      400,
    );
  const response = await request(app).get(path).set('Cookie', admin.cookie);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toContain('no-store');
  expect(Object.values(response.body.summary)).toEqual(Array(8).fill(0));
});
