import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Wallet } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig())

it('preserves the wallet contract and exposes the combined MVC finance view separately', async () => {
  const author = await authenticatedAccount('author')
  const wallet = await request(app).get('/api/author/earnings').set('Cookie', author.cookie)
  expect(wallet.status).toBe(200)
  expect(wallet.body).toEqual({ balance: 0, entries: [], hasMore: false })
  const combined = await request(app).get('/api/author/finance').set('Cookie', author.cookie)
  expect(combined.status).toBe(200)
  expect(combined.body).toEqual({
    balance: 0,
    entries: [],
    hasMoreEntries: false,
    paymentDetails: null,
    payouts: [],
  })
  expect(await Wallet.countDocuments()).toBe(0)
})

it('both finance read endpoints require the author role', async () => {
  const reader = await authenticatedAccount('reader')
  for (const path of ['/api/author/earnings', '/api/author/finance']) {
    expect((await request(app).get(path)).status).toBe(401)
    expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403)
  }
})
