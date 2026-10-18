import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  BankTransaction,
  LedgerEntry,
  PayoutResultEntry,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig());
async function fixture() {
  const admin = await authenticatedAccount('admin'),
    reader = await authenticatedAccount('reader'),
    author = await authenticatedAccount('author');
  const wallets = await Wallet.create([
    {
      ownerType: 'account',
      ownerId: reader.account._id,
      purpose: 'reader-coins',
      availableBalance: 0,
    },
    {
      ownerType: 'account',
      ownerId: author.account._id,
      purpose: 'author-earnings',
      availableBalance: 140,
    },
    {
      ownerType: 'system',
      ownerId: admin.account._id,
      purpose: 'system-earnings',
      availableBalance: 70,
    },
  ]);
  const legs = [
    ['topup-credit', 'credit', 200, 0],
    ['unlock-debit', 'debit', 200, 0],
    ['allocation-credit', 'credit', 140, 1],
    ['allocation-credit', 'credit', 60, 2],
    ['adjustment', 'credit', 10, 2],
  ];
  for (const [index, [ledgerType, direction, amount, wallet]] of legs.entries())
    await LedgerEntry.create({
      walletId: wallets[wallet]._id,
      ledgerType,
      direction,
      amount,
      sourceType: 'UnlockRequest',
      sourceId: reader.account._id,
      actorAccountId: admin.account._id,
      reason: 'Bút toán kiểm thử',
      idempotencyScope: {
        operation: 'report-test',
        ownerId: reader.account._id,
        key: String(index),
      },
      occurredAt: new Date('2026-09-30T17:00:00Z'),
    });
  for (const [index, occurredAt] of ['2026-09-30T16:59:59Z', '2026-10-31T17:00:00Z'].entries())
    await LedgerEntry.create({
      walletId: wallets[0]._id,
      ledgerType: 'topup-credit',
      direction: 'credit',
      amount: 1,
      sourceType: 'TopUpOrder',
      sourceId: reader.account._id,
      idempotencyScope: { operation: 'boundary', ownerId: reader.account._id, key: String(index) },
      occurredAt: new Date(occurredAt),
    });
  const withdrawal = (periodId, amountCoins, status) =>
    WithdrawalRequest.create({
      accountId: author.account._id,
      earningsWalletId: wallets[1]._id,
      origin: 'system-monthly',
      periodId,
      cutoffAt: new Date('2026-09-30T17:00:00Z'),
      evaluatedBalanceCoins: amountCoins,
      thresholdCoins: 0,
      evaluatedAt: new Date(),
      amountCoins,
      payoutSlipAmountVnd: amountCoins,
      status,
      forcedByDeletion: false,
      bankDetailsSnapshot: { accountNumber: 'SECRET-BANK' },
    });
  const paid = await withdrawal('2026-10', 100, 'paid');
  await withdrawal('2026-09', 40, 'pending');
  await PayoutResultEntry.create({
    withdrawalRequestId: paid._id,
    resultEntryKey: 'paid',
    actorAccountId: admin.account._id,
    occurredAt: new Date('2026-10-10T00:00:00Z'),
    result: 'Paid',
    transferReference: 'SECRET-TRANSFER',
  });
  await BankTransaction.create({
    sePayTransactionId: 'bank-report',
    amountVnd: 20,
    matchStatus: 'amount-mismatch',
    receivedAt: new Date(),
    apiKeyAuthenticated: true,
  });
  const get = (query = 'period=2026-10') =>
    request(app).get(`/api/admin/finance-report?${query}`).set('Cookie', admin.cookie);
  return { admin, reader, get };
}
it('reports real allocations separately from top-ups/adjustments and respects Vietnamese month boundaries', async () => {
  const f = await fixture();
  const result = await f.get();
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(result.body.summary).toMatchObject({
    topUpCoins: 200,
    unlockCoins: 200,
    authorRevenueCoins: 140,
    platformRevenueCoins: 60,
    platformBalanceCoins: 70,
    pendingPayoutCoins: 40,
    pendingPayoutCount: 1,
    paidPayoutCoins: 100,
    paidPayoutCount: 1,
    openBankExceptions: 1,
  });
  expect(result.body.items).toHaveLength(5);
  expect(
    result.body.items.every(
      (item) => typeof item.sourceId === 'string' && typeof item.ownerId === 'string',
    ),
  ).toBe(true);
  expect(JSON.stringify(result.body)).not.toMatch(/SECRET|bankDetails|transferReference|email/);
  expect((await f.get('period=all')).body.summary.topUpCoins).toBe(202);
});
it('filters ledger purpose/type without silently changing the report totals', async () => {
  const f = await fixture();
  const result = await f.get('period=2026-10&purpose=system-earnings&type=allocation-credit');
  expect(result.body.items).toHaveLength(1);
  expect(result.body.items[0].amount).toBe(60);
  expect(result.body.summary.topUpCoins).toBe(200);
  expect((await f.get('period=2026-10&page=2')).body.items).toEqual([]);
});
it('returns actual zero/empty state and rejects unauthorized and malformed queries', async () => {
  const admin = await authenticatedAccount('admin'),
    reader = await authenticatedAccount('reader');
  const url = '/api/admin/finance-report';
  expect((await request(app).get(url)).status).toBe(401);
  expect((await request(app).get(url).set('Cookie', reader.cookie)).status).toBe(403);
  const result = await request(app).get(url).set('Cookie', admin.cookie);
  expect(result.body.items).toEqual([]);
  expect(result.body.summary.platformRevenueCoins).toBe(0);
  for (const query of ['period=2026-13', 'type=unknown', 'purpose=bank', 'page=0', 'email=x'])
    expect((await request(app).get(`${url}?${query}`).set('Cookie', admin.cookie)).status).toBe(
      400,
    );
});
