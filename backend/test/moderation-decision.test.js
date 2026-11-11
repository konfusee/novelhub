import mongoose from 'mongoose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  Notification,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import {
  apiClient,
  approvedStory,
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
afterEach(() => vi.restoreAllMocks())
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)

async function readyAndClaimed(moderator, submissionId) {
  const ready = await markEvidenceReady(submissionId)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  return ready
}
async function decisionBody(submissionId, overrides = {}) {
  const submission = await PublicationSubmission.findById(submissionId)
  const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
  return {
    decision: 'reject',
    feedback: 'Cần chỉnh sửa nội dung.',
    expectedVersion: submission.version,
    evidenceBatchId: String(batch._id),
    evidenceBatchVersion: batch.version,
    ...overrides,
  }
}
const decideWith = (moderator, submissionId, body) =>
  api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/decision`, body)
const expectError = (response, status, code) => {
  expect(response.status).toBe(status)
  expect(response.body.error.code).toBe(code)
}
const reject = (moderator, submissionId, feedback = 'Cần chỉnh sửa nội dung.') =>
  decide(api, moderator, submissionId, { decision: 'reject', feedback })

describe('moderator decisions', () => {
  it('approves a story, unfreezes it and leaves the release gates satisfiable', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await submitStory(api)
    const { batch } = await readyAndClaimed(moderator, f.submissionId)
    expect((await decide(api, moderator, f.submissionId)).status).toBe(200)
    const submission = await PublicationSubmission.findById(f.submissionId)
    expect(submission.status).toBe('approved')
    expect(submission.claimOwnerAccountId).toBeUndefined()
    expect(submission.claimReleaseHistory.at(-1).reason).toBe('decided')
    expect((await ContentRevision.findById(submission.revisionId)).status).toBe('approved')
    const story = await Story.findById(f.storyId)
    expect(story.authoringFrozen).toBe(false)
    expect(story.publicationStatus).toBe('approved')
    const history = await ModerationHistory.find({ action: 'manual-review.decided' })
    expect(history).toHaveLength(1)
    expect(history[0].outcome).toBe('approved')
    expect(String(history[0].evidenceBatchId)).toBe(String(batch._id))
    expect(history[0].evidenceBatchVersion).toBe(batch.version)
    expect(history[0].beforeStateDigest).toBe(submission.packageDigest)
    const audit = await AuditEvent.find({ action: 'publication.decided' })
    expect(audit).toHaveLength(1)
    expect(audit[0].result).toBe('approved')
    const path = `/api/author/stories/${f.storyId}/release`
    const release = await api.get(f.author.cookie, path)
    expect(release.body.ready).toBe(true)
    const { target } = release.body
    expect(
      (
        await api.write(f.author.cookie, path, {
          revisionId: target.revisionId,
          submissionId: target.submissionId,
          expectedVersion: target.version,
        })
      ).status,
    ).toBe(201)
  })

  it('rejects a never-published story with a fresh draft that revise replays', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await submitStory(api)
    await readyAndClaimed(moderator, f.submissionId)
    const feedback = 'Cần làm rõ phần tóm tắt.'
    expect((await reject(moderator, f.submissionId, feedback)).status).toBe(200)
    const submission = await PublicationSubmission.findById(f.submissionId)
    expect(submission.status).toBe('rejected')
    expect(submission.decisionSummary).toBe(feedback)
    const old = await ContentRevision.findById(submission.revisionId)
    expect(old.status).toBe('rejected')
    expect(old.immutableAt).toBeTruthy()
    const story = await Story.findById(f.storyId)
    const draft = await ContentRevision.findById(story.draftRevisionId)
    expect(draft.status).toBe('editable')
    expect(String(draft.parentRevisionId)).toBe(String(old._id))
    expect(story.authoringFrozen).toBe(false)
    expect(story.publicationStatus).toBe('draft')
    const list = await api.get(f.author.cookie, '/api/author/submissions')
    const item = list.body.items.find(row => row.id === f.submissionId)
    expect(item.canRevise).toBe(true)
    expect(item.history).toContainEqual(
      expect.objectContaining({ action: 'manual-review.decided', feedback }),
    )
    const revised = await api.write(
      f.author.cookie,
      `/api/author/submissions/${f.submissionId}/revise`,
      { expectedVersion: submission.version },
    )
    expect(revised.status).toBe(200)
    expect(revised.body.revision.id).toBe(String(draft._id))
    expect(await ContentRevision.countDocuments({ storyId: f.storyId })).toBe(2)
  })

  it('rejects a previously published story to unpublished', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await submitStory(api)
    await readyAndClaimed(moderator, f.submissionId)
    const before = await Story.findById(f.storyId)
    before.publishedRevisionId = new mongoose.Types.ObjectId()
    await before.save()
    expect((await reject(moderator, f.submissionId)).status).toBe(200)
    const story = await Story.findById(f.storyId)
    expect(story.publicationStatus).toBe('unpublished')
    expect(story.authoringFrozen).toBe(false)
  })

  it('rejects a currently published story without changing its publication status', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await submitStory(api)
    await readyAndClaimed(moderator, f.submissionId)
    const before = await Story.findById(f.storyId)
    before.publicationStatus = 'published'
    before.publishedRevisionId = new mongoose.Types.ObjectId()
    await before.save()
    expect((await reject(moderator, f.submissionId)).status).toBe(200)
    const story = await Story.findById(f.storyId)
    expect(story.publicationStatus).toBe('published')
    expect(story.authoringFrozen).toBe(false)
  })

  it('keeps a role-removal or account-deletion freeze when rejecting a story', async () => {
    const moderator = await authenticatedAccount('moderator')
    for (const result of ['author-role-removed', 'account-deleted']) {
      const f = await submitStory(api)
      await readyAndClaimed(moderator, f.submissionId)
      const before = await Story.findById(f.storyId)
      before.publicationTransition = { result }
      await before.save()
      expect((await reject(moderator, f.submissionId)).status).toBe(200)
      const story = await Story.findById(f.storyId)
      expect(story.authoringFrozen).toBe(true)
      expect(story.publicationStatus).toBe('draft')
    }
  })

  it('approves a chapter without touching the story freeze', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await approvedStory(api, moderator)
    const c = await submitChapter(api, { author: f.author, storyId: f.storyId })
    await readyAndClaimed(moderator, c.submissionId)
    const before = await Story.findById(f.storyId)
    before.authoringFrozen = true
    await before.save()
    expect((await decide(api, moderator, c.submissionId)).status).toBe(200)
    expect((await Chapter.findById(c.chapterId)).status).toBe('approved')
    expect((await Story.findById(f.storyId)).authoringFrozen).toBe(true)
  })

  it('rejects a draft chapter to draft and keeps a published chapter published', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await approvedStory(api, moderator)
    const a = await submitChapter(api, { author: f.author, storyId: f.storyId, title: 'Chương A' })
    const b = await submitChapter(api, { author: f.author, storyId: f.storyId, title: 'Chương B' })
    const draftA = (await Chapter.findById(a.chapterId)).draftRevisionId
    expect((await Chapter.findById(a.chapterId)).status).toBe('submitted')
    await readyAndClaimed(moderator, a.submissionId)
    expect((await reject(moderator, a.submissionId)).status).toBe(200)
    const chapterA = await Chapter.findById(a.chapterId)
    expect(chapterA.status).toBe('draft')
    expect(String(chapterA.draftRevisionId)).not.toBe(String(draftA))
    await readyAndClaimed(moderator, b.submissionId)
    const publishedRevisionId = new mongoose.Types.ObjectId()
    const firstReleasedAt = new Date('2026-01-02T03:04:05.000Z')
    const before = await Chapter.findById(b.chapterId)
    const draftB = before.draftRevisionId
    before.status = 'published'
    before.publishedRevisionId = publishedRevisionId
    before.firstReleasedAt = firstReleasedAt
    await before.save()
    expect((await reject(moderator, b.submissionId)).status).toBe(200)
    const chapterB = await Chapter.findById(b.chapterId)
    expect(chapterB.status).toBe('published')
    expect(String(chapterB.publishedRevisionId)).toBe(String(publishedRevisionId))
    expect(chapterB.firstReleasedAt.getTime()).toBe(firstReleasedAt.getTime())
    expect(String(chapterB.draftRevisionId)).not.toBe(String(draftB))
    expect((await ContentRevision.findById(chapterB.draftRevisionId)).status).toBe('editable')
  })

  it('rejects an unpublished chapter to draft and keeps its release history', async () => {
    const moderator = await authenticatedAccount('moderator')
    const f = await approvedStory(api, moderator)
    const c = await submitChapter(api, { author: f.author, storyId: f.storyId })
    await readyAndClaimed(moderator, c.submissionId)
    const publishedRevisionId = new mongoose.Types.ObjectId()
    const firstReleasedAt = new Date('2026-01-02T03:04:05.000Z')
    const before = await Chapter.findById(c.chapterId)
    before.status = 'unpublished'
    before.publishedRevisionId = publishedRevisionId
    before.firstReleasedAt = firstReleasedAt
    await before.save()
    expect((await reject(moderator, c.submissionId)).status).toBe(200)
    const chapter = await Chapter.findById(c.chapterId)
    expect(chapter.status).toBe('draft')
    expect(String(chapter.publishedRevisionId)).toBe(String(publishedRevisionId))
    expect(chapter.firstReleasedAt.getTime()).toBe(firstReleasedAt.getTime())
  })

  it('requires feedback for rejection and a strict body', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await readyAndClaimed(moderator, submissionId)
    expectError(await reject(moderator, submissionId, ''), 400, 'validation_error')
    expectError(
      await decideWith(moderator, submissionId, await decisionBody(submissionId, { extra: true })),
      400,
      'validation_error',
    )
    expectError(
      await decideWith(
        moderator,
        submissionId,
        await decisionBody(submissionId, { feedback: 'a'.repeat(4001) }),
      ),
      400,
      'validation_error',
    )
    expect((await PublicationSubmission.findById(submissionId)).status).toBe('decision-pending')
  })

  it('refuses decisions without an own unexpired claim', async () => {
    const a = await authenticatedAccount('moderator')
    const b = await authenticatedAccount('moderator')
    const reader = await authenticatedAccount()
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    expectError(await decide(api, a, submissionId), 409, 'claim_required')
    expect((await claim(api, a, submissionId)).status).toBe(200)
    expectError(await decide(api, b, submissionId), 409, 'claim_required')
    await PublicationSubmission.updateOne(
      { _id: submissionId },
      { claimExpiresAt: new Date(Date.now() - 1000) },
    )
    expectError(await decide(api, a, submissionId), 409, 'claim_required')
    expect((await decide(api, reader, submissionId)).status).toBe(403)
  })

  it('refuses stale submission or evidence versions and terminal submissions', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    const { batch } = await readyAndClaimed(moderator, submissionId)
    const body = await decisionBody(submissionId)
    expectError(
      await decideWith(moderator, submissionId, {
        ...body,
        expectedVersion: body.expectedVersion - 1,
      }),
      409,
      'submission_changed',
    )
    expectError(
      await decideWith(moderator, submissionId, {
        ...body,
        evidenceBatchVersion: body.evidenceBatchVersion + 1,
      }),
      409,
      'evidence_changed',
    )
    expectError(
      await decideWith(moderator, submissionId, {
        ...body,
        evidenceBatchId: String(new mongoose.Types.ObjectId()),
      }),
      409,
      'evidence_changed',
    )
    await EvidenceBatch.updateOne({ _id: batch._id }, { status: 'pending' })
    expectError(await decideWith(moderator, submissionId, body), 409, 'evidence_changed')
    await EvidenceBatch.updateOne({ _id: batch._id }, { status: 'available-for-human-review' })
    expect((await decide(api, moderator, submissionId)).status).toBe(200)
    expectError(await decide(api, moderator, submissionId), 409, 'submission_changed')
  })

  it('refuses decisions when the author is inactive or no longer an author', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { author, submissionId } = await submitStory(api)
    await readyAndClaimed(moderator, submissionId)
    await Account.updateOne({ _id: author.account._id }, { status: 'suspended' })
    expectError(await decide(api, moderator, submissionId), 409, 'author_unavailable')
    await Account.updateOne({ _id: author.account._id }, { status: 'active' })
    await RoleAssignment.updateOne(
      { accountId: author.account._id, role: 'author' },
      { status: 'revoked' },
    )
    expectError(await decide(api, moderator, submissionId), 409, 'author_unavailable')
  })

  it('refuses decisions when the reviewed revision is no longer current', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { storyId, submissionId } = await submitStory(api)
    await readyAndClaimed(moderator, submissionId)
    await Story.updateOne({ _id: storyId }, { draftRevisionId: new mongoose.Types.ObjectId() })
    expectError(await decide(api, moderator, submissionId), 409, 'content_changed')
  })

  it('commits exactly one decision under concurrent requests and one notification', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { author, submissionId } = await submitStory(api)
    await readyAndClaimed(moderator, submissionId)
    const feedback = 'Cần bổ sung phần mở đầu.'
    const results = await Promise.all([
      reject(moderator, submissionId, feedback),
      reject(moderator, submissionId, feedback),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 409])
    expect(
      await Notification.countDocuments({
        sourceEventKey: 'publication-submission:' + submissionId + ':decided',
      }),
    ).toBe(1)
    expect(await ModerationHistory.countDocuments({ action: 'manual-review.decided' })).toBe(1)
    const notifications = await api.get(author.cookie, '/api/reader/notifications')
    expect(notifications.status).toBe(200)
    const [first] = notifications.body.items
    expect(first.title.startsWith('Cần chỉnh sửa:')).toBe(true)
    expect(first.description).toBe(feedback)
    expect(first.href).toBe('/author/submissions')
    expect(first.action).toBe('Xem kết quả')
  })

  it('rolls back the whole decision when the notification write fails', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { storyId, submissionId } = await submitStory(api)
    await readyAndClaimed(moderator, submissionId)
    const before = await PublicationSubmission.findById(submissionId)
    vi.spyOn(Notification, 'findOneAndUpdate').mockRejectedValueOnce(
      new Error('notification unavailable'),
    )
    expect((await reject(moderator, submissionId)).status).toBe(500)
    const submission = await PublicationSubmission.findById(submissionId)
    expect(submission.status).toBe('decision-pending')
    expect(submission.version).toBe(before.version)
    expect((await ContentRevision.findById(submission.revisionId)).status).toBe('submitted')
    expect((await Story.findById(storyId)).authoringFrozen).toBe(true)
    expect(await ModerationHistory.countDocuments({ action: 'manual-review.decided' })).toBe(0)
    expect(await ContentRevision.countDocuments({ storyId })).toBe(1)
  })

  it('no longer accepts the legacy AI-deferred history as release evidence', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { author, storyId, submissionId } = await submitStory(api)
    const submission = await PublicationSubmission.findById(submissionId)
    submission.status = 'approved'
    await submission.save()
    const revision = await ContentRevision.findById(submission.revisionId)
    revision.status = 'approved'
    await revision.save()
    const story = await Story.findById(storyId)
    story.publicationStatus = 'approved'
    story.authoringFrozen = false
    await story.save()
    const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
    expect(batch.status).toBe('pending')
    expect(batch.activeLeaseId).toBeUndefined()
    await ModerationHistory.create({
      aggregateType: 'story',
      aggregateId: storyId,
      action: 'manual-review.decided',
      outcome: 'approved',
      submissionId,
      revisionId: submission.revisionId,
      evidenceBatchId: batch._id,
      evidenceBatchVersion: batch.version,
      beforeStateDigest: submission.packageDigest,
      correlationId: 'manual-review-ai-deferred-v1',
      actorAccountId: moderator.account._id,
    })
    const release = await api.get(author.cookie, `/api/author/stories/${storyId}/release`)
    expect(release.status).toBe(200)
    expect(release.body.ready).toBe(false)
    expect(release.body.checks.find(check => check.code === 'evidence').ok).toBe(false)
  })
})
