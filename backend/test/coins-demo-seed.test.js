import request from 'supertest'
import { expect, it } from 'vitest'
import {
  Account,
  AuditEvent,
  Chapter,
  LedgerEntry,
  PolicyVersion,
  Story,
  TopUpPackage,
  Wallet,
} from '../src/models/index.js'
import { createApp } from '../src/app.js'
import { issueSession } from '../src/auth/session.js'
import { verifyPassword } from '../src/auth/password.js'
import { demoId, seedCoinsDemo } from '../scripts/lib/coins-demo.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const password = 'Demo-test-only-123456!'
const app = createApp(testConfig())

it('creates readable fixtures, locked chapters and explicit demo opening balances', async () => {
  const result = await seedCoinsDemo({ password })
  expect(result.created).toBe(true)
  expect(result.accounts).toHaveLength(5)
  expect(await Story.countDocuments()).toBe(2)
  expect(await Chapter.countDocuments()).toBe(7)
  expect(await TopUpPackage.countDocuments()).toBe(3)
  expect(await LedgerEntry.countDocuments({ ledgerType: 'adjustment' })).toBe(2)

  const reader = await Account.findById(demoId('account:rich')).select('+password')
  expect(await verifyPassword(password, reader.password.hash)).toBe(true)
  const { token } = await issueSession(reader, 1)
  const cookie = `novelhub_session=${token}`
  const story = result.stories[0]
  const free = story.chapters[0]
  const locked = story.chapters[1]
  const expired = story.chapters[3]
  const chapterPath = chapter => `/api/catalog/stories/${story.id}/chapters/${chapter.id}`

  expect((await request(app).get(chapterPath(free)).set('Cookie', cookie)).status).toBe(200)
  const denied = await request(app).get(chapterPath(locked)).set('Cookie', cookie)
  expect(denied.status).toBe(403)
  expect(JSON.stringify(denied.body)).not.toContain('Nhân vật dừng lại')
  expect((await request(app).get(chapterPath(expired)).set('Cookie', cookie)).status).toBe(200)
  const quote = await request(app)
    .get(`/api/reader/stories/${story.id}/chapters/${locked.id}/unlock-quote`)
    .set('Cookie', cookie)
  expect(quote.status).toBe(200)
  expect(quote.body).toMatchObject({ state: 'locked', canRead: false, canAfford: true })
  expect(quote.body.priceCoins).toBe(locked.coinPrice)
  const poor = await Account.findById(demoId('account:poor'))
  const poorSession = await issueSession(poor, 1)
  const poorQuote = await request(app)
    .get(`/api/reader/stories/${story.id}/chapters/${locked.id}/unlock-quote`)
    .set('Cookie', `novelhub_session=${poorSession.token}`)
  expect(poorQuote.status).toBe(200)
  expect(poorQuote.body).toMatchObject({ state: 'locked', canRead: false, canAfford: false })
})

it('rerunning preserves spent coins and does not duplicate records', async () => {
  await seedCoinsDemo({ password })
  await Wallet.updateOne({ _id: demoId('wallet:rich') }, { $inc: { availableBalance: -100 } })
  const result = await seedCoinsDemo({ password: 'A-different-password-123!' })
  expect(result.created).toBe(false)
  expect((await Wallet.findById(demoId('wallet:rich'))).availableBalance).toBe(4900)
  expect(await Account.countDocuments()).toBe(5)
  expect(await Chapter.countDocuments()).toBe(7)
  expect(await LedgerEntry.countDocuments()).toBe(2)
  const reader = await Account.findById(demoId('account:rich')).select('+password')
  expect(await verifyPassword(password, reader.password.hash)).toBe(true)
})

it('keeps existing accounts, balances and effective policy', async () => {
  const real = await authenticatedAccount('admin')
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: real.account._id,
    purpose: 'reader-coins',
    availableBalance: 123,
  })
  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date(0),
    actorAccountId: real.account._id,
    authorSharePercent: 60,
    platformSharePercent: 40,
  })
  await seedCoinsDemo({ password })
  expect(await PolicyVersion.countDocuments()).toBe(1)
  expect((await PolicyVersion.findById(policy._id)).authorSharePercent).toBe(60)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(123)
  expect((await Account.findById(real.account._id)).status).toBe('active')
})

it('refuses identity collisions without inserting a partial demo dataset', async () => {
  const real = await authenticatedAccount('reader', {
    _id: demoId('account:rich'),
    email: 'existing-person@example.test',
  })
  await expect(seedCoinsDemo({ password })).rejects.toThrow('không ghi đè')
  expect(await Account.countDocuments()).toBe(1)
  expect((await Account.findById(real.account._id)).email).toBe('existing-person@example.test')
  expect(await Story.countDocuments()).toBe(0)
  expect(await Wallet.countDocuments()).toBe(0)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
