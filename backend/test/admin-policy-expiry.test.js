import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  PolicyVersion,
  PublicationSubmission,
  TopUpOrder,
} from '../src/models/index.js'
import {
  adminPolicy,
  adminPolicyHistory,
} from '../src/modules/accounts-administration/admin/admin-policy.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session' }))
const input = {
  priceMinCoins: 200,
  priceMaxCoins: 5000,
  durationMinDays: 1,
  durationMaxDays: 14,
  expectedPolicyId: null,
  expectedPolicyVersion: null,
  reason: 'Cập nhật thời hạn',
}
const post = (admin, body) =>
  request(app)
    .post('/api/admin/policy')
    .set('Cookie', admin.cookie)
    .set('Origin', 'http://localhost:5173')
    .send(body)

it('initializes explicit expiry settings and preserves existing order/claim deadlines', async () => {
  const admin = await authenticatedAccount('admin')
  const id = () => new Account.base.Types.ObjectId()
  const order = await TopUpOrder.create({
    accountId: admin.account._id,
    walletId: id(),
    packageId: id(),
    packageSnapshot: { coins: 100, price: 10000 },
    paymentCode: 'NH12345678',
    coinAmount: 100,
    expiresAt: new Date('2090-01-01T00:00:00Z'),
  })
  const claim = await PublicationSubmission.create({
    storyId: id(),
    revisionId: id(),
    authorAccountId: admin.account._id,
    claimOwnerAccountId: admin.account._id,
    claimExpiresAt: new Date('2090-02-01T00:00:00Z'),
  })
  const before = JSON.stringify([
    await TopUpOrder.findById(order.id).lean(),
    await PublicationSubmission.findById(claim.id).lean(),
  ])
  for (const field of ['priceMinCoins', 'orderExpiryHours', 'claimExpiryHours']) {
    const invalid = await post(admin, { ...input, [field]: 0 })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('validation_error')
  }
  const result = await post(admin, { ...input, orderExpiryHours: 1, claimExpiryHours: 6 })
  expect(result.status).toBe(201)
  const read = await request(app).get('/api/admin/policy').set('Cookie', admin.cookie)
  expect(read.body.policy).toMatchObject({ orderExpiryHours: 1, claimExpiryHours: 6 })
  expect((await adminPolicyHistory({ page: 1, pageSize: 5 })).items[0]).toMatchObject({
    orderExpiryHours: 1,
    claimExpiryHours: 6,
  })
  expect(
    JSON.stringify([
      await TopUpOrder.findById(order.id).lean(),
      await PublicationSubmission.findById(claim.id).lean(),
    ]),
  ).toBe(before)
  expect(await AuditEvent.countDocuments({ action: 'policy.activated' })).toBe(1)
})

it('versions expiry-only changes and inherits stored values for callers omitting them', async () => {
  const admin = await authenticatedAccount('admin')
  const old = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
    orderExpiryHours: 8,
    claimExpiryHours: 16,
  })
  const result = await post(admin, {
    ...input,
    expectedPolicyId: old.id,
    expectedPolicyVersion: old.version,
    orderExpiryHours: 12,
    claimExpiryHours: 36,
  })
  expect(result.status).toBe(201)
  expect(await PolicyVersion.findById(old.id).lean()).toMatchObject({
    status: 'superseded',
    orderExpiryHours: 8,
    claimExpiryHours: 16,
  })
  const current = await PolicyVersion.findById(result.body.policyId)
  const inherited = await post(admin, {
    ...input,
    expectedPolicyId: current.id,
    expectedPolicyVersion: current.version,
  })
  expect(inherited.status).toBe(201)
  expect(await PolicyVersion.findById(inherited.body.policyId).lean()).toMatchObject({
    orderExpiryHours: 12,
    claimExpiryHours: 36,
  })
})

it('keeps scheduled expiries separate until the exact effective boundary', async () => {
  const admin = await authenticatedAccount('admin')
  const old = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
    orderExpiryHours: 8,
    claimExpiryHours: 16,
  })
  const result = await post(admin, {
    ...input,
    expectedPolicyId: old.id,
    expectedPolicyVersion: old.version,
    effectiveAt: '2099-01-01T00:00:00Z',
    orderExpiryHours: 12,
    claimExpiryHours: 36,
  })
  expect(result.status).toBe(201)
  expect((await adminPolicy(new Date('2098-12-31T23:59:59.999Z'))).policy).toMatchObject({
    id: old.id,
    orderExpiryHours: 8,
    claimExpiryHours: 16,
  })
  expect((await adminPolicy(new Date('2099-01-01T00:00:00Z'))).policy).toMatchObject({
    id: result.body.policyId,
    orderExpiryHours: 12,
    claimExpiryHours: 36,
  })
  expect(await PolicyVersion.findById(old.id).lean()).toMatchObject({
    status: 'effective',
    orderExpiryHours: 8,
    claimExpiryHours: 16,
  })
  expect(await AuditEvent.countDocuments({ action: 'policy.scheduled' })).toBe(1)
})

it('rejects invalid expiry input without persisting a policy or audit', async () => {
  const admin = await authenticatedAccount('admin')
  for (const field of ['orderExpiryHours', 'claimExpiryHours']) {
    for (const value of [-1, 0.5, '12', null, Number.MAX_SAFE_INTEGER + 1]) {
      expect((await post(admin, { ...input, [field]: value })).status).toBe(400)
    }
  }
  expect((await post(admin, { ...input, expiresAt: '2099-01-01' })).status).toBe(400)
  expect(await PolicyVersion.countDocuments()).toBe(0)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
