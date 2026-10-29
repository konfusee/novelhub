import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  BankTransaction,
  LedgerEntry,
  TopUpOrder,
  TopUpPackage,
  Wallet,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const key = 'test-only-sepay-key-12345678901234567890'

const bank = {
  bin: '970436',
  name: 'Vietcombank',
  accountNumber: '0123456789',
  accountName: 'TAI KHOAN TEST',
}

const app = createApp(
  testConfig({
    sePayWebhookApiKey: key,
    topUpBank: bank,
  }),
)

async function prepareCase(balance = 1000) {
  const reader = await authenticatedAccount()

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: balance,
  })

  const pack = await TopUpPackage.create({
    priceVnd: 50000,
    coinAmount: 50000,
    status: 'active',
  })

  const order = await TopUpOrder.create({
    accountId: reader.account._id,
    walletId: wallet._id,
    packageId: pack._id,
    packageSnapshot: {
      priceVnd: 50000,
      coinAmount: 50000,
    },
    paymentCode: 'NH12345678',
    coinAmount: 50000,
    status: 'pending',
    expiresAt: new Date(Date.now() + 3600000),
  })

  const payload = {
    id: 92704,
    gateway: bank.name,
    transactionDate: '2026-10-28 14:30:00',
    accountNumber: bank.accountNumber,
    subAccount: '',
    code: order.paymentCode,
    content: order.paymentCode,
    transferType: 'in',
    transferAmount: 50000,
  }

  return { reader, wallet, order, payload }
}

function sendWebhook(payload) {
  return request(app)
    .post('/api/webhooks/sepay')
    .set('Authorization', `Apikey ${key}`)
    .send(payload)
}

it('gửi đồng thời và gửi lại cùng giao dịch chỉ cộng xu một lần', async () => {
  const { wallet, order, payload } = await prepareCase()

  const responses = await Promise.all([sendWebhook(payload), sendWebhook(payload)])

  for (const response of responses) {
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true })
  }

  const replay = await sendWebhook(payload)
  expect(replay.status).toBe(200)

  const savedWallet = await Wallet.findById(wallet._id)
  const savedOrder = await TopUpOrder.findById(order._id)
  const receipt = await BankTransaction.findOne({
    sePayTransactionId: String(payload.id),
  })

  expect(savedWallet.availableBalance).toBe(51000)
  expect(savedOrder.status).toBe('paid')
  expect(savedOrder.paidAmountVnd).toBe(50000)
  expect(String(savedOrder.bankTransactionId)).toBe(String(receipt._id))
  expect(receipt.matchStatus).toBe('matched')
  expect(await BankTransaction.countDocuments()).toBe(1)
  expect(
    await LedgerEntry.countDocuments({
      walletId: wallet._id,
      ledgerType: 'topup-credit',
      amount: 50000,
    }),
  ).toBe(1)
  expect(await AuditEvent.countDocuments()).toBe(2)
})

it('sai số tiền thì lưu giao dịch nhưng không cộng xu', async () => {
  const { wallet, order, payload } = await prepareCase()

  const response = await sendWebhook({
    ...payload,
    transferAmount: 49000,
  })

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ success: true })

  const savedWallet = await Wallet.findById(wallet._id)
  const savedOrder = await TopUpOrder.findById(order._id)
  const receipt = await BankTransaction.findOne({
    sePayTransactionId: String(payload.id),
  })

  expect(savedWallet.availableBalance).toBe(1000)
  expect(savedOrder.status).toBe('pending')
  expect(receipt.matchStatus).toBe('amount-mismatch')
  expect(await LedgerEntry.countDocuments()).toBe(0)
  expect(await AuditEvent.countDocuments()).toBe(1)
})

it('số dư vượt giới hạn thì rollback toàn bộ', async () => {
  const { wallet, order, payload } = await prepareCase(Number.MAX_SAFE_INTEGER)

  const response = await sendWebhook(payload)

  expect(response.status).toBe(500)

  const savedWallet = await Wallet.findById(wallet._id)
  const savedOrder = await TopUpOrder.findById(order._id)

  expect(savedWallet.availableBalance).toBe(Number.MAX_SAFE_INTEGER)
  expect(savedOrder.status).toBe('pending')
  expect(savedOrder.bankTransactionId).toBeUndefined()
  expect(await BankTransaction.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
it('chủ đơn xem được thông tin đơn nạp của mình', async () => {
  const { reader, order } = await prepareCase()

  const response = await request(app)
    .get(`/api/reader/top-up-orders/${order._id}`)
    .set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body.order).toMatchObject({
    id: String(order._id),
    paymentCode: order.paymentCode,
    priceVnd: 50000,
    coinAmount: 50000,
    status: 'pending',
  })
})

it('khách chưa đăng nhập không được xem đơn nạp', async () => {
  const { order } = await prepareCase()

  const response = await request(app).get(`/api/reader/top-up-orders/${order._id}`)

  expect(response.status).toBe(401)
  expect(response.body.order).toBeUndefined()
})

it('tài khoản khác không được xem đơn nạp của người mua', async () => {
  const { order } = await prepareCase()
  const otherReader = await authenticatedAccount()

  const response = await request(app)
    .get(`/api/reader/top-up-orders/${order._id}`)
    .set('Cookie', otherReader.cookie)

  expect(response.status).toBe(404)
  expect(response.body.error.code).toBe('topup_order_not_found')
  expect(response.body.order).toBeUndefined()
})
