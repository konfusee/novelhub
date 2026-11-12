import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  Chapter,
  ContentRevision,
  LedgerEntry,
  RevenueAllocation,
  UnlockEntitlement,
  UnlockRequest,
  Wallet,
} from '../src/models/index.js'
import { issueSession } from '../src/auth/session.js'
import { demoId, seedCoinsDemo } from '../scripts/lib/coins-demo.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const origin = 'http://localhost:5173'
const config = testConfig({ corsOrigin: origin })
const app = createApp(config)

async function preparePurchase(readerKey = 'rich') {
  const demo = await seedCoinsDemo({
    password: 'Only-for-temporary-tests-123!',
  })

  const account = await Account.findById(demoId(`account:${readerKey}`))
  const { token } = await issueSession(account, 1)
  const cookie = `${config.cookieName}=${token}`
  const story = demo.stories[0]
  const chapter = story.chapters[1]

  const body = {
    expectedPriceCoins: chapter.coinPrice,
    expectedRevisionId: chapter.revisionId,
    requestKey: crypto.randomUUID(),
  }

  const buy = (changes = {}) =>
    request(app)
      .post(`/api/reader/stories/${story.id}/chapters/${chapter.id}/unlock`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .send({ ...body, ...changes })

  return { story, chapter, cookie, buy }
}

it('mua xong đọc được; gửi lại hoặc dùng mã mới không trừ thêm xu', async () => {
  const { story, chapter, cookie, buy } = await preparePurchase()
  const path = `/api/catalog/stories/${story.id}/chapters/${chapter.id}`

  const before = await request(app).get(path).set('Cookie', cookie)
  expect(before.status).toBe(403)

  const first = await buy()
  expect(first.status).toBe(201)
  expect(first.body).toMatchObject({
    state: 'owned',
    reused: false,
    balance: 4000,
    priceCoins: 1000,
  })

  const replay = await buy()
  expect(replay.status).toBe(200)
  expect(replay.body.reused).toBe(true)

  const anotherKey = await buy({ requestKey: crypto.randomUUID() })
  expect(anotherKey.status).toBe(200)
  expect(anotherKey.body.reused).toBe(true)

  const after = await request(app).get(path).set('Cookie', cookie)
  expect(after.status).toBe(200)
  expect(JSON.stringify(after.body)).toContain('DỮ LIỆU MẪU COINS')

  expect((await Wallet.findById(demoId('wallet:rich'))).availableBalance).toBe(4000)
  expect(await UnlockEntitlement.countDocuments()).toBe(1)
  expect(await UnlockRequest.countDocuments()).toBe(1)
  expect(await RevenueAllocation.countDocuments()).toBe(1)
  expect(
    await LedgerEntry.countDocuments({
      sourceType: 'UnlockRequest',
    }),
  ).toBe(3)
})

it('thiếu xu thì không tạo quyền hoặc ghi nhận lần mua thành công', async () => {
  const { buy } = await preparePurchase('poor')

  const response = await buy()

  expect(response.status).toBe(409)
  expect(response.body.error.code).toBe('insufficient_coins')
  expect((await Wallet.findById(demoId('wallet:poor'))).availableBalance).toBe(999)
  expect(await UnlockEntitlement.countDocuments()).toBe(0)
  expect(await UnlockRequest.countDocuments()).toBe(0)
  expect(await RevenueAllocation.countDocuments()).toBe(0)
  expect(
    await LedgerEntry.countDocuments({
      sourceType: 'UnlockRequest',
    }),
  ).toBe(0)
})

it('tái xuất bản không làm mất quyền, không trừ lại xu và danh sách hiển thị đã mở', async () => {
  const { story, chapter, cookie, buy } = await preparePurchase()
  expect((await buy()).status).toBe(201)
  const original = await ContentRevision.findById(chapter.revisionId).lean()
  const copy = Object.fromEntries(
    Object.entries(original).filter(
      ([key]) => !['_id', 'createdAt', 'updatedAt', 'version'].includes(key),
    ),
  )
  const next = await ContentRevision.create({
    ...copy,
    revisionNumber: original.revisionNumber + 1,
  })
  await Chapter.updateOne({ _id: chapter.id }, { $set: { publishedRevisionId: next._id } })
  const path = `/api/catalog/stories/${story.id}/chapters/${chapter.id}`
  expect((await request(app).get(path).set('Cookie', cookie)).status).toBe(200)
  const owned = await buy({ expectedRevisionId: String(next._id), requestKey: crypto.randomUUID() })
  expect(owned.status).toBe(200)
  expect(owned.body.state).toBe('owned')
  const list = await request(app).get(`/api/catalog/stories/${story.id}`).set('Cookie', cookie)
  expect(list.status).toBe(200)
  expect(list.body.chapters.find(row => row.id === chapter.id).locked).toBe(false)
  const guest = await request(app).get(`/api/catalog/stories/${story.id}`)
  expect(guest.body.chapters.find(row => row.id === chapter.id).locked).toBe(true)
  expect((await Wallet.findById(demoId('wallet:rich'))).availableBalance).toBe(4000)
  expect(await UnlockEntitlement.countDocuments()).toBe(1)
  expect(String((await UnlockEntitlement.findOne()).publishedRevisionId)).toBe(chapter.revisionId)
})
