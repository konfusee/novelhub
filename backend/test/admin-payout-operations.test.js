import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { NotificationOutbox, PolicyVersion, Wallet } from '../src/models/index.js';
import { payoutOperations } from '../src/modules/admin-payout-operations.js';
import { evaluateMonthlyAuthorPayout } from '../src/modules/monthly-author-payouts.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const now = new Date('2026-10-02T00:00:00Z');
it('reports committed evaluations, current unprocessed candidates and financial email queues without running a job', async () => {
  const low = await authenticatedAccount('author', { createdAt: new Date('2026-08-01') });
  const bank = await authenticatedAccount('author', { createdAt: new Date('2026-08-01') });
  await authenticatedAccount('author', { createdAt: new Date('2026-08-01') });
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    actorAccountId: low.account._id,
  });
  for (const [author, balance] of [
    [low, 10],
    [bank, 120000],
  ])
    await Wallet.create({
      ownerType: 'account',
      ownerId: author.account._id,
      purpose: 'author-earnings',
      availableBalance: balance,
    });
  await evaluateMonthlyAuthorPayout(low.account._id, now);
  await evaluateMonthlyAuthorPayout(bank.account._id, now);
  await NotificationOutbox.create([
    {
      sourceEventKey: 'withdrawal-result:expired',
      channel: 'email',
      status: 'claimed',
      leaseExpiresAt: new Date(now.getTime() - 1000),
    },
    { sourceEventKey: 'withdrawal-result:failed', channel: 'email', status: 'failed' },
    { sourceEventKey: 'unrelated:failed', channel: 'email', status: 'failed' },
  ]);
  const report = await payoutOperations({ period: '2026-10', page: 1 }, now);
  expect(report.summary).toMatchObject({
    evaluations: 2,
    bankRequired: 1,
    belowThreshold: 1,
    remainingCandidates: 1,
    pendingWithdrawals: 0,
    pendingEmails: 2,
    failedEmails: 1,
    expiredEmailLeases: 1,
  });
  expect(report.items).toHaveLength(2);
  expect(JSON.stringify(report)).not.toContain(bank.account.email);
  expect((await Wallet.findOne({ ownerId: bank.account._id })).availableBalance).toBe(120000);
  const old = await payoutOperations({ period: '2026-09', page: 1 }, now);
  expect(old.summary.remainingCandidates).toBeNull();
  expect(old.items).toEqual([]);
});
it('restricts the operational report to Admin and validates month/page inputs', async () => {
  const admin = await authenticatedAccount('admin'),
    reader = await authenticatedAccount('reader');
  const path = '/api/admin/payout-operations';
  expect((await request(app).get(path)).status).toBe(401);
  expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403);
  for (const query of ['period=all', 'period=2026-13', 'page=0', 'run=true'])
    expect((await request(app).get(`${path}?${query}`).set('Cookie', admin.cookie)).status).toBe(
      400,
    );
  const response = await request(app).get(path).set('Cookie', admin.cookie);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toContain('no-store');
  expect(response.body.items).toEqual([]);
});
