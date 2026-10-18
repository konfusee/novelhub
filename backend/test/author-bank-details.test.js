import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  AuditEvent,
  Notification,
  PolicyVersion,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js';
import { evaluateMonthlyAuthorPayout } from '../src/modules/monthly-author-payouts.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
const path = '/api/author/bank-details';
const bank = { bankName: ' Test bank ', accountNumber: '00123456', accountHolder: 'TÁC GIẢ' };
const write = (cookie, body) =>
  request(app).put(path).set('Cookie', cookie).set('Origin', 'http://localhost:5173').send(body);
it('uses saved bank details for monthly payout and preserves the sealed bank snapshot after edits', async () => {
  const author = await authenticatedAccount('author', { createdAt: new Date('2026-08-01') });
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    actorAccountId: author.account._id,
  });
  await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 120000,
  });
  const initial = (await request(app).get(path).set('Cookie', author.cookie)).body;
  expect((await write(author.cookie, { expectedVersion: initial.version, bank })).status).toBe(200);
  const result = await evaluateMonthlyAuthorPayout(
    author.account._id,
    new Date('2026-10-01T00:00:00Z'),
  );
  expect(result.result).toBe('pending-payout');
  const current = (await request(app).get(path).set('Cookie', author.cookie)).body;
  expect(
    (
      await write(author.cookie, {
        expectedVersion: current.version,
        bank: { ...bank, accountNumber: '00999999' },
      })
    ).status,
  ).toBe(200);
  const sealed = await WithdrawalRequest.findById(result.withdrawalId).select(
    '+bankDetailsSnapshot',
  );
  expect(sealed.bankDetailsSnapshot.accountNumber).toBe('00123456');
  expect((await request(app).get(path).set('Cookie', author.cookie)).body.bank.accountNumber).toBe(
    '00999999',
  );
});
it('saves only own bank with version checking, private responses and an audit digest', async () => {
  const author = await authenticatedAccount('author'),
    other = await authenticatedAccount('author');
  const initial = await request(app).get(path).set('Cookie', author.cookie);
  expect(initial.body.bank).toBeNull();
  expect(initial.headers['cache-control']).toContain('no-store');
  const input = { expectedVersion: initial.body.version, bank };
  const saved = await write(author.cookie, input);
  expect(saved.status).toBe(200);
  expect(saved.body.bank).toEqual({ ...bank, bankName: 'Test bank' });
  expect((await write(author.cookie, input)).status).toBe(409);
  expect((await request(app).get(path).set('Cookie', other.cookie)).body.bank).toBeNull();
  const audit = await AuditEvent.findOne({ action: 'author.bank-details.updated' });
  expect(audit.dataDigest).toBeTruthy();
  expect(JSON.stringify(audit)).not.toContain(bank.accountNumber);
  expect(JSON.stringify((await Account.findById(author.account._id)).toJSON())).not.toContain(
    bank.accountNumber,
  );
  expect((await write(author.cookie, { ...input, accountId: other.account._id })).status).toBe(400);
  expect(
    (await write(author.cookie, { ...input, bank: { ...bank, accountHolder: ' ' } })).status,
  ).toBe(400);
});
it('rolls back bank changes when audit fails and denies other roles', async () => {
  const author = await authenticatedAccount('author');
  const initial = (await request(app).get(path).set('Cookie', author.cookie)).body;
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit failure'));
  try {
    expect((await write(author.cookie, { expectedVersion: initial.version, bank })).status).toBe(
      500,
    );
  } finally {
    spy.mockRestore();
  }
  expect((await request(app).get(path).set('Cookie', author.cookie)).body).toEqual(initial);
  expect((await request(app).get(path)).status).toBe(401);
  for (const role of ['reader', 'admin', 'moderator']) {
    const user = await authenticatedAccount(role);
    expect((await request(app).get(path).set('Cookie', user.cookie)).status).toBe(403);
  }
});
it('links financial notifications to the bank form and payout history without exposing email or arbitrary URLs', async () => {
  const author = await authenticatedAccount('author');
  await Notification.create(
    ['withdrawal.bank-required', 'withdrawal.paid'].map((eventType, index) => ({
      recipientAccountId: author.account._id,
      eventType,
      sourceEventKey: `test:${index}`,
      payload: {
        emailRecipient: 'secret@example.test',
        href: 'https://invalid.example/',
        title: 'Chi trả',
      },
    })),
  );
  const response = await request(app).get('/api/reader/notifications').set('Cookie', author.cookie);
  expect(response.body.items.map((row) => row.href).sort()).toEqual([
    '/reader/author-payouts',
    '/reader/author-payouts#payout-bank',
  ]);
  expect(JSON.stringify(response.body)).not.toContain('secret@example.test');
  expect(JSON.stringify(response.body)).not.toContain('invalid.example');
});
