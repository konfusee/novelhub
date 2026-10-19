import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { PolicyVersion } from '../src/models/index.js'
import { adminPolicy } from '../src/modules/admin-policy.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session' }))
it('requires Admin and returns an explicit empty policy without invented bounds', async () => {
  expect((await request(app).get('/api/admin/policy')).status).toBe(401)
  for (const role of ['reader', 'author', 'moderator']) {
    const user = await authenticatedAccount(role)
    expect((await request(app).get('/api/admin/policy').set('Cookie', user.cookie)).status).toBe(
      403,
    )
  }
  const admin = await authenticatedAccount('admin')
  const response = await request(app).get('/api/admin/policy').set('Cookie', admin.cookie)
  expect(response.status).toBe(200)
  expect(response.body).toEqual({ policy: null })
  expect(response.headers['cache-control']).toBe('private, no-store')
})
it('matches the currently effective policy, excluding draft, superseded and future records', async () => {
  const admin = await authenticatedAccount('admin')
  const base = { actorAccountId: admin.account._id }
  await PolicyVersion.create({ ...base, status: 'effective', effectiveAt: new Date('2025-01-01') })
  const selected = await PolicyVersion.create({
    ...base,
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    priceMinCoins: 300,
    priceMaxCoins: 900,
    durationMinDays: 2,
    durationMaxDays: 8,
    authorSharePercent: 75,
    platformSharePercent: 25,
  })
  for (const status of ['draft', 'superseded', 'effective']) {
    await PolicyVersion.create({
      ...base,
      status,
      effectiveAt: new Date(status === 'effective' ? '2099-01-01' : '2026-02-01'),
    })
  }
  expect(await adminPolicy(new Date('2026-03-01'))).toEqual({
    policy: {
      id: selected.id,
      version: selected.version,
      effectiveAt: selected.effectiveAt,
      priceMinCoins: 300,
      priceMaxCoins: 900,
      durationMinDays: 2,
      durationMaxDays: 8,
      authorSharePercent: 75,
      platformSharePercent: 25,
      withdrawalThresholdCoins: 100000,
      orderExpiryHours: 24,
      claimExpiryHours: 24,
    },
  })
  const response = await request(app).get('/api/admin/policy').set('Cookie', admin.cookie)
  expect(response.body.policy.id).toBe(selected.id)
  expect(response.body.policy).not.toHaveProperty('actorAccountId')
  expect(response.body.policy).not.toHaveProperty('createdAt')
})
