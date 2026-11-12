import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  AuditEvent,
  BankTransaction,
  LedgerEntry,
  PolicyVersion,
  TopUpOrder,
  TopUpPackage,
  Wallet,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const origin = 'http://localhost:5173'

const app = createApp(
  testConfig({
    corsOrigin: origin,
    topUpBank: {
      bin: '970423',
      name: 'TPBank',
      accountNumber: '0123456789',
      accountName: 'TAI KHOAN TEST',
    },
  }),
)

async function prepareCase() {
  const reader = await authenticatedAccount()
  const admin = await authenticatedAccount('admin')

  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2020-01-01T00:00:00Z'),
    orderExpiryHours: 24,
    actorAccountId: admin.account._id,
  })

  const pack = await TopUpPackage.create({
    priceVnd: 50000,
    coinAmount: 50000,
    status: 'active',
  })

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: 1000,
  })

  return { reader, pack, wallet }
}

function createOrder(reader, packageId) {
  return request(app)
    .post('/api/reader/top-up-orders')
    .set('Cookie', reader.cookie)
    .set('Origin', origin)
    .send({ packageId: String(packageId) })
}

it('restores QR for its owner, then hides it and warns against repayment when a receipt needs review', async () => {
  const { reader, pack } = await prepareCase()
  const created = await createOrder(reader, pack._id)
  const order = created.body.order
  const path = '/api/reader/top-up-orders/' + order.id
  const reopened = await request(app).get(path).set('Cookie', reader.cookie)
  expect(reopened.body.order.payment.content).toBe(order.paymentCode)
  await BankTransaction.create({
    sePayTransactionId: 'wrong-amount',
    amountVnd: 40000,
    matchedOrderId: order.id,
    matchStatus: 'amount-mismatch',
    receivedAt: new Date(),
    apiKeyAuthenticated: true,
  })
  const attention = await request(app).get(path).set('Cookie', reader.cookie)
  expect(attention.body.order.reviewState).toBe('pending-review')
  expect(attention.body.order.receivedAmountVnd).toBe(40000)
  expect(attention.body.order.payment).toBeUndefined()
  const reused = await createOrder(reader, pack._id)
  expect(reused.body.order.payment).toBeUndefined()
  const list = await request(app).get('/api/reader/top-up-orders').set('Cookie', reader.cookie)
  expect(list.body.items[0].reviewState).toBe('pending-review')
  const other = await authenticatedAccount()
  expect((await request(app).get(path).set('Cookie', other.cookie)).status).toBe(404)
  expect(
    (await request(app).get('/api/reader/top-up-orders').set('Cookie', other.cookie)).body.items,
  ).toEqual([])
})

it('tạo đơn pending đúng thông tin và chưa cộng xu', async () => {
  const { reader, pack, wallet } = await prepareCase()

  const response = await createOrder(reader, pack._id)

  expect(response.status).toBe(201)
  expect(response.body.reused).toBe(false)
  expect(response.body.order).toMatchObject({
    packageId: String(pack._id),
    priceVnd: 50000,
    coinAmount: 50000,
    status: 'pending',
  })
  expect(response.body.order.paymentCode).toMatch(/^NH\d{8}$/)
  expect(response.body.order.payment).toMatchObject({
    bankName: 'TPBank',
    accountNumber: '0123456789',
    amount: 50000,
    content: response.body.order.paymentCode,
  })

  const order = await TopUpOrder.findById(response.body.order.id)
  const savedWallet = await Wallet.findById(wallet._id)

  expect(String(order.accountId)).toBe(String(reader.account._id))
  expect(String(order.walletId)).toBe(String(wallet._id))
  expect(order.packageSnapshot.priceVnd).toBe(50000)
  expect(order.packageSnapshot.policy.orderExpiryHours).toBe(24)
  expect(savedWallet.availableBalance).toBe(1000)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('hai yêu cầu đồng thời chỉ tạo một đơn còn hạn', async () => {
  const { reader, pack, wallet } = await prepareCase()

  const responses = await Promise.all([
    createOrder(reader, pack._id),
    createOrder(reader, pack._id),
  ])

  expect(responses.map(response => response.status).sort()).toEqual([200, 201])

  expect(responses[0].body.order.id).toBe(responses[1].body.order.id)

  expect(responses[0].body.order.paymentCode).toBe(responses[1].body.order.paymentCode)

  expect(await TopUpOrder.countDocuments()).toBe(1)
  expect(
    await AuditEvent.countDocuments({
      action: 'topup.order.created',
    }),
  ).toBe(1)

  const savedWallet = await Wallet.findById(wallet._id)
  expect(savedWallet.availableBalance).toBe(1000)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('không tạo đơn khi gói đã ngừng bán', async () => {
  const { reader, pack, wallet } = await prepareCase()

  await TopUpPackage.updateOne({ _id: pack._id }, { $set: { status: 'inactive' } })

  const response = await createOrder(reader, pack._id)

  expect(response.status).toBe(409)
  expect(response.body.error.code).toBe('package_unavailable')
  expect(await TopUpOrder.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
  expect(
    await AuditEvent.countDocuments({
      action: 'topup.order.created',
    }),
  ).toBe(0)

  const savedWallet = await Wallet.findById(wallet._id)
  expect(savedWallet.availableBalance).toBe(1000)
})
