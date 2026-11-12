import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, AuditEvent, BankTransaction, LedgerEntry, Wallet } from '../src/models/index.js'
import { resolveBankTransaction } from '../src/modules/coins-payouts/finance/admin-transactions.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ corsOrigin: origin }))
async function prepare(status = 'amount-mismatch') {
  const admin = await authenticatedAccount('admin')
  const reader = await authenticatedAccount('reader')
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: 100,
  })
  const bank = await BankTransaction.create({
    sePayTransactionId: crypto.randomUUID(),
    amountVnd: 50000,
    content: 'Chuyen tien NH12345678',
    matchStatus: status,
    receivedAt: new Date(),
    apiKeyAuthenticated: true,
  })
  return {
    admin,
    reader,
    wallet,
    bank,
    body: { walletId: String(wallet._id), reason: 'Verified sender and receipt with support' },
  }
}

it('requires admin for lists, statistics and resolution, including stale authorization', async () => {
  const { reader, admin, bank, body } = await prepare()
  for (const path of [
    '/api/admin/transactions',
    '/api/admin/transactions/statistics',
    '/api/admin/transactions/reader-wallets?search=test',
  ]) {
    expect((await request(app).get(path)).status).toBe(401)
    expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403)
    expect((await request(app).get(path).set('Cookie', admin.cookie)).status).toBe(200)
  }
  await Account.updateOne({ _id: admin.account._id }, { $inc: { authorizationEpoch: 1 } })
  await expect(resolveBankTransaction(admin.account, bank._id, body)).rejects.toMatchObject({
    status: 403,
  })
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('concurrent resolution credits exactly once and preserves original evidence', async () => {
  const { admin, bank, wallet, body } = await prepare()
  const responses = await Promise.all([
    resolveBankTransaction(admin.account, bank._id, body),
    resolveBankTransaction(admin.account, bank._id, body),
  ])
  expect(responses.filter(result => !result.reused)).toHaveLength(1)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(50100)
  expect(await LedgerEntry.countDocuments({ sourceId: bank._id })).toBe(1)
  expect(await AuditEvent.countDocuments({ targetId: bank._id })).toBe(1)
  expect(await BankTransaction.findById(bank._id)).toMatchObject({
    matchStatus: 'resolved',
    originalMatchStatus: 'amount-mismatch',
    amountVnd: 50000,
    content: bank.content,
  })
  await expect(
    resolveBankTransaction(admin.account, bank._id, { ...body, reason: 'Different reason' }),
  ).rejects.toMatchObject({ status: 409 })
})

it('allows closing without credit, forbids resolving matched receipts', async () => {
  const { admin, bank, wallet } = await prepare()
  const input = { reason: 'Sender requested refund handled outside the application' }
  await resolveBankTransaction(admin.account, bank._id, input)
  expect((await resolveBankTransaction(admin.account, bank._id, input)).reused).toBe(true)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(100)
  expect(await LedgerEntry.countDocuments()).toBe(0)
  const matched = await BankTransaction.create({
    sePayTransactionId: 'matched',
    amountVnd: 10,
    matchStatus: 'matched',
    receivedAt: new Date(),
    apiKeyAuthenticated: true,
  })
  await expect(resolveBankTransaction(admin.account, matched._id, input)).rejects.toMatchObject({
    status: 409,
  })
})

it('rejects wrong wallet and rolls all financial mutations back if audit fails', async () => {
  const { admin, bank, body, wallet } = await prepare()
  const earnings = await Wallet.create({
    ownerType: 'account',
    ownerId: wallet.ownerId,
    purpose: 'author-earnings',
    availableBalance: 0,
  })
  await expect(
    resolveBankTransaction(admin.account, bank._id, { ...body, walletId: String(earnings._id) }),
  ).rejects.toMatchObject({ status: 409 })
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit unavailable'))
  try {
    await expect(resolveBankTransaction(admin.account, bank._id, body)).rejects.toThrow(
      'audit unavailable',
    )
  } finally {
    spy.mockRestore()
  }
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(100)
  expect((await BankTransaction.findById(bank._id)).matchStatus).toBe('amount-mismatch')
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('API validates filters and resolution, returns filtered evidence and real statistics', async () => {
  const { admin, bank, body } = await prepare()
  expect(
    (
      await request(app)
        .get('/api/admin/transactions?source=bank&status=amount-mismatch&search=NH12345678')
        .set('Cookie', admin.cookie)
    ).body.items,
  ).toHaveLength(1)
  const stats = await request(app)
    .get('/api/admin/transactions/statistics')
    .set('Cookie', admin.cookie)
  expect(stats.body).toMatchObject({
    registeredAccounts: 2,
    purchasedChapters: 0,
    unlockCoins: 0,
    unresolvedPayments: 1,
  })
  expect(
    (await request(app).get('/api/admin/transactions?page=0').set('Cookie', admin.cookie)).status,
  ).toBe(400)
  const resolve = data =>
    request(app)
      .post(`/api/admin/transactions/${bank._id}/resolve`)
      .set('Cookie', admin.cookie)
      .set('Origin', origin)
      .send(data)
  expect((await resolve({ ...body, amount: 999999 })).status).toBe(400)
  expect((await resolve({ ...body, reason: '' })).status).toBe(400)
  expect((await resolve(body)).status).toBe(200)
})
