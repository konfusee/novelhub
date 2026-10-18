import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  BankTransaction,
  LedgerEntry,
  PolicyVersion,
  TopUpOrder,
  TopUpPackage,
  Wallet,
} from '../src/models/index.js';
import { createTopUpOrder } from '../src/modules/reader-top-up-orders.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig, testEnv } from './config.js';
import { loadEnv, toAppConfig } from '../src/config/env.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const sepay = { apiKey: 'test-bank-secret-'.repeat(3), accountNumber: '1234567890' };
const app = createApp(testConfig({ sepay }));
const send = (body, auth = `Apikey ${sepay.apiKey}`) =>
  request(app).post('/api/webhooks/sepay').set('Authorization', auth).send(body);
async function fixture() {
  const owner = await authenticatedAccount('reader');
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() - 1000),
    actorAccountId: owner.account._id,
    orderExpiryHours: 2,
  });
  const pack = await TopUpPackage.create({ priceVnd: 20000, coinAmount: 20000 });
  const { order } = await createTopUpOrder(owner.account, pack._id);
  const body = {
    id: 12345,
    accountNumber: sepay.accountNumber,
    transferType: 'in',
    transferAmount: 20000,
    content: `Nap xu ${order.paymentCode}`,
  };
  return { owner, order, body };
}
it('credits a verified receipt exactly once across concurrent replays, using the invoice snapshot', async () => {
  const f = await fixture();
  await TopUpPackage.updateMany({}, { $set: { status: 'inactive' } });
  const responses = await Promise.all([send(f.body), send(f.body)]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(responses[0].body).toEqual({ success: true });
  const paid = await TopUpOrder.findById(f.order.id);
  expect(paid.status).toBe('paid');
  expect(paid.paidAmountVnd).toBe(20000);
  expect((await Wallet.findById(paid.walletId)).availableBalance).toBe(20000);
  expect(await LedgerEntry.countDocuments({ ledgerType: 'topup-credit' })).toBe(1);
  expect(await BankTransaction.countDocuments({})).toBe(1);
  expect(await AuditEvent.countDocuments({ action: 'topup.receipt.recorded' })).toBe(1);
  expect((await send({ ...f.body, transferAmount: 30000 })).status).toBe(409);
  expect((await send({ ...f.body, id: 12346 })).status).toBe(200);
  expect((await BankTransaction.findOne({ sePayTransactionId: '12346' })).matchStatus).toBe(
    'already-paid',
  );
  expect((await Wallet.findById(paid.walletId)).availableBalance).toBe(20000);
});
it('stores amount mismatches and ambiguous or missing codes without crediting a wallet', async () => {
  const f = await fixture();
  expect((await send({ ...f.body, transferAmount: 10000 })).status).toBe(200);
  expect((await BankTransaction.findOne({ sePayTransactionId: '12345' })).matchStatus).toBe(
    'amount-mismatch',
  );
  for (const [id, content] of [
    [2, 'No payment code'],
    [3, `${f.order.paymentCode} NH00000000`],
    [4, `X${f.order.paymentCode}X`],
  ]) {
    expect((await send({ ...f.body, id, content })).status).toBe(200);
    expect((await BankTransaction.findOne({ sePayTransactionId: String(id) })).matchStatus).toBe(
      'unmatched',
    );
  }
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect((await TopUpOrder.findById(f.order.id)).status).toBe('pending');
  expect((await send({ ...f.body, id: 5 })).status).toBe(200);
  expect(await LedgerEntry.countDocuments({})).toBe(1);
});
it('serializes distinct receipts racing to pay one invoice', async () => {
  const f = await fixture();
  const responses = await Promise.all([send(f.body), send({ ...f.body, id: 12346 })]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect((await BankTransaction.find({}).lean()).map((r) => r.matchStatus).sort()).toEqual([
    'already-paid',
    'matched',
  ]);
  expect(await LedgerEntry.countDocuments({})).toBe(1);
  const order = await TopUpOrder.findById(f.order.id);
  expect((await Wallet.findById(order.walletId)).availableBalance).toBe(20000);
});
it('retains expired and inactive account receipts for review without applying credit', async () => {
  const f = await fixture();
  await Account.updateOne({ _id: f.owner.account._id }, { $set: { status: 'suspended' } });
  expect((await send(f.body)).status).toBe(200);
  expect((await BankTransaction.findOne({})).matchStatus).toBe('unmatched');
  await Account.updateOne({ _id: f.owner.account._id }, { $set: { status: 'active' } });
  await TopUpOrder.updateOne(
    { _id: f.order.id },
    { $set: { expiresAt: new Date(Date.now() - 1) } },
  );
  expect((await send({ ...f.body, id: 2 })).status).toBe(200);
  expect((await BankTransaction.findOne({ sePayTransactionId: '2' })).matchStatus).toBe('expired');
  expect((await TopUpOrder.findById(f.order.id)).status).toBe('expired');
  expect(await LedgerEntry.countDocuments({})).toBe(0);
});
it('rolls back the receipt, paid status and wallet if audit fails, allowing a clean retry', async () => {
  const f = await fixture();
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await send(f.body)).status).toBe(500);
  spy.mockRestore();
  const order = await TopUpOrder.findById(f.order.id);
  expect(order.status).toBe('pending');
  expect((await Wallet.findById(order.walletId)).availableBalance).toBe(0);
  expect(await BankTransaction.countDocuments({})).toBe(0);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect((await send(f.body)).status).toBe(200);
});
it('rejects unauthenticated, malformed and wrong-account receipts; outgoing transfers never credit', async () => {
  const f = await fixture();
  expect((await send(f.body, 'Apikey wrong')).status).toBe(401);
  expect((await send(f.body, `Bearer ${sepay.apiKey}`)).status).toBe(401);
  expect((await send({ ...f.body, accountNumber: '987654321' })).status).toBe(400);
  for (const transferAmount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    expect((await send({ ...f.body, transferAmount })).status).toBe(400);
  expect((await send({ ...f.body, transferType: 'out' })).status).toBe(200);
  expect(await BankTransaction.countDocuments({})).toBe(0);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect(
    (await request(createApp(testConfig())).post('/api/webhooks/sepay').send(f.body)).status,
  ).toBe(503);
});
it('fails fast for incomplete payment configuration and maps configured credentials', () => {
  expect(() => loadEnv({ ...testEnv, SEPAY_WEBHOOK_API_KEY: sepay.apiKey })).toThrow(/SePay/);
  expect(() =>
    loadEnv({
      ...testEnv,
      SEPAY_WEBHOOK_API_KEY: 'short',
      SEPAY_ACCOUNT_NUMBER: sepay.accountNumber,
    }),
  ).toThrow();
  expect(
    toAppConfig(
      loadEnv({
        ...testEnv,
        SEPAY_WEBHOOK_API_KEY: sepay.apiKey,
        SEPAY_ACCOUNT_NUMBER: sepay.accountNumber,
      }),
    ).sepay,
  ).toEqual(sepay);
});
