import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { PayoutResultEntry, Wallet, WithdrawalRequest } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const app = createApp(testConfig())
const endpoint = '/api/author/payouts'

async function prepareAuthor() {
  const user = await authenticatedAccount('author')

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: user.account._id,
    purpose: 'author-earnings',
    availableBalance: 0,
  })

  return { ...user, wallet }
}

async function addWithdrawal(author, periodId = '2026-11', status = 'pending') {
  return WithdrawalRequest.create({
    accountId: author.account._id,
    earningsWalletId: author.wallet._id,
    origin: 'system-monthly',
    periodId,
    cutoffAt: new Date(`${periodId}-01T00:00:00+07:00`),
    evaluatedAt: new Date(`${periodId}-01T00:00:00+07:00`),
    evaluatedBalanceCoins: 150000,
    thresholdCoins: 100000,
    amountCoins: 150000,
    payoutSlipAmountVnd: 150000,
    bankDetailsSnapshot: {
      bankName: 'TPBank',
      accountNumber: '0987654321',
      accountHolder: 'PRIVATE BANK HOLDER',
    },
    status,
    forcedByDeletion: false,
  })
}

function getHistory(cookie, query = {}) {
  return request(app).get(endpoint).set('Cookie', cookie).query(query)
}

it('details are owner-scoped and do not reveal legacy internal notes or transfer references', async () => {
  const own = await prepareAuthor(),
    other = await prepareAuthor()
  const withdrawal = await addWithdrawal(own)
  await PayoutResultEntry.create({
    withdrawalRequestId: withdrawal._id,
    resultEntryKey: 'internal-note',
    occurredAt: new Date(),
    result: 'Failed',
    note: 'PRIVATE INTERNAL NOTE',
    transferReference: 'PRIVATE BANK REF',
  })
  const path = endpoint + '/' + withdrawal._id + '/history'
  expect((await request(app).get(path).set('Cookie', other.cookie)).status).toBe(404)
  const result = await request(app).get(path).set('Cookie', own.cookie)
  expect(result.status).toBe(200)
  expect(result.body.items).toHaveLength(1)
  expect(JSON.stringify(result.body)).not.toContain('PRIVATE')
})

it('khách và tài khoản không có quyền author bị từ chối', async () => {
  expect((await request(app).get(endpoint)).status).toBe(401)

  for (const role of ['reader', 'admin']) {
    const user = await authenticatedAccount(role)
    const response = await getHistory(user.cookie)

    expect(response.status).toBe(403)
    expect(response.body.items).toBeUndefined()
  }
})

it('chỉ trả khoản của mình, lấy kết quả gần nhất và ẩn dữ liệu nội bộ', async () => {
  const author = await prepareAuthor()
  const other = await prepareAuthor()
  const admin = await authenticatedAccount('admin')

  const ownWithdrawal = await addWithdrawal(author, '2026-11', 'paid')

  const otherWithdrawal = await addWithdrawal(other)

  await PayoutResultEntry.create([
    {
      withdrawalRequestId: ownWithdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      actorAccountId: admin.account._id,
      occurredAt: new Date('2026-12-01T08:00:00+07:00'),
      result: 'Failed',
      note: 'PRIVATE ADMIN NOTE',
    },
    {
      withdrawalRequestId: ownWithdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      actorAccountId: admin.account._id,
      occurredAt: new Date('2026-12-01T09:00:00+07:00'),
      result: 'Paid',
      note: 'PRIVATE ADMIN NOTE',
      transferReference: 'PRIVATE-TRANSFER-REFERENCE',
      correctedBankDetailsSnapshot: {
        accountNumber: 'PRIVATE-CORRECTED-BANK',
      },
    },
  ])

  const response = await getHistory(author.cookie)

  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.body.items).toHaveLength(1)

  expect(response.body.items[0]).toEqual({
    withdrawalId: String(ownWithdrawal._id),
    periodId: '2026-11',
    amountCoins: 150000,
    payoutSlipAmountVnd: 150000,
    status: 'paid',
    createdAt: ownWithdrawal.createdAt.toISOString(),
    latestResult: {
      executionMode: 'legacy',
      result: 'Paid',
      occurredAt: '2026-12-01T02:00:00.000Z',
    },
  })

  const serialized = JSON.stringify(response.body)

  for (const privateValue of [
    String(otherWithdrawal._id),
    'PRIVATE ADMIN NOTE',
    'PRIVATE-TRANSFER-REFERENCE',
    'PRIVATE-CORRECTED-BANK',
    'PRIVATE BANK HOLDER',
    '0987654321',
  ]) {
    expect(serialized).not.toContain(privateValue)
  }
})

it('chưa có khoản chi thì trả danh sách rỗng', async () => {
  const author = await prepareAuthor()

  const response = await getHistory(author.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toEqual({
    page: 1,
    pageSize: 20,
    hasMore: false,
    items: [],
  })
})

it('phân trang và sắp xếp kỳ mới nhất trước, không lặp bản ghi', async () => {
  const author = await prepareAuthor()

  // 21 kỳ: từ 2025-01 đến 2026-09.
  for (let index = 0; index < 21; index++) {
    const year = 2025 + Math.floor(index / 12)
    const month = String((index % 12) + 1).padStart(2, '0')

    await addWithdrawal(author, `${year}-${month}`)
  }

  const first = await getHistory(author.cookie, { page: 1 })
  const second = await getHistory(author.cookie, { page: 2 })

  expect(first.status).toBe(200)
  expect(second.status).toBe(200)

  expect(first.body.items).toHaveLength(20)
  expect(first.body.hasMore).toBe(true)
  expect(first.body.items[0].periodId).toBe('2026-09')

  expect(second.body.items).toHaveLength(1)
  expect(second.body.hasMore).toBe(false)
  expect(second.body.items[0].periodId).toBe('2025-01')

  const ids = [...first.body.items, ...second.body.items].map(item => item.withdrawalId)

  expect(new Set(ids).size).toBe(21)
}, 15000)

it('không cho truyền accountId để đổi người xem hoặc gửi trang sai', async () => {
  const author = await prepareAuthor()
  const other = await prepareAuthor()
  await addWithdrawal(other)

  const invalidQueries = [
    { accountId: String(other.account._id) },
    { page: 0 },
    { page: 1.5 },
    { page: 'abc' },
  ]

  for (const query of invalidQueries) {
    const response = await getHistory(author.cookie, query)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(response.body.items).toBeUndefined()
  }
})
