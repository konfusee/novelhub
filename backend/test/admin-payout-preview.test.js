import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  LedgerEntry,
  PayoutSheetRow,
  PolicyVersion,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { withTransaction } from '../src/db/connection.js'
import { buildMonthlyPayoutPreview } from '../src/modules/coins-payouts/finance/admin-payout-preview.js'
import { generateMonthlyPayouts } from '../src/modules/coins-payouts/finance/admin-monthly-payouts.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const app = createApp(testConfig())
const periodId = '2026-11'
const monthEnd = new Date('2026-11-30T10:00:00+07:00')

const bank = {
  bankName: 'TPBank',
  accountNumber: '0123456789',
  accountHolder: 'NGUYEN VAN A',
}

async function prepareAuthor(balance = 150000) {
  const { account } = await authenticatedAccount('author', {
    bankDetails: bank,
  })

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: balance,
  })

  return { account, wallet }
}

async function prepare(balance = 150000) {
  const { account: admin } = await authenticatedAccount('admin')
  const author = await prepareAuthor(balance)

  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-11-01T00:00:00+07:00'),
    withdrawalThresholdCoins: 100000,
    actorAccountId: admin._id,
  })

  return { admin, author, policy }
}

function loadPreview() {
  return withTransaction(session => buildMonthlyPayoutPreview(periodId, session, monthEnd))
}

function confirm(admin, previewHash) {
  return generateMonthlyPayouts(admin, periodId, monthEnd, previewHash)
}

async function expectNoPayout(walletId, balance) {
  expect((await Wallet.findById(walletId)).availableBalance).toBe(balance)

  expect(await WithdrawalRequest.countDocuments()).toBe(0)
  expect(await PayoutSheetRow.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)

  expect(
    await AuditEvent.countDocuments({
      action: 'monthly-payout.created',
    }),
  ).toBe(0)
}

it('xem trước không trích xu hoặc tạo khoản chi', async () => {
  const { author } = await prepare()

  const first = await loadPreview()
  const second = await loadPreview()

  expect(first.eligibleCount).toBe(1)
  expect(first.totalCoins).toBe(150000)
  expect(first.items[0]).toMatchObject({
    accountId: String(author.account._id),
    amountCoins: 150000,
    bankDetails: bank,
  })

  expect(first.previewHash).toMatch(/^[a-f0-9]{64}$/)
  expect(second.previewHash).toBe(first.previewHash)

  await expectNoPayout(author.wallet._id, 150000)
})

it('danh sách còn khớp thì tạo khoản chi; gửi lại không trích thêm', async () => {
  const { admin, author } = await prepare()
  const preview = await loadPreview()

  const result = await confirm(admin, preview.previewHash)

  expect(result.results[0]).toMatchObject({
    state: 'created',
    amountCoins: 150000,
    balance: 0,
  })

  expect((await Wallet.findById(author.wallet._id)).availableBalance).toBe(0)

  const withdrawal = await WithdrawalRequest.findOne({
    accountId: author.account._id,
    periodId,
  })

  expect(withdrawal.status).toBe('pending')
  expect(withdrawal.amountCoins).toBe(150000)

  // Sau lần tạo đầu, danh sách dự kiến đã thay đổi.
  await expect(confirm(admin, preview.previewHash)).rejects.toMatchObject({
    status: 409,
    code: 'payout_preview_changed',
  })

  expect(await WithdrawalRequest.countDocuments()).toBe(1)
  expect(await LedgerEntry.countDocuments()).toBe(1)

  expect((await Wallet.findById(author.wallet._id)).availableBalance).toBe(0)
})

it.each(['balance', 'bank', 'policy', 'new-author'])(
  'dữ liệu %s thay đổi thì chặn xác nhận danh sách cũ',
  async change => {
    const { admin, author, policy } = await prepare()
    const preview = await loadPreview()

    let expectedBalance = 150000

    if (change === 'balance') {
      await Wallet.updateOne(
        { _id: author.wallet._id },
        {
          $inc: {
            availableBalance: 25000,
            balanceVersion: 1,
            version: 1,
          },
        },
      )

      expectedBalance = 175000
    }

    if (change === 'bank') {
      await Account.updateOne(
        { _id: author.account._id },
        {
          $set: {
            bankDetails: {
              ...bank,
              accountNumber: '9999999999',
            },
          },
          $inc: { version: 1 },
        },
      )
    }

    if (change === 'policy') {
      await PolicyVersion.updateOne(
        { _id: policy._id },
        {
          $set: { withdrawalThresholdCoins: 120000 },
          $inc: { version: 1 },
        },
      )
    }

    if (change === 'new-author') {
      await prepareAuthor(200000)
    }

    await expect(confirm(admin, preview.previewHash)).rejects.toMatchObject({
      status: 409,
      code: 'payout_preview_changed',
    })

    await expectNoPayout(author.wallet._id, expectedBalance)
  },
)

it('không có tác giả đủ điều kiện thì không tạo đợt chi', async () => {
  const { admin, author } = await prepare(50000)
  const preview = await loadPreview()

  expect(preview.eligibleCount).toBe(0)
  expect(preview.totalCoins).toBe(0)

  await expect(confirm(admin, preview.previewHash)).rejects.toMatchObject({
    status: 409,
    code: 'payout_preview_empty',
  })

  await expectNoPayout(author.wallet._id, 50000)
})

it('API tạo khoản chi bắt buộc có previewHash hợp lệ', async () => {
  const { cookie } = await authenticatedAccount('admin')

  const bodies = [{ periodId }, { periodId, previewHash: '' }, { periodId, previewHash: 'abc' }]

  for (const body of bodies) {
    const response = await request(app)
      .post('/api/admin/monthly-payouts/generate')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5173')
      .send(body)

    expect(response.status).toBe(405)
    expect(response.body.error.code).toBe('payouts_read_only')
  }

  expect(await WithdrawalRequest.countDocuments()).toBe(0)
})

it('khách và tài khoản không phải admin không được xem trước', async () => {
  const endpoint = '/api/admin/monthly-payouts/preview'

  const guest = await request(app).get(endpoint).query({ periodId })

  expect(guest.status).toBe(401)

  for (const role of ['reader', 'author']) {
    const user = await authenticatedAccount(role)

    const response = await request(app).get(endpoint).set('Cookie', user.cookie).query({ periodId })

    expect(response.status).toBe(403)
    expect(response.body.items).toBeUndefined()
  }
})
