import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { Account, AuditEvent, BankTransaction, LedgerEntry, Wallet } from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const app = createApp(testConfig());
async function fixture(status = 'amount-mismatch') {
  const admin = await authenticatedAccount('admin');
  const reader = await authenticatedAccount('reader');
  const receipt = await BankTransaction.create({
    sePayTransactionId: 'receipt-1',
    amountVnd: 10000,
    content: 'Bank original',
    matchStatus: status,
    receivedAt: new Date(),
    apiKeyAuthenticated: true,
  });
  const input = {
    expectedVersion: receipt.version,
    accountId: String(reader.account._id),
    reason: 'Đã đối chiếu người chuyển và người nhận',
    confirmedRecipient: true,
  };
  const resolve = (body = input, cookie = admin.cookie) =>
    request(app)
      .post(`/api/admin/bank-receipts/${receipt._id}/resolve`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5173')
      .send(body);
  return { admin, reader, receipt, input, resolve };
}
it('credits exact receipt value once with an append-only adjustment, retaining original receipt evidence', async () => {
  const f = await fixture();
  const responses = await Promise.all([f.resolve(), f.resolve()]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(responses[0].body.adjustmentId).toBe(responses[1].body.adjustmentId);
  const receipt = await BankTransaction.findById(f.receipt._id);
  expect(receipt.matchStatus).toBe('resolved');
  expect(receipt.originalMatchStatus).toBe('amount-mismatch');
  expect(receipt.content).toBe('Bank original');
  expect(receipt.amountVnd).toBe(10000);
  expect(String(receipt.resolvedBy)).toBe(String(f.admin.account._id));
  const wallet = await Wallet.findOne({ ownerId: f.reader.account._id });
  expect(wallet.availableBalance).toBe(10000);
  expect(wallet.purpose).toBe('reader-coins');
  const ledger = await LedgerEntry.findOne({});
  expect(ledger.ledgerType).toBe('adjustment');
  expect(ledger.amount).toBe(10000);
  expect(ledger.reason).toBe(f.input.reason);
  expect(await LedgerEntry.countDocuments({})).toBe(1);
  expect(await AuditEvent.countDocuments({ action: 'topup.receipt.resolved' })).toBe(1);
  expect((await f.resolve({ ...f.input, reason: 'Changed reason' })).status).toBe(409);
});
it('allows only one of two competing recipients to receive a receipt', async () => {
  const f = await fixture('already-paid');
  const other = await authenticatedAccount('reader');
  const responses = await Promise.all([
    f.resolve(),
    f.resolve({ ...f.input, accountId: String(other.account._id) }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await LedgerEntry.countDocuments({})).toBe(1);
  expect((await Wallet.find({}).lean()).reduce((sum, w) => sum + w.availableBalance, 0)).toBe(
    10000,
  );
});
it('rejects stale versions, inactive recipients, already matched receipts and unauthenticated evidence', async () => {
  const f = await fixture();
  expect((await f.resolve({ ...f.input, expectedVersion: 10 })).status).toBe(409);
  await Account.updateOne({ _id: f.reader.account._id }, { $set: { status: 'suspended' } });
  expect((await f.resolve()).status).toBe(409);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  await Account.updateOne({ _id: f.reader.account._id }, { $set: { status: 'active' } });
  await BankTransaction.updateOne({ _id: f.receipt._id }, { $set: { matchStatus: 'matched' } });
  expect((await f.resolve()).status).toBe(409);
  expect(await Wallet.countDocuments({})).toBe(0);
});
it('rolls back adjustment, receipt and balance on audit failure', async () => {
  const f = await fixture('expired');
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await f.resolve()).status).toBe(500);
  spy.mockRestore();
  expect((await BankTransaction.findById(f.receipt._id)).matchStatus).toBe('expired');
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect(await Wallet.countDocuments({})).toBe(0);
  expect((await f.resolve()).status).toBe(200);
});
it('does not credit an unauthenticated legacy receipt', async () => {
  const f = await fixture();
  const receipt = await BankTransaction.create({
    sePayTransactionId: 'legacy',
    amountVnd: 5000,
    matchStatus: 'unmatched',
    receivedAt: new Date(),
    apiKeyAuthenticated: false,
  });
  const result = await request(app)
    .post(`/api/admin/bank-receipts/${receipt._id}/resolve`)
    .set('Cookie', f.admin.cookie)
    .set('Origin', 'http://localhost:5173')
    .send({ ...f.input, expectedVersion: receipt.version });
  expect(result.status).toBe(409);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
});
it('restricts list and writes to Admin, requires origin, reason and explicit recipient confirmation', async () => {
  const f = await fixture();
  expect((await request(app).get('/api/admin/bank-receipts')).status).toBe(401);
  expect(
    (await request(app).get('/api/admin/bank-receipts').set('Cookie', f.reader.cookie)).status,
  ).toBe(403);
  expect((await f.resolve(f.input, f.reader.cookie)).status).toBe(403);
  expect((await f.resolve({ ...f.input, reason: ' ' })).status).toBe(400);
  expect((await f.resolve({ ...f.input, confirmedRecipient: false })).status).toBe(400);
  expect((await f.resolve({ ...f.input, amount: 50000 })).status).toBe(400);
  expect(
    (
      await request(app)
        .post(`/api/admin/bank-receipts/${f.receipt._id}/resolve`)
        .set('Cookie', f.admin.cookie)
        .send(f.input)
    ).status,
  ).toBe(403);
  const read = () => request(app).get('/api/admin/bank-receipts').set('Cookie', f.admin.cookie);
  const result = await read();
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(result.body.items[0].originalStatus).toBe('amount-mismatch');
  await f.resolve();
  expect((await read()).body.items).toEqual([]);
  const history = await request(app)
    .get('/api/admin/bank-receipts?status=resolved')
    .set('Cookie', f.admin.cookie);
  expect(history.body.items[0].canResolve).toBe(false);
  expect(history.body.items[0].adjustmentId).toBeTruthy();
});
