import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { LedgerEntry, Wallet, AuthorRevenueRate } from '../src/models/index.js';
import { authorEarnings } from '../src/modules/author-earnings.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('reads author allocation credits and wallet balances independently without inventing payouts', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const reader = await authenticatedAccount();
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 555,
  });
  const readerWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'reader-coins',
    availableBalance: 999,
  });
  const otherWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: other.account._id,
    purpose: 'author-earnings',
    availableBalance: 888,
  });
  const entry = (key, walletId, amount, date, extra = {}) => ({
    walletId,
    ledgerType: 'allocation-credit',
    direction: 'credit',
    amount,
    occurredAt: new Date(date),
    sourceType: 'RevenueAllocation',
    sourceId: walletId,
    idempotencyScope: { operation: 'allocation', ownerId: author.account._id, key },
    ...extra,
  });
  await LedgerEntry.create([
    entry('day', wallet._id, 100, '2026-10-15T18:00:00Z'),
    entry('yesterday', wallet._id, 50, '2026-10-15T00:00:00Z'),
    entry('monday', wallet._id, 70, '2026-10-12T00:00:00Z'),
    entry('old', wallet._id, 900, '2026-09-30T00:00:00Z'),
    entry('reader', readerWallet._id, 9000, '2026-10-16T00:00:00Z'),
    entry('other', otherWallet._id, 9000, '2026-10-16T00:00:00Z'),
    entry('withdraw', wallet._id, 30, '2026-10-16T00:00:00Z', {
      ledgerType: 'withdrawal-debit',
      direction: 'debit',
    }),
  ]);
  const now = new Date('2026-10-16T01:00:00Z');
  const day = await authorEarnings(author.account._id, 'day', now);
  expect(day).toMatchObject({
    balance: '555',
    allocationCredits: 100,
    bars: [100],
    labels: ['2026-10-16'],
    payout: null,
    buyers: null,
    creatorShare: null,
  });
  const week = await authorEarnings(author.account._id, 'week', now);
  expect(week.labels[0]).toBe('2026-10-12');
  expect(week.allocationCredits).toBe(220);
  expect((await authorEarnings(author.account._id, 'month', now)).allocationCredits).toBe(220);
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(555);
  expect(await LedgerEntry.countDocuments()).toBe(7);
  expect(
    (await request(app).get('/api/author/earnings?period=year').set('Cookie', author.cookie))
      .status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .get('/api/author/earnings?period=day&ownerId=forged')
        .set('Cookie', author.cookie)
    ).status,
  ).toBe(400);
  expect((await request(app).get('/api/author/earnings').set('Cookie', reader.cookie)).status).toBe(
    403,
  );
  expect((await request(app).get('/api/author/earnings')).status).toBe(401);
});

it('shows only the authenticated author current terms and reflects Admin changes without exposing write tokens', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  await AuthorRevenueRate.create({
    authorAccountId: other.account._id,
    percentage: 99,
    effectiveAt: new Date('2020-01-01'),
    actorAccountId: admin.account._id,
  });
  const own = () => request(app).get('/api/author/earnings').set('Cookie', author.cookie);
  const initial = await own();
  expect(initial.body.agreement).toEqual({
    authorShare: 70,
    platformShare: 30,
    source: 'default',
    effectiveAt: null,
  });
  const url = `/api/admin/authors/${author.account.id}/agreement`;
  const prepared = (await request(app).get(url).set('Cookie', admin.cookie)).body;
  const saved = await request(app)
    .post(url)
    .set('Cookie', admin.cookie)
    .set('Origin', 'http://localhost:5173')
    .send({
      percentage: 79,
      reason: 'Thỏa thuận mới',
      expectedAccountVersion: prepared.accountVersion,
      expectedLatestRateId: prepared.latestRateId,
    });
  expect(saved.status).toBe(201);
  await AuthorRevenueRate.create({
    authorAccountId: author.account._id,
    percentage: 95,
    effectiveAt: new Date('2030-01-01'),
    actorAccountId: admin.account._id,
  });
  const response = await own();
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.body.agreement).toMatchObject({
    authorShare: 79,
    platformShare: 21,
    source: 'agreement',
  });
  expect(Object.keys(response.body.agreement).sort()).toEqual([
    'authorShare',
    'effectiveAt',
    'platformShare',
    'source',
  ]);
  expect(response.body.creatorShare).toBe(null);
  expect(response.body.allocationCredits).toBe(0);
});
