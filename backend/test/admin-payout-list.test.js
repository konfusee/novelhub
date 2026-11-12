import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, PayoutResultEntry, Wallet, WithdrawalRequest } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const app = createApp(testConfig())
const endpoint = '/api/admin/monthly-payouts'
const periodId = '2026-11'

const bank = {
  bankName: 'TPBank',
  accountNumber: '0123456789',
  accountHolder: 'NGUYEN VAN A',
}

// Tạo dữ liệu riêng cho test đọc danh sách.
// Không gọi lại nghiệp vụ lập khoản chi trong từng test.
async function prepareWithdrawal(overrides = {}) {
  const { account } = await authenticatedAccount('author', {
    bankDetails: bank,
  })

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: 0,
  })

  const withdrawal = await WithdrawalRequest.create({
    accountId: account._id,
    earningsWalletId: wallet._id,
    origin: 'system-monthly',
    periodId,
    cutoffAt: new Date('2026-11-30T10:00:00+07:00'),
    evaluatedAt: new Date('2026-11-30T10:00:00+07:00'),
    evaluatedBalanceCoins: 150000,
    thresholdCoins: 100000,
    amountCoins: 150000,
    payoutSlipAmountVnd: 150000,
    bankDetailsSnapshot: bank,
    status: 'pending',
    forcedByDeletion: false,
    ...overrides,
  })

  return { account, withdrawal }
}

function getList(cookie, query = { periodId }) {
  return request(app).get(endpoint).set('Cookie', cookie).query(query)
}

it('khách, reader và author không được xem danh sách', async () => {
  await prepareWithdrawal()

  const guest = await request(app).get(endpoint).query({ periodId })

  expect(guest.status).toBe(401)
  expect(guest.body.items).toBeUndefined()

  for (const role of ['reader', 'author']) {
    const user = await authenticatedAccount(role)
    const response = await getList(user.cookie)

    expect(response.status).toBe(403)
    expect(response.body.items).toBeUndefined()
  }
})

it('admin lọc đúng kỳ và trạng thái, xem ngân hàng đã chốt', async () => {
  const admin = await authenticatedAccount('admin')
  const target = await prepareWithdrawal()

  await prepareWithdrawal({ status: 'paid' })
  await prepareWithdrawal({ periodId: '2026-10' })

  // Tác giả đổi ngân hàng sau khi lập khoản chi.
  await Account.updateOne(
    { _id: target.account._id },
    {
      $set: {
        bankDetails: {
          bankName: 'Other Bank',
          accountNumber: '9999999999',
          accountHolder: 'OTHER HOLDER',
        },
      },
    },
  )

  const response = await getList(admin.cookie, {
    periodId,
    status: 'pending',
  })

  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.body.items).toHaveLength(1)

  expect(response.body.items[0]).toMatchObject({
    withdrawalId: String(target.withdrawal._id),
    accountId: String(target.account._id),
    displayName: target.account.displayName,
    periodId,
    status: 'pending',
    amountCoins: 150000,
    bankDetails: bank,
    latestResult: null,
  })
})

it('lấy kết quả mới nhất và không trả mã chuyển khoản riêng tư', async () => {
  const admin = await authenticatedAccount('admin')
  const { withdrawal } = await prepareWithdrawal()

  await PayoutResultEntry.create([
    {
      withdrawalRequestId: withdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      actorAccountId: admin.account._id,
      occurredAt: new Date('2026-12-01T08:00:00+07:00'),
      result: 'Failed',
      note: 'Lần thử đầu',
    },
    {
      withdrawalRequestId: withdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      actorAccountId: admin.account._id,
      occurredAt: new Date('2026-12-01T09:00:00+07:00'),
      result: 'Failed',
      note: 'Lần thử mới nhất',
      transferReference: 'PRIVATE-REFERENCE',
    },
  ])

  const response = await getList(admin.cookie)

  expect(response.status).toBe(200)
  expect(response.body.items[0].latestResult).toEqual({
    executionMode: 'legacy',
    result: 'Failed',
    note: 'Lần thử mới nhất',
    occurredAt: '2026-12-01T02:00:00.000Z',
  })

  expect(JSON.stringify(response.body)).not.toContain('PRIVATE-REFERENCE')
})

