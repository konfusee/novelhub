import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { AuditEvent } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session' }))
const path = '/api/admin/audit-events'

it('reads and filters immutable audit events across targets without exposing internal metadata', async () => {
  const admin = await authenticatedAccount('admin')
  const author = await authenticatedAccount('author')
  const time = new Date('2026-10-18T00:00:00Z')
  const events = await AuditEvent.create(
    ['story', 'chapter', 'account'].map((targetType, i) => ({
      actorType: i === 2 ? 'system' : 'account',
      actorId: i === 2 ? undefined : author.account._id,
      action: 'content.saved',
      targetType,
      targetId: author.account._id,
      result: 'success',
      reason: 'Nội dung <script>giữ dưới dạng chữ</script>',
      occurredAt: time,
      correlationId: 'private-trace',
      dataDigest: 'private-digest',
    })),
  )
  const get = query => request(app).get(path).set('Cookie', admin.cookie).query(query)
  const first = await get({ pageSize: 2 })
  expect(first.status).toBe(200)
  expect(first.headers['cache-control']).toBe('private, no-store')
  expect(first.body.total).toBe(3)
  expect(first.body.items.map(e => e.id)).toEqual(
    events
      .slice()
      .reverse()
      .slice(0, 2)
      .map(e => String(e._id)),
  )
  expect(first.body.items[0].actorId).toBeNull()
  expect(first.body.items[0]).not.toHaveProperty('correlationId')
  expect(first.body.items[0]).not.toHaveProperty('dataDigest')
  expect((await get({ page: 2, pageSize: 2 })).body.items).toHaveLength(1)
  const filtered = await get({
    targetType: 'chapter',
    targetId: String(author.account._id),
    actorId: String(author.account._id),
    action: 'content.saved',
    result: 'success',
    from: time.toISOString(),
    to: time.toISOString(),
  })
  expect(filtered.body.total).toBe(1)
  expect(filtered.body.items[0].targetType).toBe('chapter')
  expect((await get({ action: '.*' })).body.total).toBe(0)
  expect((await get({ from: '2026-10-19T00:00:00Z' })).body.total).toBe(0)
  expect(await AuditEvent.countDocuments()).toBe(3)
})
it('restricts reads to Admin and rejects invalid filters', async () => {
  expect((await request(app).get(path)).status).toBe(401)
  for (const role of ['reader', 'author', 'moderator']) {
    const account = await authenticatedAccount(role)
    expect((await request(app).get(path).set('Cookie', account.cookie)).status).toBe(403)
  }
  const admin = await authenticatedAccount('admin')
  for (const query of [
    { page: 0 },
    { pageSize: 51 },
    { actorId: 'bad' },
    { targetId: { $ne: 'x' } },
    { from: 'bad' },
    { from: '2026-10-19T00:00:00Z', to: '2026-10-18T00:00:00Z' },
    { unknown: 'x' },
  ]) {
    expect((await request(app).get(path).set('Cookie', admin.cookie).query(query)).status).toBe(400)
  }
})
