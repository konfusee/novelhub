import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { LedgerEntry, Wallet } from '../src/models/index.js';
import { authorTransactions, authorTransactionQuery } from '../src/modules/author-transactions.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const now = new Date('2026-10-16T12:00:00Z');
const input = (extra = {}) => authorTransactionQuery.parse(extra);
async function fixture() {
  const author = await authenticatedAccount('author');
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 200,
  });
  async function entry(key, date = '2026-10-16T01:00:00Z', fields = {}) {
    return LedgerEntry.create({
      walletId: wallet._id,
      ledgerType: 'allocation-credit',
      direction: 'credit',
      amount: 100,
      occurredAt: new Date(date),
      sourceType: 'RevenueAllocation',
      sourceId: wallet._id,
      idempotencyScope: { operation: 'allocation', ownerId: author.account._id, key },
      ...fields,
    });
  }
  return { author, wallet, entry };
}
it('reads only the account author wallet and exposes a limited DTO without changing ledger or balances', async () => {
  const f = await fixture();
  const other = await authenticatedAccount('author');
  const readerWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: f.author.account._id,
    purpose: 'reader-coins',
  });
  const otherWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: other.account._id,
    purpose: 'author-earnings',
  });
  const own = await f.entry('own');
  await f.entry('reader', undefined, { walletId: readerWallet._id });
  await f.entry('other', undefined, { walletId: otherWallet._id });
  const before = await LedgerEntry.find().sort({ _id: 1 }).lean();
  const result = await authorTransactions(f.author.account._id, input(), now);
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toEqual({
    id: String(own._id),
    type: 'allocation-credit',
    direction: 'credit',
    amount: 100,
    unit: 'coin',
    occurredAt: own.occurredAt,
  });
  expect(await LedgerEntry.find().sort({ _id: 1 }).lean()).toEqual(before);
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(200);
});
it('paginates identical timestamps without duplicates and excludes newly inserted earlier-page entries', async () => {
  const f = await fixture();
  const entries = [];
  for (let index = 0; index < 5; index++) entries.push(await f.entry(String(index)));
  const first = await authorTransactions(f.author.account._id, input({ limit: 2 }), now);
  expect(first.items.map((item) => item.id)).toEqual(
    entries
      .slice(3)
      .reverse()
      .map((item) => String(item._id)),
  );
  await f.entry('new', now.toISOString());
  const second = await authorTransactions(
    f.author.account._id,
    input({ limit: 2, cursor: first.nextCursor }),
    now,
  );
  const third = await authorTransactions(
    f.author.account._id,
    input({ limit: 2, cursor: second.nextCursor }),
    now,
  );
  const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
  expect(ids).toEqual([...entries].reverse().map((item) => String(item._id)));
  expect(new Set(ids).size).toBe(5);
  expect(third.nextCursor).toBeNull();
});
it('uses Vietnam calendar boundaries, excludes future records and filters both directions including zero', async () => {
  const f = await fixture();
  await f.entry('today', '2026-10-15T17:00:00Z');
  await f.entry('yesterday', '2026-10-15T16:59:59.999Z');
  await f.entry('monday', '2026-10-11T17:00:00Z');
  await f.entry('month', '2026-09-30T17:00:00Z');
  await f.entry('old', '2026-09-30T16:59:59.999Z');
  await f.entry('future', '2026-10-16T12:00:00.001Z');
  await f.entry('debit', undefined, {
    ledgerType: 'withdrawal-debit',
    direction: 'debit',
    amount: 0,
  });
  expect(
    (await authorTransactions(f.author.account._id, input({ period: 'day' }), now)).items,
  ).toHaveLength(2);
  expect(
    (await authorTransactions(f.author.account._id, input({ period: 'week' }), now)).items,
  ).toHaveLength(4);
  expect((await authorTransactions(f.author.account._id, input(), now)).items).toHaveLength(5);
  expect(
    (await authorTransactions(f.author.account._id, input({ direction: 'credit' }), now)).items,
  ).toHaveLength(4);
  expect(
    (await authorTransactions(f.author.account._id, input({ direction: 'debit' }), now)).items,
  ).toMatchObject([{ direction: 'debit', amount: 0 }]);
});
it('checks authentication, role and strict pagination filters at the route boundary', async () => {
  const f = await fixture();
  const reader = await authenticatedAccount();
  expect((await request(app).get('/api/author/transactions')).status).toBe(401);
  expect(
    (await request(app).get('/api/author/transactions').set('Cookie', reader.cookie)).status,
  ).toBe(403);
  for (const query of [
    'period=year',
    'direction=out',
    'limit=0',
    'limit=51',
    'limit=1.5',
    'cursor=invalid',
    'ownerId=forged',
    `walletId=${f.wallet._id}`,
  ])
    expect(
      (await request(app).get(`/api/author/transactions?${query}`).set('Cookie', f.author.cookie))
        .status,
    ).toBe(400);
  expect(
    (await request(app).get('/api/author/transactions').set('Cookie', f.author.cookie)).body,
  ).toEqual({ items: [], nextCursor: null });
});
it('rejects malformed or mismatched cursors and returns empty without creating a wallet', async () => {
  const f = await fixture();
  await f.entry('one');
  await f.entry('two');
  const first = await authorTransactions(f.author.account._id, input({ limit: 1 }), now);
  await expect(
    authorTransactions(
      f.author.account._id,
      input({ direction: 'debit', cursor: first.nextCursor }),
      now,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    authorTransactions(
      f.author.account._id,
      input({ period: 'day', cursor: first.nextCursor }),
      now,
    ),
  ).rejects.toMatchObject({ status: 400 });
  const malformed = Buffer.from(
    JSON.stringify({ date: 'invalid', id: 'x', period: 'month', direction: 'all' }),
  ).toString('base64url');
  await expect(
    authorTransactions(f.author.account._id, input({ cursor: malformed }), now),
  ).rejects.toMatchObject({ status: 400 });
  const other = await authenticatedAccount('author');
  expect(await authorTransactions(other.account._id, input(), now)).toEqual({
    items: [],
    nextCursor: null,
  });
  expect(await Wallet.countDocuments({ ownerId: other.account._id })).toBe(0);
});
