import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Wallet, LedgerEntry } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const app = createApp(testConfig())
const endpoint = '/api/author/earnings'

function makeEntry(wallet, direction, amount, occurredAt) {
  return {
    walletId: wallet._id,
    ledgerType: 'adjustment',
    direction,
    amount,
    reason: 'Dữ liệu kiểm thử thu nhập tác giả',
    actorAccountId: wallet.ownerId,
    sourceType: 'test-fixture',
    sourceId: wallet._id,
    idempotencyScope: {
      operation: 'author-earnings-test',
      ownerId: wallet.ownerId,
      key: crypto.randomUUID(),
    },
    occurredAt,
  }
}

it('khách chưa đăng nhập không được xem thu nhập', async () => {
  const response = await request(app).get(endpoint)

  expect(response.status).toBe(401)
})

it('reader không có quyền author bị từ chối', async () => {
  const reader = await authenticatedAccount()

  const response = await request(app).get(endpoint).set('Cookie', reader.cookie)

  expect(response.status).toBe(403)
})

it('tác giả chưa có ví nhận kết quả rỗng, không phát sinh dữ liệu', async () => {
  const author = await authenticatedAccount('author')

  const response = await request(app).get(endpoint).set('Cookie', author.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toEqual({
    balance: 0,
    entries: [],
    hasMore: false,
  })

  expect(await Wallet.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('chỉ trả ví thu nhập của chính tác giả, đúng thứ tự và dấu số xu', async () => {
  const author = await authenticatedAccount('author')
  const otherAuthor = await authenticatedAccount('author')

  const earningsWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 680,
  })

  const readerWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'reader-coins',
    availableBalance: 3000,
  })

  const otherWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: otherAuthor.account._id,
    purpose: 'author-earnings',
    availableBalance: 9000,
  })

  await LedgerEntry.create([
    makeEntry(earningsWallet, 'credit', 700, new Date('2026-11-01T01:00:00Z')),
    makeEntry(earningsWallet, 'debit', 20, new Date('2026-11-01T02:00:00Z')),
    makeEntry(readerWallet, 'credit', 3000, new Date('2026-11-01T03:00:00Z')),
    makeEntry(otherWallet, 'credit', 9000, new Date('2026-11-01T04:00:00Z')),
  ])

  const response = await request(app).get(endpoint).set('Cookie', author.cookie)

  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.body.balance).toBe(680)
  expect(response.body.entries.map(entry => entry.amount)).toEqual([-20, 700])
  expect(response.body.hasMore).toBe(false)
})
