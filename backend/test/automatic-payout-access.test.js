import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
import { WithdrawalRequest } from '../src/models/index.js'

useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ corsOrigin: origin }))

it('payout execution endpoints cannot be invoked manually by an admin', async () => {
  const admin = await authenticatedAccount('admin')
  for (const suffix of [
    'generate',
    '123456789012345678901234/result',
    '123456789012345678901234/simulate-result',
  ]) {
    const response = await request(app)
      .post(`/api/admin/monthly-payouts/${suffix}`)
      .set('Origin', origin)
      .set('Cookie', admin.cookie)
      .send({})
    expect(response.status).toBe(405)
    expect(response.body.error.code).toBe('payouts_read_only')
  }
  expect(await WithdrawalRequest.countDocuments()).toBe(0)
})

it('only admins can read automatic payout runs', async () => {
  expect((await request(app).get('/api/admin/monthly-payouts/runs')).status).toBe(401)
  const reader = await authenticatedAccount('reader')
  expect(
    (await request(app).get('/api/admin/monthly-payouts/runs').set('Cookie', reader.cookie)).status,
  ).toBe(403)
  const admin = await authenticatedAccount('admin')
  const response = await request(app)
    .get('/api/admin/monthly-payouts/runs')
    .set('Cookie', admin.cookie)
  expect(response.status).toBe(200)
  expect(response.body).toEqual({ items: [], hasMore: false })
})
