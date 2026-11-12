import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, EvidenceBatch, Notification, PublicationSubmission } from '../src/models/index.js'
import { processEvidenceBatches } from '../src/modules/moderation-ai/ai/evidence-worker.js'
import { failPendingEvidence } from '../src/modules/moderation-ai/ai/fail-pending-evidence.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { apiClient, origin, submitStory } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const config = testConfig({ cookieName: 'novelhub_session', corsOrigin: origin })
const api = apiClient(createApp(config))
const log = vi.fn()
const notices = () => Notification.find({ eventType: 'moderation.submission-ready' }).lean()

async function submitted(title) {
  const author = await authenticatedAccount('author')
  const { submissionId } = await submitStory(api, { author, title })
  return { author, submissionId }
}

describe('moderator bell notice for a new reviewable submission', () => {
  it('notifies each active moderator once when the submission becomes claimable', async () => {
    const first = await authenticatedAccount('moderator')
    const second = await authenticatedAccount('moderator')
    const suspended = await authenticatedAccount('moderator')
    await Account.updateOne({ _id: suspended.account._id }, { $set: { status: 'suspended' } })
    const reader = await authenticatedAccount()
    const { submissionId } = await submitted('Hồ sơ cần chuông')

    // Still being analysed: not claimable, so no bell yet.
    expect(await notices()).toHaveLength(0)

    await failPendingEvidence({ log })
    expect((await PublicationSubmission.findById(submissionId)).status).toBe('pending-review')
    const rows = await notices()
    expect(rows.map(row => String(row.recipientAccountId)).sort()).toEqual(
      [String(first.account._id), String(second.account._id)].sort(),
    )
    expect(rows[0]).toMatchObject({
      sourceEventKey: `submission:${submissionId}:ready`,
      payload: { submissionId, targetType: 'story', title: 'Hồ sơ cần chuông' },
    })

    const count = await api.get(first.cookie, '/api/reader/notifications/unread-count')
    expect(count.body).toEqual({ count: 1 })
    const feed = await api.get(first.cookie, '/api/reader/notifications')
    expect(feed.body.items).toEqual([
      expect.objectContaining({
        title: 'Hồ sơ mới chờ kiểm duyệt: Hồ sơ cần chuông',
        type: 'moderation',
        label: 'Kiểm duyệt',
        href: `/moderator/submissions/${submissionId}`,
        action: 'Mở hồ sơ',
        unread: true,
      }),
    ])
    expect((await api.get(reader.cookie, '/api/reader/notifications/unread-count')).body).toEqual({
      count: 0,
    })

    // A repeated sweep finds nothing to promote and adds no duplicate.
    await failPendingEvidence({ log })
    expect(await notices()).toHaveLength(2)
  })

  it('notifies from the evidence worker promotion and skips inactive authors', async () => {
    const moderator = await authenticatedAccount('moderator')
    const ready = await submitted('Bằng chứng xong')
    const hidden = await submitted('Tác giả bị khóa')
    for (const { submissionId } of [ready, hidden]) {
      const { currentEvidenceBatchId } = await PublicationSubmission.findById(submissionId)
      await EvidenceBatch.updateOne(
        { _id: currentEvidenceBatchId },
        { $set: { status: 'available-for-human-review', stage: 'llm' } },
      )
    }
    await Account.updateOne({ _id: hidden.author.account._id }, { $set: { status: 'suspended' } })

    await processEvidenceBatches(config, { providers: {} })
    expect((await PublicationSubmission.findById(ready.submissionId)).status).toBe('pending-review')
    expect(await notices()).toEqual([
      expect.objectContaining({
        recipientAccountId: moderator.account._id,
        payload: expect.objectContaining({ submissionId: ready.submissionId }),
      }),
    ])
  })

  it('leaves no notice when the promotion transaction rolls back', async () => {
    await authenticatedAccount('moderator')
    const { submissionId } = await submitted('Giao dịch hủy')
    const spy = vi.spyOn(Notification, 'findOneAndUpdate').mockRejectedValueOnce(new Error('boom'))
    await expect(failPendingEvidence({ log })).rejects.toThrow('boom')
    spy.mockRestore()
    expect((await PublicationSubmission.findById(submissionId)).status).toBe('validated')
    expect(await notices()).toHaveLength(0)
  })
})
