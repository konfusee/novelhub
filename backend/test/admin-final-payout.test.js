import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  LedgerEntry,
  NotificationOutbox,
  PayoutSheetRow,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js';
import { evaluateFinalPayout, monthlyCutoff } from '../src/modules/admin-final-payout.js';
import { evaluateDueFinalPayouts } from '../src/modules/final-payout-scheduler.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
async function fixture({ amount = 137, bank = true } = {}) {
  const admin = await authenticatedAccount('admin');
  const cutoff = monthlyCutoff(new Date()).at;
  const account = await Account.create({
    displayName: 'Deleted user',
    everAuthor: true,
    status: 'anonymized',
    closedAt: new Date(cutoff - 1000),
    anonymizedAt: new Date(cutoff - 1000),
    retainedPayoutEmail: 'retained@example.test',
    ...(bank
      ? {
          finalPayoutBankDetailsSnapshot: {
            bankName: 'Test bank',
            accountNumber: '123456',
            accountHolder: 'FORMER AUTHOR',
          },
        }
      : {}),
  });
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: amount,
  });
  const evaluate = (extra = {}) =>
    request(app)
      .post(`/api/admin/account-closures/${account._id}/evaluate`)
      .set('Cookie', admin.cookie)
      .set('Origin', origin)
      .send({ expectedVersion: account.version, reason: 'Đánh giá chi trả cuối', ...extra });
  return { admin, account, wallet, evaluate };
}
it('uses the Vietnam monthly boundary including the year rollover', () => {
  expect(monthlyCutoff(new Date('2026-12-31T16:59:59Z'))).toEqual({
    period: '2026-12',
    at: new Date('2026-11-30T17:00:00Z'),
  });
  expect(monthlyCutoff(new Date('2026-12-31T17:00:00Z'))).toEqual({
    period: '2027-01',
    at: new Date('2026-12-31T17:00:00Z'),
  });
});
it('debits the complete final balance below threshold once and preserves a pending payout and original bank snapshot', async () => {
  const f = await fixture();
  const results = await Promise.all([f.evaluate(), f.evaluate()]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const withdrawal = await WithdrawalRequest.findOne({ accountId: f.account._id })
    .select('+bankDetailsSnapshot')
    .lean();
  expect(withdrawal.amountCoins).toBe(137);
  expect(withdrawal.thresholdCoins).toBe(0);
  expect(withdrawal.forcedByDeletion).toBe(true);
  expect(withdrawal.status).toBe('pending');
  const row = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id })
    .select('+bankDetailsSnapshot')
    .lean();
  expect(row.bankDetailsSnapshot.accountHolder).toBe('FORMER AUTHOR');
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(0);
  expect(
    await LedgerEntry.countDocuments({ walletId: f.wallet._id, ledgerType: 'withdrawal-debit' }),
  ).toBe(1);
  expect(
    await NotificationOutbox.countDocuments({
      sourceEventKey: `withdrawal-created:${withdrawal._id}`,
    }),
  ).toBe(1);
  const account = await Account.findById(f.account._id).select('+retainedPayoutEmail');
  expect(account.finalPayoutEvaluatedAt).toBeInstanceOf(Date);
  expect(account.financiallyClosedAt).toBeUndefined();
  expect(account.retainedPayoutEmail).toBe('retained@example.test');
  expect(JSON.stringify(results.map((r) => r.body))).not.toContain('123456');
});
it('creates an explicit missing-bank row for final earnings rather than losing the balance', async () => {
  const f = await fixture({ bank: false });
  expect((await f.evaluate()).status).toBe(200);
  const row = await PayoutSheetRow.findOne({}).select('+bankDetailsSnapshot');
  expect(row.bankDetailsMissing).toBe(true);
  expect(row.bankDetailsSnapshot).toBeUndefined();
  expect(row.amountCoins).toBe(137);
});
it('closes empty finance only if there are no pending withdrawals', async () => {
  const f = await fixture({ amount: 0 });
  expect((await f.evaluate()).body.account.financiallyClosed).toBe(true);
  const account = await Account.findById(f.account._id).select('+retainedPayoutEmail');
  expect(account.retainedPayoutEmail).toBeUndefined();
  expect(account.financiallyClosedAt).toBeInstanceOf(Date);
  expect(await WithdrawalRequest.countDocuments({})).toBe(0);
});
it('keeps an existing pending withdrawal payable without another debit or row', async () => {
  const f = await fixture({ amount: 0 });
  const withdrawal = await WithdrawalRequest.create({
    accountId: f.account._id,
    earningsWalletId: f.wallet._id,
    origin: 'system-monthly',
    periodId: '2000-01',
    cutoffAt: new Date(),
    evaluatedAt: new Date(),
    evaluatedBalanceCoins: 50,
    thresholdCoins: 0,
    amountCoins: 50,
    payoutSlipAmountVnd: 50,
    forcedByDeletion: false,
  });
  expect((await f.evaluate()).body.account.financiallyClosed).toBe(false);
  expect((await WithdrawalRequest.findById(withdrawal._id)).status).toBe('pending');
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect(await WithdrawalRequest.countDocuments({ accountId: f.account._id })).toBe(1);
});
it('rejects evaluation before the next cutoff and does not overwrite an existing period', async () => {
  const f = await fixture();
  await Account.updateOne(
    { _id: f.account._id },
    { $set: { closedAt: monthlyCutoff(new Date()).at } },
  );
  expect((await f.evaluate()).status).toBe(409);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(137);
  const before = new Date('2026-10-01T16:00:00Z');
  await expect(
    evaluateFinalPayout(
      f.admin.account,
      String(f.account._id),
      { expectedVersion: f.account.version, reason: 'Test' },
      before,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it('rolls back a debit, row and evaluation marker when outbox persistence fails', async () => {
  const f = await fixture();
  vi.spyOn(NotificationOutbox, 'create').mockRejectedValueOnce(new Error('outbox failed'));
  expect((await f.evaluate()).status).toBe(500);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(137);
  expect(await WithdrawalRequest.countDocuments({})).toBe(0);
  expect(await PayoutSheetRow.countDocuments({})).toBe(0);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect((await Account.findById(f.account._id)).finalPayoutEvaluatedAt).toBeUndefined();
});
it('restricts the queue to Admin and validates inputs and Origin', async () => {
  const f = await fixture();
  const reader = await authenticatedAccount('reader');
  expect(
    (await request(app).get('/api/admin/account-closures').set('Cookie', reader.cookie)).status,
  ).toBe(403);
  const list = await request(app).get('/api/admin/account-closures').set('Cookie', f.admin.cookie);
  expect(list.status).toBe(200);
  expect(list.headers['cache-control']).toBe('private, no-store');
  expect(list.body.items[0]).toMatchObject({
    id: String(f.account._id),
    balance: 137,
    canEvaluate: true,
  });
  expect(JSON.stringify(list.body)).not.toContain('retained@example.test');
  expect((await f.evaluate({ expectedVersion: 999 })).status).toBe(409);
  expect((await f.evaluate({ reason: '' })).status).toBe(400);
  expect(
    (
      await request(app)
        .post(`/api/admin/account-closures/${f.account._id}/evaluate`)
        .set('Cookie', f.admin.cookie)
        .set('Origin', 'https://wrong.example')
        .send({ expectedVersion: 0, reason: 'Test' })
    ).status,
  ).toBe(403);
  expect(await AuditEvent.countDocuments({ action: 'account.final-payout.evaluated' })).toBe(0);
});
it('refuses a conflicting evaluation period without debiting the remaining balance', async () => {
  const f = await fixture();
  await WithdrawalRequest.create({
    accountId: f.account._id,
    earningsWalletId: f.wallet._id,
    origin: 'system-monthly',
    periodId: monthlyCutoff(new Date()).period,
    cutoffAt: new Date(),
    evaluatedAt: new Date(),
    evaluatedBalanceCoins: 50,
    thresholdCoins: 0,
    amountCoins: 50,
    payoutSlipAmountVnd: 50,
    forcedByDeletion: false,
  });
  expect((await f.evaluate()).status).toBe(409);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(137);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
});
it('records Admin-only corrected bank details without rewriting either original evaluation snapshot', async () => {
  const f = await fixture();
  await f.evaluate();
  const withdrawal = await WithdrawalRequest.findOne({ accountId: f.account._id })
    .select('+bankDetailsSnapshot')
    .lean();
  const row = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id })
    .select('+bankDetailsSnapshot')
    .lean();
  const bank = {
    bankName: 'Corrected bank',
    accountNumber: '987654',
    accountHolder: 'CORRECTED AUTHOR',
  };
  const result = await request(app)
    .post(`/api/admin/account-closures/${f.account._id}/payouts/${withdrawal._id}/bank`)
    .set('Cookie', f.admin.cookie)
    .set('Origin', origin)
    .send({
      expectedRowVersion: row.version,
      expectedWithdrawalVersion: withdrawal.version,
      reason: 'Thông tin do hỗ trợ cung cấp',
      bank,
    });
  expect(result.status).toBe(200);
  expect(result.body.rowVersion).toBeGreaterThan(row.version);
  const saved = await PayoutSheetRow.findById(row._id)
    .select('+bankDetailsSnapshot +correctedBankDetailsSnapshot')
    .lean();
  expect(saved.bankDetailsSnapshot).toEqual(row.bankDetailsSnapshot);
  expect(saved.correctedBankDetailsSnapshot).toEqual(bank);
  expect(
    (await WithdrawalRequest.findById(withdrawal._id).select('+bankDetailsSnapshot'))
      .bankDetailsSnapshot,
  ).toEqual(withdrawal.bankDetailsSnapshot);
  expect(await LedgerEntry.countDocuments({ walletId: f.wallet._id })).toBe(1);
  const list = await request(app)
    .get(`/api/admin/account-closures/${f.account._id}/payouts`)
    .set('Cookie', f.admin.cookie);
  expect(list.body.items[0].correctedBank).toEqual(bank);
  expect(list.headers['cache-control']).toBe('private, no-store');
  const reader = await authenticatedAccount('reader');
  expect(
    (
      await request(app)
        .get(`/api/admin/account-closures/${f.account._id}/payouts`)
        .set('Cookie', reader.cookie)
    ).status,
  ).toBe(403);
});
it('rejects stale bank corrections and rolls back corrections if the audit cannot persist', async () => {
  const f = await fixture({ bank: false });
  await f.evaluate();
  const withdrawal = await WithdrawalRequest.findOne({ accountId: f.account._id });
  const row = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id });
  const write = (extra = {}) =>
    request(app)
      .post(`/api/admin/account-closures/${f.account._id}/payouts/${withdrawal._id}/bank`)
      .set('Cookie', f.admin.cookie)
      .set('Origin', origin)
      .send({
        expectedRowVersion: row.version,
        expectedWithdrawalVersion: withdrawal.version,
        reason: 'Thông tin hỗ trợ',
        bank: { bankName: 'Bank', accountNumber: '987654', accountHolder: 'AUTHOR' },
        ...extra,
      });
  expect((await write({ expectedRowVersion: 999 })).status).toBe(409);
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit failed'));
  expect((await write()).status).toBe(500);
  expect(
    (await PayoutSheetRow.findById(row._id).select('+correctedBankDetailsSnapshot'))
      .correctedBankDetailsSnapshot,
  ).toBeUndefined();
  expect((await WithdrawalRequest.findById(withdrawal._id)).version).toBe(withdrawal.version);
  expect(
    (await write({ bank: { bankName: '', accountNumber: '', accountHolder: '' } })).status,
  ).toBe(400);
});
it('runs due final evaluations as system work and handles overlapping workers exactly once', async () => {
  const f = await fixture();
  const results = await Promise.all([evaluateDueFinalPayouts(), evaluateDueFinalPayouts()]);
  expect(results.reduce((sum, r) => sum + r.evaluated, 0)).toBe(1);
  expect(results.reduce((sum, r) => sum + r.failed, 0)).toBe(0);
  expect(await WithdrawalRequest.countDocuments({ accountId: f.account._id })).toBe(1);
  expect(await LedgerEntry.countDocuments({ walletId: f.wallet._id })).toBe(1);
  const audit = await AuditEvent.findOne({ action: 'account.final-payout.evaluated' }).lean();
  expect(audit.actorType).toBe('system');
  expect(audit.actorId).toBeUndefined();
  expect(await evaluateDueFinalPayouts()).toEqual({ evaluated: 0, changed: 0, failed: 0 });
});
it('keeps accounts closed in the current month out of automatic evaluation until the next Vietnam cutoff', async () => {
  const f = await fixture();
  const closedAt = new Date('2026-10-18T12:00:00Z');
  await Account.updateOne({ _id: f.account._id }, { $set: { closedAt } });
  expect((await evaluateDueFinalPayouts({ now: new Date('2026-10-31T16:59:59Z') })).evaluated).toBe(
    0,
  );
  expect((await evaluateDueFinalPayouts({ now: new Date('2026-10-31T17:00:00Z') })).evaluated).toBe(
    1,
  );
  expect((await WithdrawalRequest.findOne({ accountId: f.account._id })).periodId).toBe('2026-11');
});
