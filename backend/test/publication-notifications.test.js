import { expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Follow,
  Notification,
  NotificationOutbox,
  PublicationSubmission,
  Story,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import {
  apiClient,
  claim,
  decide,
  markEvidenceReady,
  origin,
  submitChapter,
  submitStory,
} from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)
const feed = account => api.get(account.cookie, '/api/reader/notifications')

it('routes submitted work to the moderation queue but currently does not notify moderators', async () => {
  const moderator = await authenticatedAccount('moderator')
  const { author, submissionId } = await submitStory(api)
  const processing = await api.get(moderator.cookie, '/api/moderator/submissions?view=processing')
  expect(processing.status).toBe(200)
  expect(processing.body.items.map(row => row.submissionId)).toContain(submissionId)
  await markEvidenceReady(submissionId) // Isolated AI terminal fixture; no paid provider calls.
  const queue = await api.get(moderator.cookie, '/api/moderator/submissions?view=available')
  expect(queue.body.items.map(row => row.submissionId)).toContain(submissionId)
  expect((await feed(moderator)).body.items).toEqual([])
  expect((await feed(author)).body.items).toEqual([])
})

it.each(['approve', 'reject'])(
  'notifies only the author after %s and queues one email',
  async outcome => {
    const moderator = await authenticatedAccount('moderator')
    const unrelated = await authenticatedAccount('author')
    const { author, submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    expect((await claim(api, moderator, submissionId)).status).toBe(200)
    const feedback =
      outcome === 'reject' ? 'Cần làm rõ phần mô tả trước khi gửi lại.' : 'Nội dung đủ điều kiện.'
    const result = await decide(api, moderator, submissionId, { outcome, feedback })
    expect(result.status).toBe(200)
    const response = await feed(author)
    expect(response.body.unreadCount).toBe(1)
    expect(response.body.items).toEqual([
      expect.objectContaining({
        title: `${outcome === 'approve' ? 'Đã duyệt' : 'Cần chỉnh sửa'}: Truyện chờ kiểm duyệt`,
        body: feedback,
        type: 'author',
        href: '/author/submissions',
        action: 'Xem kết quả',
        unread: true,
      }),
    ])
    expect(
      (await api.get(author.cookie, '/api/reader/notifications/unread-count')).body.count,
    ).toBe(1)
    expect((await feed(unrelated)).body.items).toEqual([])
    expect((await feed(moderator)).body.items).toEqual([])
    const stored = await Notification.findOne({
      eventType: 'publication.decided',
      recipientAccountId: author.account._id,
    })
    expect(
      await NotificationOutbox.countDocuments({ notificationId: stored._id, channel: 'email' }),
    ).toBe(1)
    expect((await decide(api, moderator, submissionId, { outcome, feedback })).status).toBe(409)
    expect(await Notification.countDocuments({ eventType: 'publication.decided' })).toBe(1)
  },
)

it('notifies the author on chapter approval and followers only when the chapter is actually published', async () => {
  const moderator = await authenticatedAccount('moderator')
  const follower = await authenticatedAccount()
  const { author, submissionId, storyId } = await submitStory(api, {
    title: 'Hành trình dưới ánh sao',
  })
  await markEvidenceReady(submissionId)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  expect((await decide(api, moderator, submissionId)).status).toBe(200)
  const story = await Story.findById(storyId)
  const submission = await PublicationSubmission.findById(submissionId)
  expect(
    (
      await api.write(author.cookie, `/api/author/stories/${storyId}/release`, {
        revisionId: String(submission.revisionId),
        submissionId,
        expectedVersion: story.version,
      })
    ).status,
  ).toBe(201)
  await Follow.create({ accountId: follower.account._id, storyId })
  const chapter = await submitChapter(api, { author, storyId, title: 'Chương mở đầu' })
  await markEvidenceReady(chapter.submissionId)
  expect((await claim(api, moderator, chapter.submissionId)).status).toBe(200)
  expect((await decide(api, moderator, chapter.submissionId)).status).toBe(200)
  expect((await feed(author)).body.items).toHaveLength(2)
  expect((await feed(author)).body.items[0].title).toBe('Đã duyệt: Chương mở đầu')
  expect((await feed(follower)).body.items).toEqual([])
  const releasePath = `/api/author/stories/${storyId}/chapters/${chapter.chapterId}/release`
  const { target } = (await api.get(author.cookie, releasePath)).body
  expect(
    (
      await api.write(author.cookie, releasePath, {
        revisionId: target.revisionId,
        submissionId: target.submissionId,
        expectedVersion: target.version,
        expectedStoryVersion: target.storyVersion,
      })
    ).status,
  ).toBe(201)
  expect((await feed(follower)).body.items).toEqual([
    expect.objectContaining({
      title: 'Chương mới: Hành trình dưới ánh sao – Chương mở đầu',
      href: `/read/${storyId}/${chapter.chapterId}`,
    }),
  ])
})

it('rolls back a moderation decision if its author notification cannot be stored', async () => {
  const moderator = await authenticatedAccount('moderator')
  const { submissionId } = await submitStory(api)
  await markEvidenceReady(submissionId)
  await claim(api, moderator, submissionId)
  const before = await PublicationSubmission.findById(submissionId).lean()
  const failure = vi
    .spyOn(Notification, 'findOneAndUpdate')
    .mockRejectedValueOnce(new Error('notification unavailable'))
  try {
    expect((await decide(api, moderator, submissionId)).status).toBe(500)
  } finally {
    failure.mockRestore()
  }
  const after = await PublicationSubmission.findById(submissionId).lean()
  expect(after.status).toBe(before.status)
  expect(after.version).toBe(before.version)
  expect(await Notification.countDocuments()).toBe(0)
  expect((await decide(api, moderator, submissionId)).status).toBe(200)
  expect(await Notification.countDocuments({ eventType: 'publication.decided' })).toBe(1)
})
