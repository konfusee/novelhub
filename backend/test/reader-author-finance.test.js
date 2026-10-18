import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PolicyVersion, RoleAssignment, Wallet } from '../src/models/index.js';
import { evaluateMonthlyAuthorPayout } from '../src/modules/monthly-author-payouts.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const base = '/api/reader/author-finance';
it('preserves own payout and bank access after author revocation without restoring authoring permissions', async () => {
  const author = await authenticatedAccount('author', {
    createdAt: new Date('2026-08-01'),
    bankDetails: { bankName: 'Bank', accountNumber: '00123456', accountHolder: 'AUTHOR' },
  });
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    actorAccountId: author.account._id,
  });
  await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 120000,
  });
  const payout = await evaluateMonthlyAuthorPayout(
    author.account._id,
    new Date('2026-10-01T00:00:00Z'),
  );
  await RoleAssignment.updateOne(
    { accountId: author.account._id, role: 'author' },
    { $set: { status: 'revoked' } },
  );
  const get = (path) => request(app).get(path).set('Cookie', author.cookie);
  expect((await get('/api/author/payouts')).status).toBe(403);
  expect((await get('/api/author/stories')).status).toBe(403);
  const list = await get(`${base}/payouts`);
  expect(list.status).toBe(200);
  expect(list.headers['cache-control']).toContain('no-store');
  expect(list.body.items[0].id).toBe(payout.withdrawalId);
  expect((await get(`${base}/payouts/${payout.withdrawalId}`)).status).toBe(200);
  const bank = await get(`${base}/bank-details`);
  expect(bank.body.bank.accountNumber).toBe('00123456');
  expect(
    (
      await request(app)
        .put(`${base}/bank-details`)
        .set('Cookie', author.cookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          expectedVersion: bank.body.version,
          bank: { ...bank.body.bank, accountNumber: '00999999' },
        })
    ).status,
  ).toBe(200);
  const other = await authenticatedAccount('author');
  expect(
    (await request(app).get(`${base}/payouts/${payout.withdrawalId}`).set('Cookie', other.cookie))
      .status,
  ).toBe(404);
});
it('denies ordinary readers, Admins without author history, guests and malformed requests', async () => {
  expect((await request(app).get(`${base}/payouts`)).status).toBe(401);
  for (const role of ['reader', 'admin', 'moderator']) {
    const user = await authenticatedAccount(role);
    expect((await request(app).get(`${base}/bank-details`).set('Cookie', user.cookie)).status).toBe(
      403,
    );
  }
  const author = await authenticatedAccount('author');
  expect(
    (await request(app).get(`${base}/payouts?accountId=forged`).set('Cookie', author.cookie))
      .status,
  ).toBe(400);
  expect(
    (await request(app).get(`${base}/payouts/invalid`).set('Cookie', author.cookie)).status,
  ).toBe(400);
});
