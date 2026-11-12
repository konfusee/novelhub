import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Category,
  Chapter,
  Follow,
  StatisticsEvent,
  Story,
  UnlockEntitlement,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { readingClient, origin } from './fixtures/reading.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = readingClient(app)
const deviceCookie = response =>
  (response.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('novelhub_device='))
    ?.split(';')[0]

describe('chapter reading views', () => {
  it('counts a guest chapter-1 read once per device and day, never a locked preview', async () => {
    const { author, storyId } = await api.publishStory()
    const first = await api.publishChapter(author, storyId, 'Mở đầu', ['Đoạn một.'])
    const second = await api.publishChapter(author, storyId, 'Tiếp theo', ['Đoạn hai.'])
    const url = id => `/api/catalog/stories/${storyId}/chapters/${id}`

    const read = await api.get(null, url(first))
    expect(read.status).toBe(200)
    const cookie = deviceCookie(read)
    expect(cookie).toMatch(/^novelhub_device=[\w-]{32,}$/)
    expect(read.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i)
    expect(read.body.chapter).toMatchObject({
      orderKey: 1,
      story: { id: storyId, title: 'Truyện đọc thử' },
      prev: null,
      next: { id: second, orderKey: 2, title: 'Tiếp theo', locked: false },
      commentCount: 0,
    })

    const again = await api.get(cookie, url(first))
    expect(again.status).toBe(200)
    expect(deviceCookie(again)).toBeUndefined()
    expect(await StatisticsEvent.countDocuments({ eventType: 'view' })).toBe(1)
    const event = await StatisticsEvent.findOne({ eventType: 'view' }).lean()
    expect(event.viewerType).toBe('guest-device')
    expect(event.viewerKey).toMatch(/^[a-f\d]{64}$/)
    expect(event.viewerKey).not.toContain(cookie.split('=')[1])

    expect((await api.get(null, url(first))).status).toBe(200)
    expect(await StatisticsEvent.countDocuments({ eventType: 'view' })).toBe(2)

    const locked = await api.get(cookie, url(second))
    expect(locked.status).toBe(401)
    expect(locked.body.error.code).toBe('authentication_required')
    expect(await StatisticsEvent.countDocuments({ chapterId: second })).toBe(0)
  })

  it('counts a signed-in reader once per chapter and day', async () => {
    const { author, storyId } = await api.publishStory()
    await api.publishChapter(author, storyId, 'Một')
    const second = await api.publishChapter(author, storyId, 'Hai')
    const reader = await authenticatedAccount()
    const url = `/api/catalog/stories/${storyId}/chapters/${second}`
    for (let i = 0; i < 3; i += 1) expect((await api.get(reader.cookie, url)).status).toBe(200)
    const events = await StatisticsEvent.find({ eventType: 'view' }).lean()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      viewerType: 'account',
      viewerKey: String(reader.account._id),
    })
    const read = await api.get(reader.cookie, url)
    expect(deviceCookie(read)).toBeUndefined()
    expect(read.body.chapter.prev).toMatchObject({ orderKey: 1, title: 'Một' })
    expect(read.body.chapter.next).toBeNull()
  })
})

