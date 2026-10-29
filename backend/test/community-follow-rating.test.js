import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Follow, Rating, Story } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { publishedStory } from './fixtures/community.js'
import { apiClient, origin } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)

describe('community follows', () => {
  it('toggles a follow idempotently and reports the active follower count', async () => {
    const { storyId } = await publishedStory()
    const [first, second] = [await authenticatedAccount(), await authenticatedAccount()]
    const url = `/api/community/stories/${storyId}/follow`
    const follow = (reader, following) => api.write(reader.cookie, url, { following }, 'put')

    expect((await follow(first, true)).body).toEqual({ following: true, followers: 1 })
    expect((await follow(first, true)).body).toEqual({ following: true, followers: 1 })
    expect((await follow(second, true)).body).toEqual({ following: true, followers: 2 })
    expect((await follow(first, false)).body).toEqual({ following: false, followers: 1 })
    const removed = await Follow.findOne({ accountId: first.account._id })
    expect(removed.status).toBe('removed')
    expect(removed.removedAt).toBeInstanceOf(Date)
    expect((await follow(first, true)).body).toEqual({ following: true, followers: 2 })
    expect(await Follow.countDocuments({ accountId: first.account._id })).toBe(1)
    const card = (await request(app).get(`/api/catalog/stories?pageSize=5`)).body.items[0]
    expect(card.followers).toBe(2)
  })

  it('requires a session and a published story', async () => {
    const { storyId } = await publishedStory()
    const reader = await authenticatedAccount()
    const guest = await request(app)
      .put(`/api/community/stories/${storyId}/follow`)
      .set('Origin', origin)
      .send({ following: true })
    expect(guest.status).toBe(401)
    await Story.updateOne({ _id: storyId }, { publicationStatus: 'unpublished' })
    const hidden = await api.write(
      reader.cookie,
      `/api/community/stories/${storyId}/follow`,
      { following: true },
      'put',
    )
    expect(hidden.status).toBe(404)
    expect(
      (
        await api.write(
          reader.cookie,
          '/api/community/stories/nope/follow',
          { following: true },
          'put',
        )
      ).status,
    ).toBe(400)
  })
})

describe('community ratings', () => {
  it('keeps one rating per reader, updates the average and removes it', async () => {
    const { storyId } = await publishedStory()
    const [first, second] = [await authenticatedAccount(), await authenticatedAccount()]
    const url = `/api/community/stories/${storyId}/rating`
    const rate = (reader, value) => api.write(reader.cookie, url, { value }, 'put')

    expect((await rate(first, 5)).body).toEqual({ value: 5, average: 5, count: 1 })
    expect((await rate(second, 2)).body).toEqual({ value: 2, average: 3.5, count: 2 })
    expect((await rate(first, 4)).body).toEqual({ value: 4, average: 3, count: 2 })
    expect(await Rating.countDocuments({ storyId })).toBe(2)
    const removed = await api.write(first.cookie, url, undefined, 'delete')
    expect(removed.body).toEqual({ value: null, average: 2, count: 1 })
    expect((await Rating.findOne({ accountId: first.account._id })).status).toBe('removed')
    expect((await api.write(second.cookie, url, undefined, 'delete')).body).toEqual({
      value: null,
      average: null,
      count: 0,
    })
    expect((await rate(first, 1)).body).toEqual({ value: 1, average: 1, count: 1 })
    expect(await Rating.countDocuments({ accountId: first.account._id })).toBe(1)
    for (const value of [0, 6, 2.5, '3'])
      expect((await rate(first, value)).status, String(value)).toBe(400)
  })
})
