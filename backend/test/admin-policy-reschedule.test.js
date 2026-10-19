import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, AuditEvent, PolicyVersion, RoleAssignment } from '../src/models/index.js'
import {
  adminPolicy,
  adminPolicyHistory,
  rescheduleFuturePolicy,
} from '../src/modules/admin-policy.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
import { digest } from '../src/modules/submission-digests.js'
useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session' }))
const body = {
  expectedVersion: 0,
  effectiveAt: '2099-02-01T07:00:00+07:00',
  reason: 'Đổi ngày áp dụng',
}
const post = (f, input = body, actor = f.admin, id = f.future.id) =>
  request(app)
    .post(`/api/admin/policy/${id}/reschedule`)
    .set('Cookie', actor.cookie)
    .set('Origin', 'http://localhost:5173')
    .send(input)
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
    priceMinCoins: 456,
    priceMaxCoins: 789,
    durationMinDays: 2,
    durationMaxDays: 3,
    authorSharePercent: 82,
    platformSharePercent: 18,
    withdrawalThresholdCoins: 150000,
    orderExpiryHours: 12,
    claimExpiryHours: 36,
  })
  return { admin, current, future }
}
it('atomically retains the old schedule and copies all terms to a new identity with two audits', async () => {
  const f = await fixture()
  const original = JSON.stringify(await PolicyVersion.findById(f.current.id).lean())
  await AuditEvent.create({
    actorType: 'account',
    actorId: f.admin.account._id,
    action: 'policy.scheduled',
    targetType: 'policy',
    targetId: f.future._id,
    targetVersion: 0,
    result: 'accepted',
    reason: 'Lịch ban đầu',
    occurredAt: new Date('2025-01-01'),
  })
  const result = await post(f)
  expect(result.status).toBe(201)
  expect(result.headers['cache-control']).toBe('private, no-store')
  expect(result.body).toMatchObject({
    previousPolicyId: f.future.id,
    previousVersion: 1,
    version: 0,
    effectiveAt: '2099-02-01T00:00:00.000Z',
  })
  expect(result.body.policyId).not.toBe(f.future.id)
  const replaced = await PolicyVersion.findById(f.future.id).lean()
  expect(replaced).toMatchObject({
    status: 'superseded',
    effectiveAt: f.future.effectiveAt,
    version: 1,
  })
  const replacement = await PolicyVersion.findById(result.body.policyId).lean()
  for (const field of [
    'priceMinCoins',
    'priceMaxCoins',
    'durationMinDays',
    'durationMaxDays',
    'authorSharePercent',
    'platformSharePercent',
    'withdrawalThresholdCoins',
    'orderExpiryHours',
    'claimExpiryHours',
  ])
    expect(replacement[field]).toBe(replaced[field])
  expect(JSON.stringify(await PolicyVersion.findById(f.current.id).lean())).toBe(original)
  expect(await PolicyVersion.countDocuments()).toBe(3)
  expect(
    await PolicyVersion.countDocuments({ status: 'effective', effectiveAt: { $gt: new Date() } }),
  ).toBe(1)
  expect(await AuditEvent.countDocuments()).toBe(3)
  expect(
    (await AuditEvent.findOne({ action: 'policy.cancelled', targetId: f.future._id }).lean())
      .dataDigest,
  ).toBe(
    digest({
      previousPolicyId: f.future.id,
      previousEffectiveAt: '2099-01-01T00:00:00.000Z',
      replacementPolicyId: result.body.policyId,
      effectiveAt: '2099-02-01T00:00:00.000Z',
    }),
  )
  const history = await adminPolicyHistory({ page: 1, pageSize: 5 })
  expect(history.items.find(row => row.id === f.future.id)).toMatchObject({
    cancelled: true,
    cancellationReason: body.reason,
    reason: 'Lịch ban đầu',
  })
  expect(history.items.find(row => row.id === result.body.policyId)).toMatchObject({
    future: true,
    reason: body.reason,
  })
  expect((await adminPolicy(new Date('2099-01-01'))).policy.id).toBe(f.current.id)
  expect((await adminPolicy(new Date('2099-02-01'))).policy.id).toBe(result.body.policyId)
  expect((await post(f)).status).toBe(409)
})
it('rejects missing, stale, current, past, draft and superseded schedules', async () => {
  const f = await fixture()
  expect((await post(f, { ...body, expectedVersion: 9 })).status).toBe(409)
  expect((await post(f, body, f.admin, f.current.id)).status).toBe(409)
  expect((await post(f, body, f.admin, '111111111111111111111111')).status).toBe(404)
  for (const status of ['draft', 'superseded']) {
    await PolicyVersion.updateOne({ _id: f.future.id }, { $set: { status } })
    expect((await post(f)).status).toBe(409)
  }
  await PolicyVersion.updateOne(
    { _id: f.future.id },
    { $set: { status: 'effective', effectiveAt: new Date('2020-01-01') } },
  )
  expect((await post(f)).status).toBe(409)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
it('strictly validates time, reason, tokens and refuses the same instant in a different offset', async () => {
  const f = await fixture()
  for (const patch of [
    { effectiveAt: '2020-01-01T00:00:00Z' },
    { effectiveAt: '2099-02-30T00:00:00Z' },
    { effectiveAt: '2099-02-01T07:00' },
    { expectedVersion: -1 },
    { expectedVersion: 1.5 },
    { reason: ' ' },
    { priceMinCoins: 999 },
  ])
    expect((await post(f, { ...body, ...patch })).status).toBe(400)
  expect((await post(f, { ...body, effectiveAt: '2099-01-01T07:00:00+07:00' })).status).toBe(409)
  expect(await PolicyVersion.countDocuments()).toBe(2)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
it('rechecks Admin access inside the transaction and at the HTTP boundary', async () => {
  const f = await fixture()
  expect(
    (
      await request(app)
        .post(`/api/admin/policy/${f.future.id}/reschedule`)
        .set('Origin', 'http://localhost:5173')
        .send(body)
    ).status,
  ).toBe(401)
  for (const role of ['reader', 'author', 'moderator'])
    expect((await post(f, body, await authenticatedAccount(role))).status).toBe(403)
  await RoleAssignment.updateOne(
    { accountId: f.admin.account._id, role: 'admin' },
    { $set: { status: 'revoked' } },
  )
  await expect(rescheduleFuturePolicy(f.admin.account, f.future.id, body)).rejects.toMatchObject({
    status: 403,
  })
  expect(await AuditEvent.countDocuments()).toBe(0)
})
it('rolls back both schedule records and the actor pin if audit creation fails', async () => {
  const f = await fixture()
  const before = JSON.stringify(await PolicyVersion.find().sort({ _id: 1 }).lean())
  const actorVersion = (await Account.findById(f.admin.account.id)).version
  const createAudit = AuditEvent.create.bind(AuditEvent)
  const audit = vi.spyOn(AuditEvent, 'create').mockImplementationOnce(async (records, options) => {
    await createAudit([records[0]], options)
    throw new Error('audit unavailable')
  })
  try {
    await expect(rescheduleFuturePolicy(f.admin.account, f.future.id, body)).rejects.toThrow(
      'audit unavailable',
    )
  } finally {
    audit.mockRestore()
  }
  expect(JSON.stringify(await PolicyVersion.find().sort({ _id: 1 }).lean())).toBe(before)
  expect((await Account.findById(f.admin.account.id)).version).toBe(actorVersion)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
it('serializes two Admin reschedules and cancellation racing rescheduling', async () => {
  const f = await fixture()
  const other = await authenticatedAccount('admin')
  const results = await Promise.all([
    post(f),
    post(f, { ...body, effectiveAt: '2099-03-01T00:00:00Z' }, other),
  ])
  expect(results.map(r => r.status).sort()).toEqual([201, 409])
  expect(await PolicyVersion.countDocuments()).toBe(3)
  expect(await AuditEvent.countDocuments()).toBe(2)
  const replacement = await PolicyVersion.findOne({
    status: 'effective',
    effectiveAt: { $gt: new Date() },
  })
  const f2 = { ...f, future: replacement }
  const race = await Promise.all([
    post(f2, {
      ...body,
      effectiveAt: '2099-04-01T00:00:00Z',
      expectedVersion: replacement.version,
    }),
    request(app)
      .post(`/api/admin/policy/${replacement.id}/cancel`)
      .set('Cookie', other.cookie)
      .set('Origin', 'http://localhost:5173')
      .send({ expectedVersion: replacement.version, reason: 'Hủy lịch' }),
  ])
  expect(race.filter(r => r.status === 409)).toHaveLength(1)
  expect(race.filter(r => [200, 201].includes(r.status))).toHaveLength(1)
  expect(
    await PolicyVersion.countDocuments({ status: 'effective', effectiveAt: { $gt: new Date() } }),
  ).toBeLessThanOrEqual(1)
})
it('rejects ambiguous legacy schedules and a missing current policy without mutating data', async () => {
  const f = await fixture()
  const another = await PolicyVersion.create({
    actorAccountId: f.admin.account._id,
    status: 'effective',
    effectiveAt: new Date('2099-04-01'),
  })
  expect((await post(f)).status).toBe(409)
  await PolicyVersion.deleteOne({ _id: another.id })
  await PolicyVersion.deleteOne({ _id: f.current.id })
  expect((await post(f)).status).toBe(409)
  expect((await PolicyVersion.findById(f.future.id)).version).toBe(0)
  expect(await AuditEvent.countDocuments()).toBe(0)
})
