import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, BankTransaction, PolicyVersion, Wallet } from '../src/models/index.js'
import { demoId, seedCoinsDemo } from '../scripts/lib/coins-demo.js'
import { purchaseReaderChapter } from '../src/modules/coins-payouts/finance/reader-unlocks.js'
import { getPlatformFinanceReport } from '../src/modules/coins-payouts/finance/platform-finance-report.js'
import { getAuthorEarnings } from '../src/modules/coins-payouts/finance/author-earnings.js'
import { getReaderWallet } from '../src/modules/coins-payouts/finance/reader-wallet.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig())
const range = () => ({
  from: new Date(Date.now() - 86400000).toISOString(),
  to: new Date(Date.now() + 86400000).toISOString(),
})

it('reports actual debit and allocation legs, with snapshot chapter titles and policy filters', async () => {
  const demo = await seedCoinsDemo({ password: 'Only-temporary-tests-123!' })
  const reader = await Account.findById(demoId('account:rich'))
  const story = demo.stories[0],
    chapter = story.chapters[1]
  await purchaseReaderChapter({ account: reader }, story.id, chapter.id, {
    expectedPriceCoins: chapter.coinPrice,
    expectedRevisionId: chapter.revisionId,
    requestKey: crypto.randomUUID(),
  })
  const report = await getPlatformFinanceReport({ ...range(), groupBy: 'chapter' })
  expect(report.summary).toMatchObject({
    purchasedChapters: 1,
    unlockCoins: 1000,
    authorCoins: 700,
    platformCoins: 300,
  })
  expect(report.unlocks).toHaveLength(1)
  expect(report.unlocks[0].label).not.toBe('—')
  const policy = await PolicyVersion.findOne({ status: 'effective' })
  const filtered = await getPlatformFinanceReport({
    ...range(),
    policyId: String(policy._id),
    groupBy: 'week',
    all: true,
  })
  expect(filtered.items).toHaveLength(1)
  expect(filtered.items[0].coins).toBe(1000)
  const noMatches = await getPlatformFinanceReport({ ...range(), policyId: String(reader._id) })
  expect(noMatches.summary.unlockCoins).toBe(0)
  const wallet = await getReaderWallet(reader._id, { type: 'unlock' })
  expect(wallet.entries[0].description).toContain(report.unlocks[0].label)
  expect(wallet.entries[0].balanceAfter).toBe(4000)
  const authorWallet = await Wallet.findOne({ purpose: 'author-earnings' })
  const earnings = await getAuthorEarnings(authorWallet.ownerId)
  expect(earnings.entries[0].description).toContain(report.unlocks[0].label)
})

it('keeps registration statuses, bank states and live balances distinct', async () => {
  const { account } = await authenticatedAccount('admin')
  await Account.create({
    displayName: 'Pending registrant',
    email: 'pending@example.test',
    status: 'pending-verification',
  })
  await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'reader-coins',
    availableBalance: 99,
  })
  await BankTransaction.create({
    sePayTransactionId: 'unmatched-test',
    amountVnd: 50000,
    matchStatus: 'unmatched',
    receivedAt: new Date(),
    apiKeyAuthenticated: true,
  })
  const report = await getPlatformFinanceReport({ ...range(), groupBy: 'day' })
  expect(report.summary.registeredAccounts).toBe(2)
  expect(report.registrations.find(row => row.status === 'pending-verification').count).toBe(1)
  expect(report.bank).toContainEqual({ status: 'unmatched', count: 1, amountVnd: 50000 })
  expect(report.balances).toContainEqual({ purpose: 'reader-coins', count: 1, balanceCoins: 99 })
  expect(report.summary.topUpCoins).toBe(0)
})

it('API restricts reports/options to admins and rejects invalid or excessive date ranges', async () => {
  const reader = await authenticatedAccount('reader'),
    admin = await authenticatedAccount('admin')
  for (const path of ['/api/admin/transactions/report', '/api/admin/transactions/report-options']) {
    expect((await request(app).get(path)).status).toBe(401)
    expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403)
  }
  const get = params =>
    request(app).get('/api/admin/transactions/report').query(params).set('Cookie', admin.cookie)
  expect((await get(range())).status).toBe(200)
  expect((await get({ ...range(), from: '2020-01-01T00:00:00Z' })).status).toBe(400)
  expect((await get({ ...range(), groupBy: 'invalid' })).status).toBe(400)
})
