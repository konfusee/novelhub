import { expect, it } from 'vitest';
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
