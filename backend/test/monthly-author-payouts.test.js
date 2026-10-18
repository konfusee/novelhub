import { expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { testConfig } from './config.js';
import {
  Account,
  AuditEvent,
  LedgerEntry,
  Notification,
  PolicyVersion,
  PayoutSheetRow,
  RoleAssignment,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js';
import {
  evaluateDueMonthlyAuthorPayouts,
  evaluateMonthlyAuthorPayout,
} from '../src/modules/monthly-author-payouts.js';
import { monthlyCutoff } from '../src/modules/admin-final-payout.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const now = new Date('2026-10-02T00:00:00Z');
async function fixture({ balance = 120000, bank = true, status = 'active' } = {}) {
  const { account } = await authenticatedAccount('author', {
    createdAt: new Date('2026-08-01'),
    status,
    ...(bank
      ? { bankDetails: { bankName: 'Test bank', accountNumber: '123456', accountHolder: 'AUTHOR' } }
      : {}),
  });
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: balance,
  });
  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    actorAccountId: account._id,
  });
  return { account, wallet, policy };
}
it('serializes monthly evaluation, debits once and snapshots the payout without requiring a current author role', async () => {
  const f = await fixture();
  await RoleAssignment.deleteMany({ accountId: f.account._id });
  const results = await Promise.all([
    evaluateMonthlyAuthorPayout(f.account._id, now),
    evaluateMonthlyAuthorPayout(f.account._id, now),
  ]);
  expect(results.filter((r) => !r.replayed)).toHaveLength(1);
  expect(await WithdrawalRequest.countDocuments()).toBe(1);
  expect(await PayoutSheetRow.countDocuments()).toBe(1);
  expect(await LedgerEntry.countDocuments({ ledgerType: 'withdrawal-debit' })).toBe(1);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(0);
  const withdrawal = await WithdrawalRequest.findOne().select('+bankDetailsSnapshot');
  expect(withdrawal.amountCoins).toBe(120000);
  expect(withdrawal.forcedByDeletion).toBe(false);
  expect(withdrawal.bankDetailsSnapshot.accountNumber).toBe('123456');
  expect(await Notification.countDocuments({ eventType: 'withdrawal.created' })).toBe(1);
});
it('carries below-threshold balances silently and notifies missing bank only once per period', async () => {
  const below = await fixture({ balance: 99999 });
  expect((await evaluateMonthlyAuthorPayout(below.account._id, now)).result).toBe(
    'below-threshold',
  );
  expect(await Notification.countDocuments()).toBe(0);
  const missing = await fixture({ bank: false });
  expect((await evaluateMonthlyAuthorPayout(missing.account._id, now)).result).toBe(
    'bank-required',
  );
  await Account.updateOne(
    { _id: missing.account._id },
    { $set: { bankDetails: { bankName: 'Bank', accountNumber: '123', accountHolder: 'Author' } } },
  );
  expect((await evaluateMonthlyAuthorPayout(missing.account._id, now)).replayed).toBe(true);
  expect(await Notification.countDocuments({ eventType: 'withdrawal.bank-required' })).toBe(1);
  expect(await WithdrawalRequest.countDocuments()).toBe(0);
  expect((await Wallet.findById(missing.wallet._id)).availableBalance).toBe(120000);
  expect(
    (await evaluateMonthlyAuthorPayout(missing.account._id, new Date('2026-11-01T00:00:00Z')))
      .result,
  ).toBe('pending-payout');
});
it('excludes post-cutoff credits when processing after downtime and uses cutoff policy', async () => {
  const f = await fixture({ balance: 140000 });
  await LedgerEntry.create({
    walletId: f.wallet._id,
    ledgerType: 'allocation-credit',
    direction: 'credit',
    amount: 20000,
    sourceType: 'RevenueAllocation',
    sourceId: f.account._id,
    occurredAt: new Date(monthlyCutoff(now).at.getTime() + 1000),
    idempotencyScope: { operation: 'test-credit', ownerId: f.account._id, key: '1' },
  });
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-10-01T00:00:00Z'),
    withdrawalThresholdCoins: 999999,
    actorAccountId: f.account._id,
  });
  expect((await evaluateMonthlyAuthorPayout(f.account._id, now)).result).toBe('pending-payout');
  expect((await WithdrawalRequest.findOne()).amountCoins).toBe(120000);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(20000);
});
it('skips suspended accounts and rolls back completely if payout persistence fails', async () => {
  const suspended = await fixture({ status: 'suspended' });
  expect((await evaluateMonthlyAuthorPayout(suspended.account._id, now)).result).toBe('ineligible');
  expect(await AuditEvent.countDocuments({ action: 'author.monthly-payout.evaluated' })).toBe(0);
  const f = await fixture();
  const { vi } = await import('vitest');
  const spy = vi
    .spyOn(PayoutSheetRow, 'create')
    .mockRejectedValueOnce(new Error('storage failure'));
  try {
    await expect(evaluateMonthlyAuthorPayout(f.account._id, now)).rejects.toThrow(
      'storage failure',
    );
  } finally {
    spy.mockRestore();
  }
  expect(await WithdrawalRequest.countDocuments()).toBe(0);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(120000);
});
it('uses the Vietnam month boundary, skips new accounts and makes scheduled retries harmless', async () => {
  const f = await fixture();
  await Account.collection.updateOne(
    { _id: f.account._id },
    { $set: { createdAt: new Date('2026-09-15') } },
  );
  expect(
    (await evaluateMonthlyAuthorPayout(f.account._id, new Date('2026-09-30T16:59:59Z'))).result,
  ).toBe('ineligible');
  const boundary = new Date('2026-09-30T17:00:00Z');
  expect(await evaluateDueMonthlyAuthorPayouts({ now: boundary })).toEqual({
    evaluated: 1,
    failed: 0,
  });
  expect((await WithdrawalRequest.findOne()).periodId).toBe('2026-10');
  expect(await evaluateDueMonthlyAuthorPayouts({ now: boundary })).toEqual({
    evaluated: 0,
    failed: 0,
  });
});
it('lets Admin settle ordinary payouts after suspension without closing the account or debiting again', async () => {
  const f = await fixture();
  const admin = await authenticatedAccount('admin');
  const created = await evaluateMonthlyAuthorPayout(f.account._id, now);
  await Account.updateOne({ _id: f.account._id }, { $set: { status: 'suspended' } });
  const base = `/api/admin/monthly-payouts/${f.account._id}/payouts`;
  expect(
    (await request(app).get('/api/admin/monthly-payouts').set('Cookie', admin.cookie)).body.total,
  ).toBe(1);
  const list = await request(app).get(base).set('Cookie', admin.cookie);
  expect(list.status).toBe(200);
  const row = list.body.items[0];
  expect(row.id).toBe(created.withdrawalId);
  const input = {
    expectedWithdrawalVersion: row.version,
    expectedRowVersion: row.rowVersion,
    resultEntryKey: 'monthly-paid',
    result: 'Paid',
    confirmedExternalTransfer: true,
    reason: 'Đã đối chiếu ngân hàng',
  };
  const post = (body) =>
    request(app)
      .post(`${base}/${row.id}/results`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:5173')
      .send(body);
  expect((await post({ ...input, confirmedExternalTransfer: undefined })).status).toBe(400);
  expect(
    (
      await post({
        ...input,
        result: 'Failed',
        resultEntryKey: 'monthly-failed',
        confirmedExternalTransfer: undefined,
      })
    ).status,
  ).toBe(200);
  expect((await WithdrawalRequest.findById(row.id)).status).toBe('pending');
  const refreshed = await request(app).get(base).set('Cookie', admin.cookie);
  input.expectedWithdrawalVersion = refreshed.body.items[0].version;
  const paid = await post(input);
  expect(paid.status).toBe(200);
  expect(paid.body.financiallyClosed).toBe(false);
  expect((await post(input)).body.replayed).toBe(true);
  expect((await WithdrawalRequest.findById(row.id)).status).toBe('paid');
  const paidQueue = await request(app)
    .get('/api/admin/monthly-payouts?period=2026-10&status=paid')
    .set('Cookie', admin.cookie);
  expect(paidQueue.body.total).toBe(1);
  expect(paidQueue.body.items[0].pendingWithdrawals).toBe(0);
  expect(
    (
      await request(app)
        .get('/api/admin/monthly-payouts?period=2026-09&status=paid')
        .set('Cookie', admin.cookie)
    ).body.total,
  ).toBe(0);
  const paidRows = await request(app).get(base).set('Cookie', admin.cookie);
  expect(paidRows.body.items[0].id).toBe(row.id);
  expect(paidRows.body.items[0].canCorrect).toBe(false);
  expect(paidRows.body.items[0].lastResult).toBe('Paid');
  expect((await Account.findById(f.account._id)).financiallyClosedAt).toBeUndefined();
  expect(await LedgerEntry.countDocuments({ ledgerType: 'withdrawal-debit' })).toBe(1);
  expect((await request(app).get(base)).status).toBe(401);
  const reader = await authenticatedAccount('reader');
  expect((await request(app).get(base).set('Cookie', reader.cookie)).status).toBe(403);
});