it('21 khoản được chia thành các trang 7 bản ghi, không lặp bản ghi', async () => {
  const admin = await authenticatedAccount('admin')

  for (let index = 0; index < 21; index++) {
    await prepareWithdrawal()
  }

  const first = await getList(admin.cookie, {
    periodId,
    page: 1,
  })

  const second = await getList(admin.cookie, {
    periodId,
    page: 2,
  })

  const third = await getList(admin.cookie, {
    periodId,
    page: 3,
  })

  expect(first.status).toBe(200)
  expect(second.status).toBe(200)
  expect(third.status).toBe(200)

  expect(first.body.pageSize).toBe(7)
  expect(first.body.items).toHaveLength(7)
  expect(first.body.hasMore).toBe(true)

  expect(second.body.items).toHaveLength(7)
  expect(second.body.hasMore).toBe(true)

  expect(third.body.items).toHaveLength(7)
  expect(third.body.hasMore).toBe(false)

  const ids = [...first.body.items, ...second.body.items, ...third.body.items].map(
    item => item.withdrawalId,
  )

  expect(new Set(ids).size).toBe(21)
  const exported = await getList(admin.cookie, { periodId, export: 'csv', page: 3 })
  expect(exported.body.items).toHaveLength(21)
  expect(exported.body.summary.totalAmountVnd).toBe(21 * 150000)
})

it('tìm tác giả và lọc kết quả mới nhất; tổng kỳ không đổi, không đếm trùng lần thất bại', async () => {
  const admin = await authenticatedAccount('admin')
  const pending = await prepareWithdrawal()
  const paid = await prepareWithdrawal({ status: 'paid' })
  const untouched = await prepareWithdrawal()
  await Account.updateOne({ _id: pending.account._id }, { $set: { displayName: 'Đặng Ngọc Anh' } })
  for (const [index, result] of ['Failed', 'Failed'].entries()) {
    await PayoutResultEntry.create({
      withdrawalRequestId: pending.withdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      result,
      occurredAt: new Date(`2026-12-01T0${index}:00:00Z`),
    })
  }
  await PayoutResultEntry.create([
    {
      withdrawalRequestId: paid.withdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      result: 'Failed',
      occurredAt: new Date('2026-12-01T00:00:00Z'),
    },
    {
      withdrawalRequestId: paid.withdrawal._id,
      resultEntryKey: crypto.randomUUID(),
      result: 'Paid',
      occurredAt: new Date('2026-12-01T01:00:00Z'),
    },
  ])
  const response = await getList(admin.cookie, {
    periodId,
    search: 'dang ngoc',
    latestResult: 'Failed',
  })
  expect(response.body.items.map(row => row.withdrawalId)).toEqual([String(pending.withdrawal._id)])
  expect(response.body.summary).toEqual({
    totalCount: 3,
    totalAmountVnd: 450000,
    paidAmountVnd: 150000,
    pendingAmountVnd: 300000,
    failedCount: 1,
    failedAmountVnd: 150000,
  })
  const none = await getList(admin.cookie, { periodId, search: 'not-found' })
  expect(none.body.items).toEqual([])
  expect(none.body.summary).toEqual(response.body.summary)
  expect(
    response.body.items.some(row => row.withdrawalId === String(untouched.withdrawal._id)),
  ).toBe(false)
})

it('từ chối bộ lọc không hợp lệ', async () => {
  const admin = await authenticatedAccount('admin')

  const invalidQueries = [
    {},
    { periodId: '2026-13' },
    { periodId, status: 'Failed' },
    { periodId, page: 0 },
    { periodId, page: 1.5 },
    { periodId, unexpected: 'value' },
  ]

  for (const query of invalidQueries) {
    const response = await getList(admin.cookie, query)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
  }
})
