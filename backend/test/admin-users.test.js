import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, AuditEvent, Category, Story, Wallet } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(
  testConfig({
    cookieName: 'novelhub_session',
  }),
)
const get = (cookie, url) => request(app).get(url).set('Cookie', cookie)
async function fixture() {
  const admin = await authenticatedAccount('admin')
  const author = await authenticatedAccount('author', {
    displayName: 'Tác giả .* [A]',
    retainedPayoutEmail: 'private-retained@example.test',
  })
  const reader = await authenticatedAccount('reader', {
    displayName: 'Độc giả thật',
  })
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao',
    createdBy: admin.account._id,
  })
  await Story.create({
    authorAccountId: author.account._id,
    title: 'Truyện thật',
    categoryIds: [category._id],
  })
  await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'reader-coins',
    availableBalance: 13,
  })
  await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 9999,
  })
  return {
    admin,
    author,
    reader,
  }
}
it('requires Admin for both list and detail and rejects invalid filters', async () => {
  const f = await fixture()
  expect((await request(app).get('/api/admin/accounts')).status).toBe(401)
  expect((await get(f.reader.cookie, '/api/admin/accounts')).status).toBe(403)
  expect((await get(f.reader.cookie, `/api/admin/accounts/${f.author.account._id}`)).status).toBe(
    403,
  )
  expect((await get(f.admin.cookie, '/api/admin/accounts?sort=arbitrary')).status).toBe(400)
  expect((await get(f.admin.cookie, '/api/admin/accounts?pageSize=999')).status).toBe(400)
  expect((await get(f.admin.cookie, '/api/admin/accounts/not-an-id')).status).toBe(400)
})
it('returns actual totals, roles and distinct reader balances without private model fields', async () => {
  const f = await fixture()
  const response = await get(f.admin.cookie, '/api/admin/accounts?role=author')
  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.body.total).toBe(1)
  expect(response.body.summary).toEqual({
    accounts: 3,
    readers: 1,
    authors: 1,
    moderators: 0,
    admins: 1,
  })
  expect(response.body.items[0]).toMatchObject({
    id: String(f.author.account._id),
    roles: ['author'],
    storyCount: 1,
  })
  expect(JSON.stringify(response.body)).not.toContain('private-retained')
  expect(response.body.items[0]).not.toHaveProperty('authorizationEpoch')
})
it('filters on the server, escapes literal search and returns stable distinct pages', async () => {
  const f = await fixture()
  const query = encodeURIComponent('.* [A]')
  const searched = await get(f.admin.cookie, `/api/admin/accounts?query=${query}`)
  expect(searched.status).toBe(200)
  expect(searched.body.total).toBe(1)
  expect(searched.body.items[0].id).toBe(String(f.author.account._id))
  const a = (await get(f.admin.cookie, '/api/admin/accounts?pageSize=1&page=1')).body
  const b = (await get(f.admin.cookie, '/api/admin/accounts?pageSize=1&page=2')).body
  expect(a.total).toBe(3)
  expect(b.total).toBe(3)
  expect(a.items[0].id).not.toBe(b.items[0].id)
  expect(
    (await get(f.admin.cookie, `/api/admin/accounts?query=${f.reader.account._id}`)).body.items[0]
      .id,
  ).toBe(String(f.reader.account._id))
})
it('sorts by the number of owned stories', async () => {
  const f = await fixture()
  expect(
    (await get(f.admin.cookie, '/api/admin/accounts?sort=stories')).body.items[0].storyCount,
  ).toBe(1)
})
it('reads owned stories and account audit without finance details', async () => {
  const f = await fixture()
  await AuditEvent.create({
    actorType: 'system',
    action: 'account.test-event',
    targetType: 'Account',
    targetId: f.author.account._id,
    result: 'accepted',
    occurredAt: new Date(),
  })
  const response = await get(f.admin.cookie, `/api/admin/accounts/${f.author.account._id}`)
  expect(response.status).toBe(200)
  expect(response.body.stories[0].title).toBe('Truyện thật')
  expect(response.body.audit[0].action).toBe('account.test-event')
  expect(JSON.stringify(response.body)).not.toContain('private-retained')
  expect(response.body.account).not.toHaveProperty('bankDetails')
  expect((await get(f.admin.cookie, '/api/admin/accounts/507f1f77bcf86cd799439011')).status).toBe(
    404,
  )
})
it('does not reveal anonymized emails or active staff labels from inconsistent legacy assignments', async () => {
  const f = await fixture()
  await Account.updateOne(
    {
      _id: f.author.account._id,
    },
    {
      status: 'anonymized',
    },
  )
  const list = (await get(f.admin.cookie, '/api/admin/accounts?status=anonymized')).body
  expect(list.items[0].email).toBeNull()
  expect(list.items[0].roles).toEqual([])
  expect(list.summary.authors).toBe(0)
  expect(
    (await get(f.admin.cookie, `/api/admin/accounts/${f.author.account._id}`)).body.account.email,
  ).toBeNull()
})
