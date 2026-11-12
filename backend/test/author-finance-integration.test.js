import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Wallet } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig())

it('preserves the wallet contract', async () => {
  const author = await authenticatedAccount('author')
  const wallet = await request(app).get('/api/author/earnings').set('Cookie', author.cookie)
  expect(wallet.status).toBe(200)
  expect(wallet.body).toEqual({ balance: 0, entries: [], hasMore: false, page: 1, pageSize: 50 })
  expect(await Wallet.countDocuments()).toBe(0)
})

it('the wallet endpoint requires the author role', async () => {
  const reader = await authenticatedAccount('reader')
  expect((await request(app).get('/api/author/earnings')).status).toBe(401)
  expect((await request(app).get('/api/author/earnings').set('Cookie', reader.cookie)).status).toBe(
    403,
  )
})

it('removed legacy finance endpoints stay unavailable', async () => {
  const author = await authenticatedAccount('author')
  expect((await request(app).get('/api/author/finance').set('Cookie', author.cookie)).status).toBe(
    404,
  )
  const result = await request(app)
    .put('/api/author/earnings/payment-details')
    .set('Cookie', author.cookie)
    .set('Origin', 'http://localhost:5173')
    .send({ bankName: 'TPBank', accountNumber: '0123456789', accountHolder: 'TEST AUTHOR' })
  expect(result.status).toBe(404)
})
