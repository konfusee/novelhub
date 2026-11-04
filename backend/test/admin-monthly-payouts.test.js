import { expect, it } from 'vitest'
import {
  Notification,
  NotificationOutbox,
  PolicyVersion,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { generateMonthlyPayouts } from '../src/modules/admin-monthly-payouts.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { useTestDatabase } from './db.js'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { testConfig } from './config.js'

useTestDatabase()

const origin = 'http://localhost:5173'
const endpoint = '/api/admin/monthly-payouts/generate'
const app = createApp(testConfig({ corsOrigin: origin }))

function generateRequest(cookie, body) {
  return request(app).post(endpoint).set('Origin', origin).set('Cookie', cookie).send(body)
}

const periodId = '2026-11'

// Ngày cuối tháng theo giờ Việt Nam.
const monthEnd = new Date('2026-11-30T10:00:00+07:00')

const bank = {
  bankName: 'TPBank',
  accountNumber: '0123456789',
  accountHolder: 'NGUYEN VAN A',
}

async function prepareAdmin() {
  const { account } = await authenticatedAccount('admin')

  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-11-01T00:00:00+07:00'),
    withdrawalThresholdCoins: 100000,
    actorAccountId: account._id,
  })

  return account
}

async function prepareAuthor(balance, hasBank = true) {
  const { account } = await authenticatedAccount('author', hasBank ? { bankDetails: bank } : {})

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: balance,
  })

  return { account, wallet }
}

it('chỉ lập khoản chi cho tác giả đủ ngưỡng và có ngân hàng', async () => {
  const admin = await prepareAdmin()
  const eligible = await prepareAuthor(150000)
  const belowThreshold = await prepareAuthor(50000)
  const missingBank = await prepareAuthor(120000, false)

  const result = await generateMonthlyPayouts(admin, periodId, monthEnd)

  expect(result.periodId).toBe(periodId)
  expect(result.totalAuthors).toBe(3)

  function resultOf(author) {
    return result.results.find(item => item.accountId === String(author.account._id))
  }

  expect(resultOf(eligible)).toMatchObject({
    state: 'created',
    amountCoins: 150000,
    balance: 0,
  })

  expect(resultOf(belowThreshold)).toMatchObject({
    state: 'skipped',
    reason: 'below-threshold',
  })

  expect(resultOf(missingBank)).toMatchObject({
    state: 'missing-bank-details',
  })

  expect((await Wallet.findById(eligible.wallet._id)).availableBalance).toBe(0)

  expect((await Wallet.findById(belowThreshold.wallet._id)).availableBalance).toBe(50000)

  expect((await Wallet.findById(missingBank.wallet._id)).availableBalance).toBe(120000)

  expect(await WithdrawalRequest.countDocuments()).toBe(1)

  // Một thông báo lập chi và một thông báo thiếu ngân hàng.
  expect(await Notification.countDocuments()).toBe(2)

  // Mỗi thông báo có hai kênh: in-app và email.
  expect(await NotificationOutbox.countDocuments()).toBe(4)
})

it('gọi lại cùng kỳ không tạo thêm khoản chi hoặc thông báo', async () => {
  const admin = await prepareAdmin()
  const author = await prepareAuthor(150000)

  await generateMonthlyPayouts(admin, periodId, monthEnd)

  // Sau lần lập chi đầu tiên, tác giả nhận thêm doanh thu.
  await Wallet.updateOne(
    { _id: author.wallet._id },
    {
      $inc: {
        availableBalance: 120000,
        balanceVersion: 1,
        version: 1,
      },
    },
  )

  const result = await generateMonthlyPayouts(admin, periodId, monthEnd)

  expect(result.results[0].state).toBe('existing')
  expect(await WithdrawalRequest.countDocuments()).toBe(1)

  // Doanh thu mới không bị trích thêm trong cùng kỳ.
  expect((await Wallet.findById(author.wallet._id)).availableBalance).toBe(120000)

  expect(await Notification.countDocuments()).toBe(1)
  expect(await NotificationOutbox.countDocuments()).toBe(2)
})

it('chưa tới cuối tháng thì không lập khoản chi', async () => {
  const admin = await prepareAdmin()
  const author = await prepareAuthor(150000)

  await expect(
    generateMonthlyPayouts(admin, periodId, new Date('2026-11-15T10:00:00+07:00')),
  ).rejects.toThrow('Chỉ được lập chi trả cho tháng hiện tại vào ngày cuối tháng.')

  expect(await WithdrawalRequest.countDocuments()).toBe(0)

  expect((await Wallet.findById(author.wallet._id)).availableBalance).toBe(150000)
})

it('tài khoản không có quyền admin không được lập chi', async () => {
  await prepareAdmin()
  const { account: reader } = await authenticatedAccount()
  await prepareAuthor(150000)

  await expect(generateMonthlyPayouts(reader, periodId, monthEnd)).rejects.toThrow(
    'Quyền quản trị không còn hiệu lực.',
  )

  expect(await WithdrawalRequest.countDocuments()).toBe(0)
})

it('API từ chối khách và tài khoản không có quyền admin', async () => {
  const guestResponse = await request(app).post(endpoint).set('Origin', origin).send({ periodId })

  expect(guestResponse.status).toBe(401)

  for (const role of ['reader', 'author']) {
    const user = await authenticatedAccount(role)

    const response = await generateRequest(user.cookie, {
      periodId,
    })

    expect(response.status).toBe(403)
  }

  expect(await WithdrawalRequest.countDocuments()).toBe(0)
})

it('API từ chối kỳ sai định dạng và trường ngoài schema', async () => {
  const admin = await authenticatedAccount('admin')

  const invalidBodies = [
    {},
    { periodId: '2026-13' },
    { periodId: '2026-1' },
    { periodId: 202611 },
    { periodId, amountCoins: 999999 },
  ]

  for (const body of invalidBodies) {
    const response = await generateRequest(admin.cookie, body)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
  }

  expect(await WithdrawalRequest.countDocuments()).toBe(0)
})
