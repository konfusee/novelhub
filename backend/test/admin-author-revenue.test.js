import request from 'supertest'
import { Types } from 'mongoose'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, LedgerEntry, Wallet } from '../src/models/index.js'
import { getAdminAuthorRevenue } from '../src/modules/admin-author-revenue.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const app = createApp(testConfig())
const endpoint = '/api/admin/author-revenue'
const periodId = '2026-11'

async function prepareAuthor() {
  const { account } = await authenticatedAccount('author')

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: 0,
  })

  return { account, wallet }
}

// Dữ liệu riêng cho test báo cáo.
// Mỗi dòng lịch sử được cộng tương ứng vào ví.
async function addEntry(
  wallet,
  {
    amount,
    ledgerType = 'allocation-credit',
    occurredAt = new Date('2026-11-15T10:00:00+07:00'),
    actorAccountId,
  },
) {
  const sourceId = new Types.ObjectId()

  await LedgerEntry.create({
    walletId: wallet._id,
    ledgerType,
    direction: 'credit',
    amount,
    sourceType: ledgerType === 'allocation-credit' ? 'UnlockRequest' : 'test-fixture',
    sourceId,
    actorAccountId,
    ...(ledgerType === 'adjustment'
      ? { reason: 'Dữ liệu điều chỉnh trong database kiểm thử' }
      : {}),
    idempotencyScope: {
      operation: 'test-revenue',
      ownerId: wallet.ownerId,
      key: String(sourceId),
    },
    occurredAt,
  })

  await Wallet.updateOne(
    { _id: wallet._id },
    {
      $inc: {
        availableBalance: amount,
        balanceVersion: 1,
        version: 1,
      },
    },
  )
}

it('chỉ tính doanh thu tác giả, không tính xu điều chỉnh hoặc phần platform', async () => {
  const admin = await authenticatedAccount('admin')
  const first = await prepareAuthor()
  const second = await prepareAuthor()
  const zero = await authenticatedAccount('author')

  await addEntry(first.wallet, { amount: 200000 })
  await addEntry(first.wallet, {
    amount: 2000000,
    ledgerType: 'adjustment',
    actorAccountId: admin.account._id,
  })

  await addEntry(second.wallet, { amount: 50000 })

  const platformWallet = await Wallet.create({
    ownerType: 'system',
    ownerId: new Types.ObjectId(),
    purpose: 'system-earnings',
    availableBalance: 0,
  })

  await addEntry(platformWallet, { amount: 900000 })

  const result = await getAdminAuthorRevenue({ periodId })

  expect(result.summary).toEqual({
    totalAuthors: 3,
    earningAuthors: 2,
    totalRevenueCoins: 250000,
  })

  expect(result.items[0]).toMatchObject({
    accountId: String(first.account._id),
    monthlyRevenueCoins: 200000,
    balanceCoins: 2200000,
    earningEvents: 1,
  })

  expect(result.items.find(item => item.accountId === String(zero.account._id))).toMatchObject({
    monthlyRevenueCoins: 0,
    balanceCoins: 0,
  })

  expect(result.topAuthors.map(item => item.accountId)).toEqual([
    String(first.account._id),
    String(second.account._id),
  ])
})

it('tính đúng đầu và cuối tháng theo giờ Việt Nam', async () => {
  const { wallet } = await prepareAuthor()

  const entries = [
    // 23:59:59.999 ngày 31/10 tại Việt Nam: loại.
    [1, '2026-10-31T16:59:59.999Z'],

    // 00:00 ngày 01/11 tại Việt Nam: tính.
    [2, '2026-10-31T17:00:00.000Z'],

    // 23:59:59.999 ngày 30/11 tại Việt Nam: tính.
    [4, '2026-11-30T16:59:59.999Z'],

    // 00:00 ngày 01/12 tại Việt Nam: loại.
    [8, '2026-11-30T17:00:00.000Z'],
  ]

  for (const [amount, date] of entries) {
    await addEntry(wallet, {
      amount,
      occurredAt: new Date(date),
    })
  }

  const result = await getAdminAuthorRevenue({ periodId })

  expect(result.summary.totalRevenueCoins).toBe(6)
  expect(result.items[0].earningEvents).toBe(2)
  expect(result.items[0].balanceCoins).toBe(15)
})