describe('catalogue discovery', () => {
  it('filters by status, sorts by 30-day popularity and searches only title and Author name', async () => {
    const old = await api.publishStory({ title: 'Kiếm khách cổ', authorName: 'Lam Phong' })
    const oldChapter = await api.publishChapter(old.author, old.storyId)
    const hot = await api.publishStory({ title: 'Ngôi sao mới', authorName: 'Bích Hà' })
    const hotChapter = await api.publishChapter(hot.author, hot.storyId)
    await Story.updateOne({ _id: old.storyId }, { completionStatus: 'completed' })
    const longAgo = new Date(Date.now() - 40 * 86400000)
    const view = (storyId, chapterId, key, occurredAt) => ({
      eventType: 'view',
      day: occurredAt,
      sourceEventKey: `test-view-${storyId}-${key}`,
      viewerType: 'account',
      viewerKey: key,
      storyId,
      chapterId,
      occurredAt,
    })
    await StatisticsEvent.create([
      view(old.storyId, oldChapter, 'a', longAgo),
      view(old.storyId, oldChapter, 'b', longAgo),
      view(old.storyId, oldChapter, 'c', longAgo),
      view(hot.storyId, hotChapter, 'a', new Date()),
      // The same reader on another day is still one distinct reader for popularity.
      { ...view(hot.storyId, hotChapter, 'a-again', new Date()), viewerKey: 'a', day: longAgo },
    ])
    const list = query => api.get(null, `/api/catalog/stories?${query}`)

    const popular = (await list('sort=popular')).body.items
    expect(popular.map(item => item.id)).toEqual([hot.storyId, old.storyId])
    expect(popular[0]).toMatchObject({ popularity: 1, reads: '2', followers: 0, ratingCount: 0 })
    expect(popular[1]).toMatchObject({ popularity: 0, reads: '3', status: 'Completed' })
    expect((await list('sort=reads')).status).toBe(400)
    const unknownCategory = await list('category=0123456789abcdef01234567')
    expect(unknownCategory.status).toBe(400)
    expect(unknownCategory.body.error.message).toBe('Thể loại không tồn tại hoặc đã ngừng sử dụng.')

    const completed = await list('status=completed')
    expect(completed.body.items.map(item => item.id)).toEqual([old.storyId])
    expect((await list('status=ongoing')).body.items.map(item => item.id)).toEqual([hot.storyId])

    expect((await list('q=ngôi sao')).body.items.map(item => item.id)).toEqual([hot.storyId])
    expect((await list('q=lam phong')).body.items.map(item => item.id)).toEqual([old.storyId])
    expect((await list('q=mô tả truyện')).body.total).toBe(0)
  })

  it('lists active categories with published story counts', async () => {
    const author = await authenticatedAccount('author')
    const used = await Category.create({
      name: 'Bí ẩn',
      normalizedName: 'bi an',
      sortKey: 2,
      createdBy: author.account._id,
    })
    const empty = await Category.create({
      name: 'Áo choàng',
      normalizedName: 'ao choang',
      sortKey: 1,
      createdBy: author.account._id,
    })
    const retired = await Category.create({
      name: 'Đã bỏ',
      normalizedName: 'da bo',
      status: 'retired',
      createdBy: author.account._id,
    })
    await api.publishStory({ author, category: used })
    const response = await api.get(null, '/api/catalog/categories')
    expect(response.status).toBe(200)
    expect(response.body.items).toEqual([
      { id: String(empty._id), name: 'Áo choàng', storyCount: 0 },
      { id: String(used._id), name: 'Bí ẩn', storyCount: 1 },
    ])
    const filtered = await api.get(null, `/api/catalog/stories?category=${retired._id}`)
    expect(filtered.status).toBe(400)
  })

  it('adds viewer follow, rating and resume state to story detail', async () => {
    const { author, storyId } = await api.publishStory()
    const chapterId = await api.publishChapter(author, storyId, 'Một')
    const guest = await api.get(null, `/api/catalog/stories/${storyId}`)
    expect(guest.body.viewer).toBeNull()
    expect(guest.body.story).toMatchObject({
      status: 'Ongoing',
      ratingCount: 0,
      averageRating: null,
    })
    expect(guest.body.chapters).toEqual([
      expect.objectContaining({ id: chapterId, orderKey: 1, locked: false, earlyAccess: null }),
    ])
    const reader = await authenticatedAccount()
    await Follow.create({ accountId: reader.account._id, storyId })
    expect(
      (
        await api.write(
          reader.cookie,
          '/api/reader/progress',
          { storyId, chapterId, position: 0.4 },
          'put',
        )
      ).status,
    ).toBe(200)
    const signed = await api.get(reader.cookie, `/api/catalog/stories/${storyId}`)
    expect(signed.body.story.followers).toBe(1)
    expect(signed.body.viewer).toMatchObject({
      following: true,
      rating: null,
      resume: { chapterId, position: 0.4, contentUpdated: false, available: true },
    })
  })
})

it('rejects anonymous access to reader endpoints', async () => {
  for (const url of ['/api/reader/library', '/api/reader/history'])
    expect((await request(app).get(url)).status).toBe(401)
})

it('shows an unlocked early-access chapter as readable only to the Reader who bought it', async () => {
  const { author, storyId } = await api.publishStory()
  const first = await api.publishChapter(author, storyId, 'Một')
  const second = await api.publishChapter(author, storyId, 'Hai')
  const endsAt = new Date(Date.now() + 86400000)
  await Chapter.updateOne(
    { _id: second },
    { $set: { earlyAccess: { enabled: true, endsAt, coinPrice: 1000 } } },
  )
  const live = await Chapter.findById(second).lean()
  const buyer = await authenticatedAccount()
  const other = await authenticatedAccount()
  await UnlockEntitlement.create({
    accountId: buyer.account._id,
    storyId,
    chapterId: second,
    publishedRevisionId: live.publishedRevisionId,
    status: 'active',
    purchasedAt: new Date(),
    expiresAt: endsAt,
    priceCoins: 1000,
  })

  const listed = async reader =>
    (await api.get(reader?.cookie, `/api/catalog/stories/${storyId}`)).body.chapters.find(
      chapter => chapter.id === second,
    )
  expect(await listed(buyer)).toMatchObject({ locked: false, unlocked: true })
  expect(await listed(other)).toMatchObject({ locked: true, earlyAccess: { coinPrice: 1000 } })
  expect(await listed(null)).toMatchObject({ locked: true })

  const next = async reader =>
    (await api.get(reader.cookie, `/api/catalog/stories/${storyId}/chapters/${first}`)).body.chapter
      .next
  expect(await next(buyer)).toMatchObject({ id: second, locked: false, unlocked: true })
  expect(await next(other)).toMatchObject({ id: second, locked: true, unlocked: false })
  const opened = await api.get(buyer.cookie, `/api/catalog/stories/${storyId}/chapters/${second}`)
  expect(opened.status).toBe(200)
  expect(opened.body.chapter.prev).toMatchObject({ id: first, locked: false })
})
