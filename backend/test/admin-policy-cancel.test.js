import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, AuditEvent, PolicyVersion, RoleAssignment } from '../src/models/index.js'
import {
  adminPolicyHistory,
  cancelFuturePolicy,
  activatePolicy,
} from '../src/modules/admin-policy.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session' }))
const post = (
  admin,
  policy,
  body = { expectedVersion: policy.version, reason: 'Hủy lịch theo yêu cầu' },
) =>
  request(app)
    .post(`/api/admin/policy/${policy.id}/cancel`)
    .set('Cookie', admin.cookie)
    .set('Origin', 'http://localhost:5173')
    .send(body)
async function fixture() {
  const admin = await authenticatedAccount('admin')
  const current = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2025-01-01'),
  })
  const future = await PolicyVersion.create({
    actorAccountId: admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2099-01-01'),
    priceMinCoins: 300,
  })
  return { admin, current, future }
}
it('cancels only the future record, retains terms and current policy, and unblocks immediate activation', async () => {
  const f = await fixture()
  const before = JSON.stringify(await PolicyVersion.findById(f.current.id).lean())
  const result = await post(f.admin, f.future)
  expect(result.status).toBe(200)
  expect(result.headers['cache-control']).toBe('private, no-store')
  expect(result.body).toEqual({ policyId: f.future.id, version: f.future.version + 1 })
  expect(await PolicyVersion.countDocuments()).toBe(2)
  expect(await PolicyVersion.findById(f.future.id).lean()).toMatchObject({
    status: 'superseded',
    effectiveAt: f.future.effectiveAt,
    priceMinCoins: 300,
  })
  expect(JSON.stringify(await PolicyVersion.findById(f.current.id).lean())).toBe(before)
  const history = await adminPolicyHistory({ page: 1, pageSize: 5 })
  expect(history.items.find(item => item.id === f.future.id)).toMatchObject({
    cancelled: true,
    future: false,
    current: false,
    cancellationReason: 'Hủy lịch theo yêu cầu',
    reason: null,
  })
  const created = await activatePolicy(f.admin.account, {
    expectedPolicyId: f.current.id,
    expectedPolicyVersion: f.current.version,
    priceMinCoins: 400,
    priceMaxCoins: 900,
    durationMinDays: 2,
    durationMaxDays: 8,
    reason: 'Chính sách mới',
  })
  expect(created.policyId).not.toBe(f.current.id)
})
it('rejects current, past, draft, superseded, stale and replayed cancellations', async () => {
  const f = await fixture()
  expect((await post(f.admin, f.current)).status).toBe(409)
  for (const status of ['draft', 'superseded']) {
    const row = await PolicyVersion.create({
      actorAccountId: f.admin.account._id,
      status,
      effectiveAt: new Date('2099-01-01'),
    })
    expect((await post(f.admin, row)).status).toBe(409)
  }
  expect(
    (await post(f.admin, f.future, { expectedVersion: f.future.version + 1, reason: 'Stale' }))
      .status,
  ).toBe(409)
  expect((await post(f.admin, f.future)).status).toBe(200)
  expect((await post(f.admin, f.future)).status).toBe(409)
  expect(await AuditEvent.countDocuments({ action: 'policy.cancelled' })).toBe(1)
})
it('serializes two Admin cancellations without duplicate audit records', async () => {
  const f = await fixture()
  const other = await authenticatedAccount('admin')
  const results = await Promise.all([post(f.admin, f.future), post(other, f.future)])
  expect(results.map(result => result.status).sort()).toEqual([200, 409])
  expect(await AuditEvent.countDocuments()).toBe(1)
})
it('rolls back the policy and actor lock when cancellation audit fails', async () => {
  const f = await fixture()
  const original = JSON.stringify(await PolicyVersion.findById(f.future.id).lean())
  const version = (await Account.findById(f.admin.account.id)).version
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit failed'))
  try {
    await expect(
      cancelFuturePolicy(f.admin.account, f.future.id, {
        expectedVersion: f.future.version,
        reason: 'Hủy',
      }),
    ).rejects.toThrow('audit failed')
  } finally {
    spy.mockRestore()
  }
  expect(JSON.stringify(await PolicyVersion.findById(f.future.id).lean())).toBe(original)
  expect((await Account.findById(f.admin.account.id)).version).toBe(version)
})
it('validates strict input and missing IDs', async () => {
  const f = await fixture()
  for (const body of [
    { expectedVersion: 0, reason: ' ' },
    { expectedVersion: -1, reason: 'X' },
    { expectedVersion: 0, reason: 'X', effectiveAt: '2020-01-01' },
  ])
    expect((await post(f.admin, f.future, body)).status).toBe(400)
  expect((await post(f.admin, { id: 'bad', version: 0 })).status).toBe(400)
  expect(
    (await post(f.admin, { id: new Account.base.Types.ObjectId().toString(), version: 0 })).status,
  ).toBe(404)
})
it('requires current Admin permission both on the route and inside the transaction', async () => {
  const f = await fixture()
  expect(
    (
      await request(app)
        .post(`/api/admin/policy/${f.future.id}/cancel`)
        .set('Origin', 'http://localhost:5173')
        .send({ expectedVersion: 0, reason: 'X' })
    ).status,
  ).toBe(401)
  for (const role of ['reader', 'author', 'moderator']) {
    const user = await authenticatedAccount(role)
    expect((await post(user, f.future)).status).toBe(403)
  }
  await RoleAssignment.updateOne({ accountId: f.admin.account.id }, { $set: { status: 'revoked' } })
  await expect(
    cancelFuturePolicy(f.admin.account, f.future.id, { expectedVersion: 0, reason: 'X' }),
  ).rejects.toMatchObject({ status: 403 })
  expect((await PolicyVersion.findById(f.future.id)).status).toBe('effective')
})
