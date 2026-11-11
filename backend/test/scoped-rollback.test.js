import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  LedgerEntry,
  TopUpOrder,
  UnlockRequest,
  WithdrawalRequest,
  RevenueAllocation,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))

it('keeps removed endpoints unavailable and rejects invalid unlocks without financial writes', async () => {
  const reader = await authenticatedAccount()
  const moderator = await authenticatedAccount('moderator')
  const id = '000000000000000000000001'
  for (const url of [
    // '/api/reader/wallet',
    '/api/reader/home',
    `/api/reader/stories/${id}/chapters/${id}/unlock`,
    '/api/catalog/home',
    '/api/catalog/rankings',
    '/api/catalog/discovery',
    '/api/workspace/reader/wallet',
  ]) {
    expect((await request(app).get(url).set('Cookie', reader.cookie)).status, url).toBe(404)
  }
  for (const url of ['/api/moderator/review-claims', '/api/workspace/moderator/submissions']) {
    expect((await request(app).get(url).set('Cookie', moderator.cookie)).status, url).toBe(404)
  }
  for (const url of [`/api/reader/stories/${id}/chapters/${id}/unlock`]) {
    expect(
      (await request(app).post(url).set('Cookie', reader.cookie).set('Origin', origin).send({}))
        .status,
      url,
    ).toBe(400)
  }
  expect(await LedgerEntry.countDocuments()).toBe(0)
  expect(await TopUpOrder.countDocuments()).toBe(0)
  expect(await UnlockRequest.countDocuments()).toBe(0)
})

it('keeps legacy finance endpoints removed while restored payout endpoints remain read-only', async () => {
  const author = await authenticatedAccount('author')
  const admin = await authenticatedAccount('admin')
  const id = String(author.account._id)
  for (const url of [
    `/api/author/payouts/${id}`,
    '/api/author/transactions',
    '/api/reader/author-finance/payouts',
    '/api/workspace/author/earnings',
  ]) {
    expect((await request(app).get(url).set('Cookie', author.cookie)).status, url).toBe(404)
  }
  for (const url of [
    '/api/admin/account-closures',
    '/api/admin/payout-operations',
    '/api/admin/finance-report',
    '/api/admin/bank-receipts',
    `/api/admin/authors/${id}/agreement`,
    '/api/workspace/admin/agreements',
    '/api/workspace/admin/transactions',
  ]) {
    expect((await request(app).get(url).set('Cookie', admin.cookie)).status, url).toBe(404)
  }
  expect((await request(app).get('/api/author/payouts').set('Cookie', author.cookie)).status).toBe(
    200,
  )
  expect(
    (
      await request(app)
        .get('/api/admin/monthly-payouts')
        .set('Cookie', admin.cookie)
        .query({ periodId: '2026-11' })
    ).status,
  ).toBe(200)
  for (const url of [
    `/api/admin/account-closures/${id}/evaluate`,
    `/api/admin/authors/${id}/agreement`,
  ]) {
    expect(
      (await request(app).post(url).set('Cookie', admin.cookie).set('Origin', origin).send({}))
        .status,
      url,
    ).toBe(404)
  }
  const changedPolicy = await request(app)
    .post('/api/admin/policy')
    .set('Cookie', admin.cookie)
    .set('Origin', origin)
    .send({
      priceMinCoins: 200,
      priceMaxCoins: 5000,
      durationMinDays: 1,
      durationMaxDays: 30,
      expectedPolicyId: null,
      expectedPolicyVersion: null,
      reason: 'Configure revenue and payout defaults through Field 1',
      authorSharePercent: 80,
      withdrawalThresholdCoins: 100000,
    })
  expect(changedPolicy.status).toBe(201)
  expect(await WithdrawalRequest.countDocuments()).toBe(0)
  expect(await RevenueAllocation.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})