it('phân trang không làm thay đổi tổng và top 5', async () => {
  for (let amount = 1; amount <= 21; amount++) {
    const { wallet } = await prepareAuthor()
    await addEntry(wallet, { amount })
  }

  const first = await getAdminAuthorRevenue({
    periodId,
    page: 1,
  })

  const second = await getAdminAuthorRevenue({
    periodId,
    page: 2,
  })

  const third = await getAdminAuthorRevenue({
    periodId,
    page: 3,
  })

  expect(first.pageSize).toBe(7)
  expect(first.items).toHaveLength(7)
  expect(first.hasMore).toBe(true)

  expect(second.items).toHaveLength(7)
  expect(second.hasMore).toBe(true)

  expect(third.items).toHaveLength(7)
  expect(third.hasMore).toBe(false)

  expect(first.summary).toEqual({
    totalAuthors: 21,
    earningAuthors: 21,
    totalRevenueCoins: 231,
  })

  expect(second.summary).toEqual(first.summary)
  expect(second.topAuthors).toEqual(first.topAuthors)
  expect(third.summary).toEqual(first.summary)
  expect(third.topAuthors).toEqual(first.topAuthors)

  expect(first.topAuthors.map(item => item.monthlyRevenueCoins)).toEqual([21, 20, 19, 18, 17])

  const ids = [...first.items, ...second.items, ...third.items].map(item => item.accountId)

  expect(new Set(ids).size).toBe(21)
  const exported = await getAdminAuthorRevenue({ periodId, page: 3, all: true })
  expect(exported.items).toHaveLength(21)
  expect(exported.hasMore).toBe(false)
}, 15000)

it('tìm không dấu, lọc và sắp xếp trước khi phân trang; tổng và biểu đồ vẫn theo cả kỳ', async () => {
  const first = await prepareAuthor()
  const second = await prepareAuthor()
  const zero = await prepareAuthor()
  await Account.updateOne({ _id: first.account._id }, { $set: { displayName: 'Đặng Ngọc Anh' } })
  await Account.updateOne({ _id: second.account._id }, { $set: { displayName: 'Nguyễn Lan Chi' } })
  await Account.updateOne({ _id: zero.account._id }, { $set: { displayName: 'Đặng Minh An' } })
  await addEntry(first.wallet, { amount: 100 })
  await addEntry(second.wallet, { amount: 200 })
  await addEntry(first.wallet, { amount: 50, occurredAt: new Date('2026-06-01T00:00:00+07:00') })
  await addEntry(first.wallet, { amount: 999, occurredAt: new Date('2026-05-31T23:59:59+07:00') })

  const result = await getAdminAuthorRevenue({ periodId, search: 'DANG', activity: 'earning' })
  expect(result.items.map(row => row.displayName)).toEqual(['Đặng Ngọc Anh'])
  expect(result.summary.totalRevenueCoins).toBe(300)
  expect(result.totalItems).toBe(1)
  expect(result.trend.map(row => row.periodId)).toEqual([
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
  ])
  expect(result.trend.map(row => row.revenueCoins)).toEqual([50, 0, 0, 0, 0, 300])
  const balance = await getAdminAuthorRevenue({ periodId, sort: 'balance' })
  expect(balance.items[0].accountId).toBe(String(first.account._id))
  const name = await getAdminAuthorRevenue({ periodId, sort: 'name' })
  expect(name.items.map(row => row.displayName)).toEqual([
    'Đặng Minh An',
    'Đặng Ngọc Anh',
    'Nguyễn Lan Chi',
  ])
  const empty = await getAdminAuthorRevenue({ periodId, search: '.*' })
  expect(empty.items).toEqual([])
  expect(empty.summary).toEqual(result.summary)
})

it('API chỉ cho admin xem và không cho cache kết quả', async () => {
  const guest = await request(app).get(endpoint).query({ periodId })

  expect(guest.status).toBe(401)

  for (const role of ['reader', 'author']) {
    const user = await authenticatedAccount(role)

    const response = await request(app).get(endpoint).set('Cookie', user.cookie).query({ periodId })

    expect(response.status).toBe(403)
  }

  const admin = await authenticatedAccount('admin')

  const response = await request(app).get(endpoint).set('Cookie', admin.cookie).query({ periodId })

  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.body.summary.totalRevenueCoins).toBe(0)
})

it('API từ chối tháng và phân trang không hợp lệ', async () => {
  const admin = await authenticatedAccount('admin')

  const invalidQueries = [
    {},
    { periodId: '2026-13' },
    { periodId, page: 0 },
    { periodId, page: 1.5 },
    { periodId, unexpected: 'value' },
    { periodId, sort: 'invalid' },
    { periodId, activity: 'invalid' },
    { periodId, search: 'a'.repeat(101) },
  ]

  for (const query of invalidQueries) {
    const response = await request(app).get(endpoint).set('Cookie', admin.cookie).query(query)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
  }
})
