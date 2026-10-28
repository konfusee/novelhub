import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Wallet, LedgerEntry } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const app = createApp(testConfig())
const makeEntry = (wallet, direction, amount, occurredAt) => ({
  walletId: wallet._id,
  ledgerType: 'adjustment',
  direction,
  amount,
  reason: 'Giao dịch thử trong database test',
  actorAccountId: wallet.ownerId,
  sourceType: 'test-fixture',
  sourceId: wallet._id,
  idempotencyScope: {
    operation: 'wallet-history-test',
    ownerId: wallet.ownerId,
    key: crypto.randomUUID(),
  },
  occurredAt,
})

it('trả lịch sử đúng ví, mới nhất trước và đúng dấu số xu', async () => {
  const reader = await authenticatedAccount()
  const otherReader = await authenticatedAccount()

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: 300,
  })

  const otherWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: otherReader.account._id,
    purpose: 'reader-coins',
    availableBalance: 999,
  })

  await LedgerEntry.create([
    makeEntry(wallet, 'credit', 500, new Date('2026-10-20T01:00:00Z')),
    makeEntry(wallet, 'debit', 200, new Date('2026-10-20T02:00:00Z')),
    makeEntry(otherWallet, 'credit', 999, new Date('2026-10-20T03:00:00Z')),
  ])

  const response = await request(app).get('/api/reader/wallet').set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body.entries.map(entry => entry.amount)).toEqual([-200, 500])
  expect(response.body.hasMore).toBe(false)
})

it('chỉ trả 50 giao dịch gần nhất và báo còn dữ liệu', async () => {
  const reader = await authenticatedAccount()

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: 51,
  })

  await LedgerEntry.create(
    Array.from({ length: 51 }, (_, index) =>
      makeEntry(wallet, 'credit', 1, new Date(Date.UTC(2026, 9, 20, 0, index))),
    ),
  )

  const response = await request(app).get('/api/reader/wallet').set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body.entries).toHaveLength(50)
  expect(response.body.hasMore).toBe(true)
})

it('không cho khách xem ví', async () => {
  const response = await request(app).get('/api/reader/wallet')

  expect(response.status).toBe(401)
})

it('chưa có ví thì trả 0 và không tự tạo ví', async () => {
  const reader = await authenticatedAccount()

  const response = await request(app).get('/api/reader/wallet').set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toEqual({
    balance: 0,
    entries: [],
    hasMore: false,
  })

  expect(await Wallet.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('chỉ trả ví đọc truyện của người đang đăng nhập', async () => {
  const reader = await authenticatedAccount()
  const otherReader = await authenticatedAccount()

  await Wallet.create([
    {
      ownerType: 'account',
      ownerId: reader.account._id,
      purpose: 'reader-coins',
      availableBalance: 1200,
    },
    {
      ownerType: 'account',
      ownerId: reader.account._id,
      purpose: 'author-earnings',
      availableBalance: 9000,
    },
    {
      ownerType: 'account',
      ownerId: otherReader.account._id,
      purpose: 'reader-coins',
      availableBalance: 8000,
    },
  ])

  const response = await request(app).get('/api/reader/wallet').set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body.balance).toBe(1200)
})
