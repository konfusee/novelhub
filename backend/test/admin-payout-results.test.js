import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  LedgerEntry,
  Notification,
  NotificationOutbox,
  PayoutResultEntry,
  PayoutSheetRow,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js';
import { evaluateFinalPayout, monthlyCutoff } from '../src/modules/admin-final-payout.js';
import { deliverPayoutEmails } from '../src/modules/payout-email-worker.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const origin = 'http://localhost:5173',
  app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
async function fixture(bank = true) {
  const admin = await authenticatedAccount('admin');
  const account = await Account.create({
    status: 'anonymized',
    everAuthor: true,
    displayName: 'Deleted user',
    closedAt: new Date(monthlyCutoff(new Date()).at - 1000),
    retainedPayoutEmail: 'retained@example.test',
    ...(bank
      ? {
          finalPayoutBankDetailsSnapshot: {
            bankName: 'Test bank',
            accountNumber: '123456',
            accountHolder: 'AUTHOR',
          },
        }
      : {}),
  });
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: 137,
  });
  await evaluateFinalPayout(admin.account, String(account._id), {
    expectedVersion: account.version,
    reason: 'Đánh giá cuối',
  });
  const withdrawal = await WithdrawalRequest.findOne({ accountId: account._id }),
    row = await PayoutSheetRow.findOne({ withdrawalRequestId: withdrawal._id });
  const write = (extra = {}) =>
    request(app)
      .post(`/api/admin/account-closures/${account._id}/payouts/${withdrawal._id}/results`)
      .set('Cookie', admin.cookie)
      .set('Origin', origin)
      .send({
        expectedWithdrawalVersion: withdrawal.version,
        expectedRowVersion: row.version,
        resultEntryKey: 'entry-1',
        result: 'Paid',
        confirmedExternalTransfer: true,
        reason: 'Đã đối chiếu chuyển tiền',
        ...extra,
      });
  return { admin, account, wallet, withdrawal, row, write };
}
it('records Paid once, closes settled finance and keeps a transient email recipient without debiting twice', async () => {
  const f = await fixture();
  const first = await f.write();
  expect(first.status).toBe(200);
  expect(first.body.financiallyClosed).toBe(true);
  const duplicate = await f.write();
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.replayed).toBe(true);
  expect(duplicate.body.entryId).toBe(first.body.entryId);
  expect(
    await PayoutResultEntry.countDocuments({
      withdrawalRequestId: f.withdrawal._id,
      result: 'Paid',
    }),
  ).toBe(1);
  expect(await LedgerEntry.countDocuments({ walletId: f.wallet._id })).toBe(1);
  expect((await WithdrawalRequest.findById(f.withdrawal._id)).status).toBe('paid');
  const account = await Account.findById(f.account._id).select('+retainedPayoutEmail');
  expect(account.financiallyClosedAt).toBeInstanceOf(Date);
  expect(account.retainedPayoutEmail).toBeUndefined();
  const notice = await Notification.findOne({ eventType: 'withdrawal.paid' }).lean();
  expect(notice.payload.emailRecipient).toBe('retained@example.test');
  expect(await NotificationOutbox.countDocuments({ sourceEventKey: notice.sourceEventKey })).toBe(
    1,
  );
  expect(JSON.stringify(first.body)).not.toContain('retained@example.test');
  expect((await f.write({ reason: 'Nội dung khác' })).status).toBe(409);
  expect((await f.write({ resultEntryKey: 'another-entry' })).status).toBe(409);
});
it('keeps Failed pending, allows a later Paid and preserves both append-only results', async () => {
  const f = await fixture();
  expect((await f.write({ result: 'Failed', confirmedExternalTransfer: undefined })).status).toBe(
    200,
  );
  expect((await WithdrawalRequest.findById(f.withdrawal._id)).status).toBe('pending');
  expect(
    (await f.write({ result: 'Failed', confirmedExternalTransfer: undefined })).body.replayed,
  ).toBe(true);
  expect((await Account.findById(f.account._id)).financiallyClosedAt).toBeUndefined();
  const current = await WithdrawalRequest.findById(f.withdrawal._id);
  expect(
    (await f.write({ resultEntryKey: 'entry-paid', expectedWithdrawalVersion: current.version }))
      .status,
  ).toBe(200);
  expect(await PayoutResultEntry.countDocuments({ withdrawalRequestId: f.withdrawal._id })).toBe(2);
  expect(await LedgerEntry.countDocuments({ walletId: f.wallet._id })).toBe(1);
});
it('requires payment acknowledgement, bank details and a fresh baseline', async () => {
  const f = await fixture(false);
  expect((await f.write({ confirmedExternalTransfer: undefined })).status).toBe(400);
  expect((await f.write()).status).toBe(409);
  expect((await f.write({ expectedRowVersion: 999 })).status).toBe(409);
  expect(await PayoutResultEntry.countDocuments({})).toBe(0);
});
it('allows only one Paid result when different entry keys race against the same baseline', async () => {
  const f = await fixture();
  const responses = await Promise.all([
    f.write({ resultEntryKey: 'race-1' }),
    f.write({ resultEntryKey: 'race-2' }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    await PayoutResultEntry.countDocuments({
      result: 'Paid',
      withdrawalRequestId: f.withdrawal._id,
    }),
  ).toBe(1);
  expect(await LedgerEntry.countDocuments({ walletId: f.wallet._id })).toBe(1);
});
it('blocks further results and bank edits when legacy Paid evidence conflicts with a pending status', async () => {
  const f = await fixture();
  await PayoutResultEntry.create({
    withdrawalRequestId: f.withdrawal._id,
    resultEntryKey: 'legacy-paid',
    actorAccountId: f.admin.account._id,
    occurredAt: new Date(),
    result: 'Paid',
  });
  expect((await f.write()).status).toBe(409);
  const list = await request(app)
    .get(`/api/admin/account-closures/${f.account._id}/payouts`)
    .set('Cookie', f.admin.cookie);
  expect(list.body.items[0].canCorrect).toBe(false);
  const corrected = await request(app)
    .post(`/api/admin/account-closures/${f.account._id}/payouts/${f.withdrawal._id}/bank`)
    .set('Cookie', f.admin.cookie)
    .set('Origin', origin)
    .send({
      expectedWithdrawalVersion: f.withdrawal.version,
      expectedRowVersion: f.row.version,
      reason: 'Kiểm tra',
      bank: { bankName: 'Bank', accountNumber: 'TEST', accountHolder: 'AUTHOR' },
    });
  expect(corrected.status).toBe(409);
});
it('keeps Paid and financial closure committed when subsequent email delivery fails', async () => {
  const f = await fixture();
  expect((await f.write()).status).toBe(200);
  await deliverPayoutEmails({ send: vi.fn().mockRejectedValue(new Error('SMTP offline')) });
  expect((await WithdrawalRequest.findById(f.withdrawal._id)).status).toBe('paid');
  expect((await Account.findById(f.account._id)).financiallyClosedAt).toBeInstanceOf(Date);
  expect(await LedgerEntry.countDocuments({ walletId: f.wallet._id })).toBe(1);
  expect(
    await PayoutResultEntry.countDocuments({
      withdrawalRequestId: f.withdrawal._id,
      result: 'Paid',
    }),
  ).toBe(1);
});
it('rolls back Paid, financial closure and notifications if audit fails', async () => {
  const f = await fixture();
  const count = await Notification.countDocuments({});
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit failed'));
  expect((await f.write()).status).toBe(500);
  expect((await WithdrawalRequest.findById(f.withdrawal._id)).status).toBe('pending');
  expect((await Account.findById(f.account._id)).financiallyClosedAt).toBeUndefined();
  expect(await PayoutResultEntry.countDocuments({})).toBe(0);
  expect(await Notification.countDocuments({})).toBe(count);
});
