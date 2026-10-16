import request from 'supertest';
import mongoose from 'mongoose';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Wallet,
  WithdrawalRequest,
  PayoutSheetRow,
  PayoutResultEntry,
} from '../src/models/index.js';
import {
  authorPayouts,
  authorPayoutDetail,
  authorPayoutQuery,
} from '../src/modules/author-payouts.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const now = new Date('2026-10-16T12:00:00Z');
const query = (value = {}) => authorPayoutQuery.parse(value);
const secret = {
  bankName: 'PRIVATE_BANK',
  accountNumber: 'PRIVATE_ACCOUNT',
  accountHolder: 'PRIVATE_HOLDER',
};
async function fixture() {
  const author = await authenticatedAccount('author');
  const admin = await authenticatedAccount('admin');
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 500,
  });
  async function withdrawal(period = '2026-10', fields = {}) {
    return WithdrawalRequest.create({
      accountId: author.account._id,
      earningsWalletId: wallet._id,
      origin: 'system-monthly',
      periodId: period,
      cutoffAt: new Date('2026-10-01T00:00:00Z'),
      evaluatedBalanceCoins: 100000,
      thresholdCoins: 100000,
      evaluatedAt: new Date('2026-10-01T00:00:00Z'),
      amountCoins: 100000,
      payoutSlipAmountVnd: 100000,
      bankDetailsSnapshot: secret,
      forcedByDeletion: false,
      ...fields,
    });
  }
  const row = (withdrawal, fields = {}) =>
    PayoutSheetRow.create({
      withdrawalRequestId: withdrawal._id,
      periodId: withdrawal.periodId,
      amountCoins: withdrawal.amountCoins,
      bankDetailsSnapshot: secret,
      correctedBankDetailsSnapshot: secret,
      correctionReason: 'PRIVATE_CORRECTION',
      ...fields,
    });
  const result = (withdrawal, state, date = '2026-10-02T01:00:00Z') =>
    PayoutResultEntry.create({
      withdrawalRequestId: withdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      result: state,
      occurredAt: new Date(date),
      actorAccountId: admin.account._id,
      transferReference: 'PRIVATE_TRANSFER',
      note: 'PRIVATE_NOTE',
      correctedBankDetailsSnapshot: secret,
    });
  return { author, wallet, withdrawal, row, result };
}
it('shows a slip only for matching paid request, sheet and Paid result; never exposes private fields', async () => {
  const f = await fixture();
  const withdrawal = await f.withdrawal('2026-09', { status: 'paid' });
  await f.row(withdrawal);
  await f.result(withdrawal, 'Failed', '2026-10-01T01:00:00Z');
  await f.result(withdrawal, 'Paid');
  const before = await WithdrawalRequest.findById(withdrawal._id).lean();
  const detail = await authorPayoutDetail(f.author.account._id, withdrawal._id, now);
  expect(detail.item.state).toBe('paid');
  expect(detail.slip).toMatchObject({
    id: String(withdrawal._id),
    period: '2026-09',
    amountVnd: 100000,
  });
  expect(detail.item.lastFailedAt).toEqual(new Date('2026-10-01T01:00:00Z'));
  const response = await request(app)
    .get(`/api/author/payouts/${withdrawal._id}`)
    .set('Cookie', f.author.cookie);
  expect(response.status).toBe(200);
  expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
  expect(response.body.item).not.toHaveProperty('actorAccountId');
  expect(await WithdrawalRequest.findById(withdrawal._id).lean()).toEqual(before);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(500);
});
it('keeps failed payouts pending with no slip or balance refund', async () => {
  const f = await fixture();
  const withdrawal = await f.withdrawal();
  await f.row(withdrawal);
  await f.result(withdrawal, 'Failed');
  const detail = await authorPayoutDetail(f.author.account._id, withdrawal._id, now);
  expect(detail).toMatchObject({ item: { state: 'failed', paidAt: null }, slip: null });
  expect((await WithdrawalRequest.findById(withdrawal._id)).status).toBe('pending');
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(500);
});
it.each([
  'missing-paid',
  'missing-sheet',
  'wrong-amount',
  'wrong-period',
  'pending-paid',
  'future-paid',
])('withholds a Paid slip for %s', async (kind) => {
  const f = await fixture();
  const withdrawal = await f.withdrawal('2026-10', {
    status: kind === 'pending-paid' ? 'pending' : 'paid',
  });
  if (kind !== 'missing-sheet')
    await f.row(
      withdrawal,
      kind === 'wrong-amount'
        ? { amountCoins: 100001 }
        : kind === 'wrong-period'
          ? { periodId: '2026-09' }
          : {},
    );
  if (kind !== 'missing-paid')
    await f.result(withdrawal, 'Paid', kind === 'future-paid' ? '2026-10-17T00:00:00Z' : undefined);
  expect(await authorPayoutDetail(f.author.account._id, withdrawal._id, now)).toMatchObject({
    item: { state: 'unavailable', paidAt: null },
    slip: null,
  });
});
it('checks account and wallet ownership, role and IDs on list and detail', async () => {
  const f = await fixture();
  const withdrawal = await f.withdrawal();
  const other = await authenticatedAccount('author');
  const reader = await authenticatedAccount();
  const path = `/api/author/payouts/${withdrawal._id}`;
  expect((await request(app).get(path).set('Cookie', other.cookie)).status).toBe(404);
  expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403);
  expect((await request(app).get(path)).status).toBe(401);
  expect(
    (await request(app).get('/api/author/payouts/bad-id').set('Cookie', f.author.cookie)).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .get(`/api/author/payouts/${new mongoose.Types.ObjectId()}`)
        .set('Cookie', f.author.cookie)
    ).status,
  ).toBe(404);
  const ownReaderWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: f.author.account._id,
    purpose: 'reader-coins',
  });
  await f.withdrawal('2026-08', { earningsWalletId: ownReaderWallet._id });
  const list = await authorPayouts(f.author.account._id, query(), now);
  expect(list.items.map((item) => item.id)).toEqual([String(withdrawal._id)]);
  expect(await authorPayouts(other.account._id, query(), now)).toEqual({
    items: [],
    nextCursor: null,
  });
  expect(await Wallet.countDocuments({ ownerId: other.account._id })).toBe(0);
});
it('paginates tied timestamps, filters months and rejects invalid or mismatched cursors', async () => {
  const f = await fixture();
  const withdrawals = [];
  for (const period of ['2026-08', '2026-09', '2026-10'])
    withdrawals.push(await f.withdrawal(period));
  const first = await authorPayouts(f.author.account._id, query({ limit: 1 }), now);
  const second = await authorPayouts(
    f.author.account._id,
    query({ limit: 1, cursor: first.nextCursor }),
    now,
  );
  const third = await authorPayouts(
    f.author.account._id,
    query({ limit: 1, cursor: second.nextCursor }),
    now,
  );
  expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual(
    withdrawals.reverse().map((item) => String(item._id)),
  );
  expect(third.nextCursor).toBeNull();
  expect(
    (await authorPayouts(f.author.account._id, query({ period: '2026-09' }), now)).items,
  ).toMatchObject([{ period: '2026-09', state: 'pending' }]);
  await expect(
    authorPayouts(
      f.author.account._id,
      query({ period: '2026-09', cursor: first.nextCursor }),
      now,
    ),
  ).rejects.toMatchObject({ status: 400 });
  for (const invalid of [
    'period=2026-13',
    'limit=51',
    'limit=0',
    'cursor=bad',
    'ownerId=forged',
    `walletId=${f.wallet._id}`,
  ])
    expect(
      (await request(app).get(`/api/author/payouts?${invalid}`).set('Cookie', f.author.cookie))
        .status,
    ).toBe(400);
});
