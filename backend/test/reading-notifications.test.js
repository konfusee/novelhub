import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Follow, Notification } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { readingClient, origin } from './fixtures/reading.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = readingClient(app)

it('notifies each active follower once on first release, never on a revised re-release', async () => {
  const { author, storyId } = await api.publishStory({ title: 'Truyện theo dõi' })
  const follower = await authenticatedAccount()
  const former = await authenticatedAccount()
  await Follow.create([
    { accountId: follower.account._id, storyId },
    { accountId: author.account._id, storyId },
    { accountId: former.account._id, storyId, status: 'removed', removedAt: new Date() },
  ])
  const chapterId = await api.publishChapter(author, storyId, 'Khởi đầu', ['Bản đầu.'])

  const notices = await Notification.find({ eventType: 'story.chapter-released' }).lean()
  expect(notices).toHaveLength(1)
  expect(notices[0]).toMatchObject({
    recipientAccountId: follower.account._id,
    sourceEventKey: `chapter:${chapterId}:released`,
    deliveryState: 'available',
    payload: { storyId, chapterId, title: 'Chương mới: Truyện theo dõi – Khởi đầu' },
  })

  const feed = (await api.get(follower.cookie, '/api/reader/notifications')).body.items
  expect(feed).toEqual([
    expect.objectContaining({
      title: 'Chương mới: Truyện theo dõi – Khởi đầu',
      href: `/read/${storyId}/${chapterId}`,
    }),
  ])

  await api.republishRevision(author, storyId, chapterId, ['Bản sửa.'])
  expect(await Notification.countDocuments({ eventType: 'story.chapter-released' })).toBe(1)
})
