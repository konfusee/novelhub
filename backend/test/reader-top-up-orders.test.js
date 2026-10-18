import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  LedgerEntry,
  PolicyVersion,
  TopUpOrder,
  TopUpPackage,
  Wallet,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
afterEach(() => vi.restoreAllMocks());
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
async function fixture() {
  const owner = await authenticatedAccount('reader');
  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() - 3600000),
    actorAccountId: owner.account._id,
    orderExpiryHours: 3,
  });
  const pack = await TopUpPackage.create({ priceVnd: 20000, coinAmount: 20000 });
  const create = () =>
    request(app)
      .post('/api/reader/top-up-orders')
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ packageId: String(pack._id) });
  return { owner, policy, pack, create };
}
it('snapshots the effective policy and fixed package, reuses concurrent invoices without crediting coins', async () => {
  const f = await fixture();
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(Date.now() + 3600000),
    actorAccountId: f.owner.account._id,
    orderExpiryHours: 12,
  });
  const responses = await Promise.all([f.create(), f.create()]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  expect(responses[0].body.order.id).toBe(responses[1].body.order.id);
  const order = await TopUpOrder.findById(responses[0].body.order.id).lean();
  expect(order.paymentCode).toMatch(/^NH\d{8}$/);
  expect(order.packageSnapshot.policy.id).toBe(String(f.policy._id));
  expect(order.packageSnapshot.policy.orderExpiryHours).toBe(3);
  expect(Math.abs(order.expiresAt - order.createdAt - 3 * 3600000)).toBeLessThan(2000);
  expect((await Wallet.findById(order.walletId)).availableBalance).toBe(0);
  expect(await LedgerEntry.countDocuments({})).toBe(0);
  expect(await AuditEvent.countDocuments({ action: 'topup.order.created' })).toBe(1);
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $set: { orderExpiryHours: 7 } });
  expect((await f.create()).body.order.id).toBe(String(order._id));
  expect((await TopUpOrder.findById(order._id)).expiresAt).toEqual(order.expiresAt);
});
it('expires old invoices and applies the new policy only to a new invoice', async () => {
  const f = await fixture();
  const first = await f.create();
  await TopUpOrder.updateOne(
    { _id: first.body.order.id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  const read = await request(app)
    .get('/api/reader/top-up-orders/' + first.body.order.id)
    .set('Cookie', f.owner.cookie);
  expect(read.body.order.status).toBe('expired');
  await PolicyVersion.updateOne({ _id: f.policy._id }, { $set: { orderExpiryHours: 7 } });
  const second = await f.create();
  expect(second.status).toBe(201);
  expect(second.body.order.id).not.toBe(first.body.order.id);
  expect((await TopUpOrder.findById(first.body.order.id)).status).toBe('expired');
  expect(
    (await TopUpOrder.findById(second.body.order.id)).packageSnapshot.policy.orderExpiryHours,
  ).toBe(7);
});
it('rejects cross-account reads, unavailable packages, inactive accounts and missing effective policy', async () => {
  const f = await fixture();
  const created = await f.create();
  const other = await authenticatedAccount('reader');
  expect(
    (
      await request(app)
        .get('/api/reader/top-up-orders/' + created.body.order.id)
        .set('Cookie', other.cookie)
    ).status,
  ).toBe(404);
  await TopUpPackage.updateOne({ _id: f.pack._id }, { $set: { status: 'inactive' } });
  expect((await f.create()).status).toBe(409);
  await TopUpPackage.updateOne({ _id: f.pack._id }, { $set: { status: 'active' } });
  await PolicyVersion.updateMany({}, { $set: { status: 'draft' } });
  expect((await f.create()).status).toBe(409);
  await Account.updateOne({ _id: f.owner.account._id }, { $set: { status: 'suspended' } });
  expect([401, 403]).toContain((await f.create()).status);
});
it('rolls back the invoice and wallet creation if audit cannot persist', async () => {
  const f = await fixture();
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await f.create()).status).toBe(500);
  expect(await TopUpOrder.countDocuments({})).toBe(0);
  expect(await Wallet.countDocuments({ ownerId: f.owner.account._id })).toBe(0);
});
