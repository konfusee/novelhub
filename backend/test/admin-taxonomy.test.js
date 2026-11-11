import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { AuditEvent, Category, Story } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const path = '/api/admin/taxonomy/categories'
const body = { name: 'Kỳ ảo', sortKey: 2, reason: 'Bổ sung thể loại' }
const write = (cookie, input, url = path, method = 'post') =>
  request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(input)
it('creates, renames, retires and restores categories without rewriting story references', async () => {
  const admin = await authenticatedAccount('admin')
  const author = await authenticatedAccount('author')
  const created = await write(admin.cookie, body)
  expect(created.status).toBe(201)
  let category = created.body.category
  const story = await Story.create({
    title: 'Truyện',
    authorAccountId: author.account._id,
    categoryId: category.id,
  })
  const before = await Story.findById(story._id).lean()
  const list = await request(app).get(path).set('Cookie', admin.cookie)
  expect(list.body.items[0].storyCount).toBe(1)
  for (const status of ['retired', 'active']) {
    const changed = await write(
      admin.cookie,
      {
        name: 'Kỳ ảo mới',
        sortKey: 0,
        status,
        expectedVersion: category.version,
        reason: 'Kiểm tra vòng đời',
      },
      `${path}/${category.id}`,
      'put',
    )
    expect(changed.status).toBe(200)
    category = changed.body.category
    const genres = await request(app).get(path).set('Cookie', admin.cookie).query({ status })
    expect(genres.body.items.some(item => item.id === category.id)).toBe(true)
    if (status === 'retired') {
      const draft = await request(app)
        .post('/api/author/stories')
        .set('Cookie', author.cookie)
        .set('Origin', origin)
        .send({ title: 'Truyện mới', description: '', categoryId: category.id })
      expect(draft.status).toBe(400)
    }
  }
  expect(await Story.findById(story._id).lean()).toEqual(before)
  expect(await AuditEvent.countDocuments({ targetId: category.id })).toBe(3)
  const filtered = await request(app)
    .get(path)
    .set('Cookie', admin.cookie)
    .query({ q: 'mới', status: 'active', pageSize: 1 })
  expect(filtered.body.total).toBe(1)
  expect(
    (await request(app).get(path).set('Cookie', admin.cookie).query({ q: '.*' })).body.total,
  ).toBe(0)
})
it('rejects stale concurrent writes, duplicate normalized names and rolls back on audit failure', async () => {
  const admin = await authenticatedAccount('admin')
  const category = (await write(admin.cookie, body)).body.category
  expect((await write(admin.cookie, { ...body, name: 'KỲ ẢO' })).status).toBe(409)
  const input = { ...body, name: 'Tên mới', status: 'retired', expectedVersion: category.version }
  const results = await Promise.all([
    write(admin.cookie, input, `${path}/${category.id}`, 'put'),
    write(admin.cookie, input, `${path}/${category.id}`, 'put'),
  ])
  expect(results.map(result => result.status).sort()).toEqual([200, 409])
  const baseline = await Category.findById(category.id).lean()
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit offline'))
  expect(
    (
      await write(
        admin.cookie,
        { ...input, status: 'active', expectedVersion: baseline.version },
        `${path}/${category.id}`,
        'put',
      )
    ).status,
  ).toBe(500)
  expect(await Category.findById(category.id).lean()).toEqual(baseline)
})
it('requires Admin, valid Origin and strict bounded inputs', async () => {
  expect((await request(app).get(path)).status).toBe(401)
  for (const role of ['reader', 'author', 'moderator']) {
    const user = await authenticatedAccount(role)
    expect((await request(app).get(path).set('Cookie', user.cookie)).status).toBe(403)
  }
  const admin = await authenticatedAccount('admin')
  expect((await request(app).post(path).set('Cookie', admin.cookie).send(body)).status).toBe(403)
  for (const input of [
    { ...body, reason: '' },
    { ...body, sortKey: -1 },
    { ...body, unknown: true },
  ])
    expect((await write(admin.cookie, input)).status).toBe(400)
  expect(
    (await request(app).get(path).set('Cookie', admin.cookie).query({ pageSize: 51 })).status,
  ).toBe(400)
})
