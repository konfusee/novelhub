import request from 'supertest'
import { Types } from 'mongoose'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, LedgerEntry, UnlockRequest, Wallet } from '../src/models/index.js'
import { purchaseReaderChapter } from '../src/modules/coins-payouts/finance/reader-unlocks.js'
import { demoId, seedCoinsDemo } from '../scripts/lib/coins-demo.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig())
const periodId = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
}).format(new Date())

it('chi tiết đối chiếu đúng giá mua, phần tác giả và platform từ một lần mua thực', async () => {
  const demo = await seedCoinsDemo({ password: 'Only-for-temporary-tests-123!' })
  const reader = await Account.findById(demoId('account:rich'))
  const story = demo.stories[0]
  const chapter = story.chapters[1]
  await purchaseReaderChapter({ account: reader }, story.id, chapter.id, {
    expectedPriceCoins: chapter.coinPrice,
    expectedRevisionId: chapter.revisionId,
    requestKey: crypto.randomUUID(),
  })
  const admin = await authenticatedAccount('admin')
  const authorWallet = await Wallet.findOne({
    purpose: 'author-earnings',
    availableBalance: { $gt: 0 },
  })
  const response = await request(app)
    .get(`/api/admin/author-revenue/${authorWallet.ownerId}`)
    .set('Cookie', admin.cookie)
    .query({ periodId })
  expect(response.status).toBe(200)
  expect(response.body.totalItems).toBe(1)
  const row = response.body.items[0]
  expect(row).toMatchObject({ priceCoins: 1000, authorCoins: 700, platformCoins: 300 })
  expect(row.storyTitle).toBeTruthy()
  expect(row.chapterTitle).toBeTruthy()
  expect(response.body.revenueCoins).toBe(700)
  expect(await UnlockRequest.countDocuments()).toBe(1)
})

it('giữ giao dịch gốc khi liên kết đã thiếu, không đoán giá hoặc phần platform', async () => {
  const author = await authenticatedAccount('author')
  const admin = await authenticatedAccount('admin')
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 123,
  })
  await LedgerEntry.create({
    walletId: wallet._id,
    ledgerType: 'allocation-credit',
    direction: 'credit',
    amount: 123,
    sourceType: 'UnlockRequest',
    sourceId: new Types.ObjectId(),
    idempotencyScope: { operation: 'test', ownerId: author.account._id, key: 'one' },
    occurredAt: new Date(),
  })
  const response = await request(app)
    .get(`/api/admin/author-revenue/${author.account._id}`)
    .set('Cookie', admin.cookie)
    .query({ periodId })
  expect(response.status).toBe(200)
  expect(response.body.items[0]).toMatchObject({
    priceCoins: null,
    authorCoins: 123,
    platformCoins: null,
    chapterTitle: null,
    storyTitle: null,
  })
})

it('bảo vệ quyền admin và kiểm tra ID/kỳ cho chi tiết và xuất báo cáo', async () => {
  const author = await authenticatedAccount('author')
  const admin = await authenticatedAccount('admin')
  const endpoint = `/api/admin/author-revenue/${author.account._id}`
  expect((await request(app).get(endpoint).query({ periodId })).status).toBe(401)
  expect(
    (await request(app).get(endpoint).set('Cookie', author.cookie).query({ periodId })).status,
  ).toBe(403)
  expect(
    (
      await request(app)
        .get('/api/admin/author-revenue/not-an-id')
        .set('Cookie', admin.cookie)
        .query({ periodId })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(app)
        .get(endpoint)
        .set('Cookie', admin.cookie)
        .query({ periodId, unexpected: 'x' })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(app)
        .get(`/api/admin/author-revenue/${new Types.ObjectId()}`)
        .set('Cookie', admin.cookie)
        .query({ periodId })
    ).status,
  ).toBe(404)
  for (const path of ['/api/admin/author-revenue', '/api/admin/monthly-payouts']) {
    expect(
      (await request(app).get(path).set('Cookie', author.cookie).query({ periodId, export: 'csv' }))
        .status,
    ).toBe(403)
  }
})
