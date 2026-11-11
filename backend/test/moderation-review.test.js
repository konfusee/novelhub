import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, ProcessingAttempt, PublicationSubmission } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import {
  apiClient,
  claim,
  decide,
  markEvidenceReady,
  origin,
  submitStory,
} from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)

const list = (moderator, view) =>
  api.get(moderator.cookie, `/api/moderator/submissions?view=${view}`)
const summary = async moderator => (await api.get(moderator.cookie, '/api/moderator/summary')).body
const versionOf = async submissionId => (await PublicationSubmission.findById(submissionId)).version
const claimWith = (moderator, submissionId, expectedVersion) =>
  api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/claim`, {
    expectedVersion,
  })
const releaseWith = (moderator, submissionId, expectedVersion) =>
  api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/release`, {
    expectedVersion,
  })

describe('moderator review queue', () => {
  it('defaults the claim TTL to 24 hours from .env.example', () => {
    expect(testConfig().moderationClaimHours).toBe(24)
  })

  it('rejects anonymous callers with 401 and readers or authors with 403', async () => {
    expect((await request(app).get('/api/moderator/summary')).status).toBe(401)
    const reader = await authenticatedAccount()
    const author = await authenticatedAccount('author')
    const moderator = await authenticatedAccount('moderator')
    expect((await api.get(reader.cookie, '/api/moderator/summary')).status).toBe(403)
    expect((await api.get(author.cookie, '/api/moderator/summary')).status).toBe(403)
    const allowed = await api.get(moderator.cookie, '/api/moderator/summary')
    expect(allowed.status).toBe(200)
    expect(allowed.body).toEqual({
      queue: 0,
      mine: 0,
      processing: 0,
      decidedToday: 0,
      openReports: 0,
    })
  })

  it('keeps validated submissions in processing and blocks claims until evidence is terminal', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    const processing = await list(moderator, 'processing')
    expect(processing.status).toBe(200)
    expect(processing.body.items).toEqual([
      expect.objectContaining({ id: submissionId, status: 'validated' }),
    ])
    expect((await list(moderator, 'queue')).body.items).toEqual([])
    const claimed = await claim(api, moderator, submissionId)
    expect(claimed.status).toBe(409)
    expect(claimed.body.error.code).toBe('evidence_pending')
    expect((await summary(moderator)).processing).toBe(1)
  })

  it('moves a ready submission through queue, claim and release with version CAS', async () => {
    const moderator = await authenticatedAccount('moderator')
    const other = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    const queue = await list(moderator, 'queue')
    expect(queue.body.items).toHaveLength(1)
    expect(queue.body.items[0].id).toBe(submissionId)
    expect(queue.body.items[0].evidence).toMatchObject({
      status: 'available-for-human-review',
      stage: 'llm',
      findingsCount: 0,
      llmStatus: 'pending',
    })
    const version = await versionOf(submissionId)
    const stale = await claimWith(moderator, submissionId, version - 1)
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('submission_changed')
    const claimed = await claimWith(moderator, submissionId, version)
    expect(claimed.status).toBe(200)
    expect(claimed.body.submission.status).toBe('decision-pending')
    expect(
      Math.abs(new Date(claimed.body.submission.claimExpiresAt) - (Date.now() + 24 * 3600000)),
    ).toBeLessThan(5000)
    expect((await list(moderator, 'queue')).body.items).toEqual([])
    const mine = await list(moderator, 'mine')
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0].id).toBe(submissionId)
    expect(mine.body.items[0].claim.ownedByMe).toBe(true)
    expect(await summary(moderator)).toMatchObject({ queue: 0, mine: 1 })
    const held = await claim(api, other, submissionId)
    expect(held.status).toBe(409)
    expect(held.body.error.code).toBe('claim_held')
    const foreignRelease = await releaseWith(other, submissionId, await versionOf(submissionId))
    expect(foreignRelease.status).toBe(409)
    expect(foreignRelease.body.error.code).toBe('claim_required')
    const released = await releaseWith(moderator, submissionId, await versionOf(submissionId))
    expect(released.status).toBe(200)
    expect(released.body.submission.status).toBe('pending-review')
    const stored = await PublicationSubmission.findById(submissionId)
    expect(stored.claimReleaseHistory.at(-1).reason).toBe('released')
    expect(stored.claimOwnerAccountId).toBeUndefined()
    expect(stored.claimVersion).toBe(2)
  })

  it('admits exactly one of two concurrent claims', async () => {
    const first = await authenticatedAccount('moderator')
    const second = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    const results = await Promise.all([
      claim(api, first, submissionId),
      claim(api, second, submissionId),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 409])
  })

  it('lets another moderator take over an expired claim and records the expiry', async () => {
    const a = await authenticatedAccount('moderator')
    const b = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    expect((await claim(api, a, submissionId)).status).toBe(200)
    await PublicationSubmission.updateOne(
      { _id: submissionId },
      { claimExpiresAt: new Date(Date.now() - 1000) },
    )
    const queue = await list(b, 'queue')
    expect(queue.body.items).toHaveLength(1)
    expect(queue.body.items[0].claim.expired).toBe(true)
    const release = await releaseWith(a, submissionId, await versionOf(submissionId))
    expect(release.status).toBe(409)
    expect(release.body.error.code).toBe('claim_required')
    const detail = await api.get(a.cookie, `/api/moderator/submissions/${submissionId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.actions.canRelease).toBe(false)
    expect((await claimWith(b, submissionId, await versionOf(submissionId))).status).toBe(200)
    const stored = await PublicationSubmission.findById(submissionId)
    expect(stored.claimReleaseHistory[0].reason).toBe('expired')
    expect(String(stored.claimReleaseHistory[0].ownerAccountId)).toBe(String(a.account._id))
    expect(String(stored.claimOwnerAccountId)).toBe(String(b.account._id))
  })

  it('returns the exact package, evidence and history without running AI', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    const attempts = await ProcessingAttempt.countDocuments()
    const detail = await api.get(moderator.cookie, `/api/moderator/submissions/${submissionId}`)
    expect(detail.status).toBe(200)
    expect(detail.headers['cache-control']).toBe('private, no-store')
    expect(detail.body.metadata.title).toBe('Truyện chờ kiểm duyệt')
    expect(detail.body.metadata.category).toMatchObject({ name: 'Kỳ ảo', status: 'active' })
    expect(detail.body.rights.basis).toBe('original')
    expect(detail.body.evidence.batch.status).toBe('available-for-human-review')
    expect(detail.body.evidence.findingsCount).toBe(0)
    expect(detail.body.evidence.maxScore).toBeNull()
    expect(detail.body.evidence.findingsTruncated).toBe(false)
    expect(detail.body.history[0].action).toBe('submitted')
    expect(detail.body.actions.canClaim).toBe(true)
    expect(await ProcessingAttempt.countDocuments()).toBe(attempts)
    const unknown = await api.get(moderator.cookie, `/api/moderator/submissions/${'a'.repeat(24)}`)
    expect(unknown.status).toBe(404)
    expect((await api.get(moderator.cookie, '/api/moderator/submissions/not-an-id')).status).toBe(
      400,
    )
  })

  it('lists decisions for everyone or only mine with outcome filters', async () => {
    const a = await authenticatedAccount('moderator')
    const b = await authenticatedAccount('moderator')
    const approved = await submitStory(api)
    const rejected = await submitStory(api)
    await markEvidenceReady(approved.submissionId)
    await markEvidenceReady(rejected.submissionId)
    expect((await claim(api, a, approved.submissionId)).status).toBe(200)
    expect((await decide(api, a, approved.submissionId)).status).toBe(200)
    expect((await claim(api, b, rejected.submissionId)).status).toBe(200)
    expect(
      (
        await decide(api, b, rejected.submissionId, {
          decision: 'reject',
          feedback: 'Cần sửa phần tóm tắt.',
        })
      ).status,
    ).toBe(200)
    const all = await api.get(a.cookie, '/api/moderator/decisions')
    expect(all.status).toBe(200)
    expect(all.body.total).toBe(2)
    const mine = await api.get(a.cookie, '/api/moderator/decisions?scope=mine')
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0]).toMatchObject({ outcome: 'approved', mine: true })
    const rejections = await api.get(a.cookie, '/api/moderator/decisions?outcome=rejected')
    expect(rejections.body.items).toHaveLength(1)
    expect(rejections.body.items[0].feedback).toBe('Cần sửa phần tóm tắt.')
    expect((await summary(a)).decidedToday).toBe(1)
  })

  it('hides submissions of inactive authors from lists and counts and refuses their claims', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { author, submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    await Account.updateOne({ _id: author.account._id }, { status: 'suspended' })
    expect((await list(moderator, 'queue')).body.items).toEqual([])
    expect((await summary(moderator)).queue).toBe(0)
    const detail = await api.get(moderator.cookie, `/api/moderator/submissions/${submissionId}`)
    expect(detail.body.actions.canClaim).toBe(false)
    const claimed = await claim(api, moderator, submissionId)
    expect(claimed.status).toBe(409)
    expect(claimed.body.error.code).toBe('author_unavailable')
    await Account.updateOne({ _id: author.account._id }, { status: 'active' })
    const queue = await list(moderator, 'queue')
    expect(queue.body.items.map(item => item.id)).toEqual([submissionId])
    expect((await summary(moderator)).queue).toBe(1)
  })
})
