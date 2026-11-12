import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { withTransaction } from '../src/db/connection.js'
import { Account, ProcessingAttempt, PublicationSubmission } from '../src/models/index.js'
import { cancelAuthorWork } from '../src/modules/authoring-publishing/account-lifecycle.js'
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
const detailOf = (moderator, submissionId) =>
  api.get(moderator.cookie, `/api/moderator/submissions/${submissionId}`)
const versionOf = async submissionId => (await PublicationSubmission.findById(submissionId)).version
const tokenOf = async submissionId =>
  String((await PublicationSubmission.findById(submissionId)).claimToken)
const claimWith = (moderator, submissionId, expectedVersion) =>
  api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/claim`, {
    expectedVersion,
  })
const releaseWith = (moderator, submissionId, expectedVersion, claimToken) =>
  api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/release`, {
    expectedVersion,
    claimToken,
  })

describe('moderator review queue', () => {
  it('defaults the claim TTL to 24 hours from .env.example', () => {
    expect(testConfig().moderationClaimHours).toBe(24)
  })

  it('rejects anonymous callers with 401 and readers or authors with 403', async () => {
    expect((await request(app).get('/api/moderator/submissions')).status).toBe(401)
    const reader = await authenticatedAccount()
    const author = await authenticatedAccount('author')
    const moderator = await authenticatedAccount('moderator')
    expect((await list(reader, 'available')).status).toBe(403)
    expect((await list(author, 'available')).status).toBe(403)
    const allowed = await list(moderator, 'available')
    expect(allowed.status).toBe(200)
    expect(allowed.body).toMatchObject({ view: 'available', items: [], total: 0, page: 1 })
    expect((await api.get(moderator.cookie, '/api/moderator/submissions')).body.view).toBe(
      'available',
    )
    for (const query of ['view=queue', 'view=mine&page=0', 'view=available&extra=1'])
      expect(
        (await api.get(moderator.cookie, `/api/moderator/submissions?${query}`)).status,
        query,
      ).toBe(422)
  })

  it('keeps processing submissions read-only and blocks claims until evidence is terminal', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    const processing = await list(moderator, 'processing')
    expect(processing.status).toBe(200)
    expect(processing.body.items).toEqual([
      expect.objectContaining({
        submissionId,
        status: 'validated',
        evidenceStatus: 'processing',
        claimState: 'unclaimed',
      }),
    ])
    expect((await list(moderator, 'available')).body.items).toEqual([])
    // UC-MOD-01 AF2: a processing submission cannot be opened for review.
    const detail = await detailOf(moderator, submissionId)
    expect(detail.body.actions).toEqual({ canClaim: false, canRelease: false, canDecide: false })
    expect(detail.body.evidenceStatus).toBe('processing')
    expect(detail.body.revision).toBeUndefined()
    expect(detail.body.evidence).toBeUndefined()
    const claimed = await claim(api, moderator, submissionId)
    expect(claimed.status).toBe(409)
    expect(claimed.body.error.code).toBe('analysis_running')
  })

  it('lists the waiting age and claim expiry and moves a submission through claim and release', async () => {
    const moderator = await authenticatedAccount('moderator')
    const other = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    await PublicationSubmission.updateOne(
      { _id: submissionId },
      { submittedAt: new Date(Date.now() - 2 * 3600000) },
    )
    const queue = await list(moderator, 'available')
    expect(queue.body.items).toHaveLength(1)
    const [item] = queue.body.items
    expect(item).toMatchObject({
      submissionId,
      targetType: 'story',
      title: 'Truyện chờ kiểm duyệt',
      evidenceStatus: 'ready',
      claimState: 'unclaimed',
      claimExpiresAt: null,
    })
    expect(item.waitingSeconds).toBeGreaterThanOrEqual(2 * 3600)
    expect(item.waitingSeconds).toBeLessThan(2 * 3600 + 60)
    expect(item.claimToken).toBeUndefined()
    expect(item.evidence).toMatchObject({
      status: 'available-for-human-review',
      findingsCount: 0,
      llmStatus: 'pending',
    })
    const version = await versionOf(submissionId)
    const stale = await claimWith(moderator, submissionId, version - 1)
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('submission_changed')
    const claimed = await claimWith(moderator, submissionId, version)
    expect(claimed.status).toBe(200)
    expect(claimed.body.messageId).toBe('SYS-MSG-MOD-01')
    expect(claimed.body.submission).toMatchObject({
      status: 'decision-pending',
      claimState: 'mine',
      claimToken: await tokenOf(submissionId),
    })
    expect(
      Math.abs(new Date(claimed.body.submission.claimExpiresAt) - (Date.now() + 24 * 3600000)),
    ).toBeLessThan(5000)
    // UC-MOD-02 steps 5-6: the claim response carries the package and the stored evidence.
    expect(claimed.body.metadata.title).toBe('Truyện chờ kiểm duyệt')
    expect(claimed.body.evidence.batch.status).toBe('available-for-human-review')
    // AF1: claiming again while holding the live claim takes no new claim.
    const again = await claimWith(moderator, submissionId, 0)
    expect(again.status).toBe(200)
    expect(again.body.submission.claimToken).toBe(claimed.body.submission.claimToken)
    expect((await list(moderator, 'available')).body.items).toEqual([])
    const mine = await list(moderator, 'mine')
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0]).toMatchObject({ submissionId, claimState: 'mine' })
    expect(new Date(mine.body.items[0].claimExpiresAt).getTime()).toBe(
      new Date(claimed.body.submission.claimExpiresAt).getTime(),
    )
    expect(mine.body.items[0].claimToken).toBeUndefined()
    expect((await list(other, 'available')).body.items).toEqual([])
    const otherDetail = await detailOf(other, submissionId)
    expect(otherDetail.body.submission.claimState).toBe('other')
    expect(otherDetail.body.submission.claimToken).toBeUndefined()
    const held = await claim(api, other, submissionId)
    expect(held.status).toBe(409)
    expect(held.body.error.code).toBe('claim_conflict')
    const token = await tokenOf(submissionId)
    const foreignRelease = await releaseWith(
      other,
      submissionId,
      await versionOf(submissionId),
      token,
    )
    expect(foreignRelease.status).toBe(409)
    expect(foreignRelease.body.error.code).toBe('claim_not_held')
    const wrongToken = await releaseWith(
      moderator,
      submissionId,
      await versionOf(submissionId),
      String(submissionId),
    )
    expect(wrongToken.body.error.code).toBe('claim_not_held')
    expect((await releaseWith(moderator, submissionId, 0, token)).body.error.code).toBe(
      'submission_changed',
    )
    expect(
      (
        await api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/release`, {
          expectedVersion: await versionOf(submissionId),
        })
      ).status,
    ).toBe(422)
    const released = await releaseWith(
      moderator,
      submissionId,
      await versionOf(submissionId),
      token,
    )
    expect(released.status).toBe(200)
    expect(released.body).toMatchObject({
      messageId: 'SYS-MSG-MOD-03',
      submission: { status: 'pending-review', claimState: 'unclaimed' },
    })
    expect(released.body.revision).toBeUndefined()
    const stored = await PublicationSubmission.findById(submissionId)
    expect(stored.claimReleaseHistory.at(-1).reason).toBe('released')
    expect(stored.claimOwnerAccountId).toBeUndefined()
    expect(stored.claimToken).toBeUndefined()
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
    const token = await tokenOf(submissionId)
    await PublicationSubmission.updateOne(
      { _id: submissionId },
      { claimExpiresAt: new Date(Date.now() - 1000) },
    )
    const queue = await list(b, 'available')
    expect(queue.body.items).toHaveLength(1)
    expect(queue.body.items[0].claimState).toBe('expired')
    const release = await releaseWith(a, submissionId, await versionOf(submissionId), token)
    expect(release.status).toBe(409)
    expect(release.body.error.code).toBe('claim_not_held')
    const detail = await detailOf(a, submissionId)
    expect(detail.status).toBe(200)
    expect(detail.body.submission.claimState).toBe('expired')
    expect(detail.body.actions).toMatchObject({ canClaim: true, canRelease: false })
    expect(detail.body.revision).toBeUndefined()
    expect((await claimWith(b, submissionId, await versionOf(submissionId))).status).toBe(200)
    const stored = await PublicationSubmission.findById(submissionId)
    expect(stored.claimReleaseHistory[0].reason).toBe('expired')
    expect(String(stored.claimReleaseHistory[0].ownerAccountId)).toBe(String(a.account._id))
    expect(String(stored.claimOwnerAccountId)).toBe(String(b.account._id))
    expect(String(stored.claimToken)).not.toBe(token)
  })

  it('shows only the summary before a claim and the exact package after it, without AI', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    const attempts = await ProcessingAttempt.countDocuments()
    const summary = await detailOf(moderator, submissionId)
    expect(summary.status).toBe(200)
    expect(summary.headers['cache-control']).toBe('private, no-store')
    expect(summary.body).toMatchObject({
      title: 'Truyện chờ kiểm duyệt',
      author: { active: true },
      evidenceStatus: 'ready',
      submission: { status: 'pending-review', type: 'story', claimState: 'unclaimed' },
      actions: { canClaim: true, canRelease: false, canDecide: false },
    })
    for (const field of ['revision', 'rights', 'metadata', 'evidence', 'history', 'media'])
      expect(summary.body[field], field).toBeUndefined()
    expect((await claim(api, moderator, submissionId)).status).toBe(200)
    const detail = await detailOf(moderator, submissionId)
    expect(detail.body.metadata.title).toBe('Truyện chờ kiểm duyệt')
    expect(detail.body.metadata.category).toMatchObject({ name: 'Kỳ ảo', status: 'active' })
    expect(detail.body.revision.version).toEqual(expect.any(Number))
    expect(detail.body.rights.basis).toBe('original')
    expect(detail.body.evidence.batch.status).toBe('available-for-human-review')
    expect(detail.body.evidence.findingsCount).toBe(0)
    expect(detail.body.evidence.maxScore).toBeNull()
    expect(detail.body.evidence.findingsTruncated).toBe(false)
    expect(detail.body.history[0].action).toBe('submitted')
    expect(detail.body.actions).toEqual({ canClaim: false, canRelease: true, canDecide: true })
    expect(await ProcessingAttempt.countDocuments()).toBe(attempts)
    const unknown = await detailOf(moderator, 'a'.repeat(24))
    expect(unknown.status).toBe(404)
    expect((await detailOf(moderator, 'not-an-id')).status).toBe(422)
  })

  it('hides submissions of inactive authors from lists and refuses their claims', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { author, submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    await Account.updateOne({ _id: author.account._id }, { status: 'suspended' })
    expect((await list(moderator, 'available')).body.items).toEqual([])
    const detail = await detailOf(moderator, submissionId)
    expect(detail.body.actions.canClaim).toBe(false)
    expect(detail.body.author.active).toBe(false)
    const claimed = await claim(api, moderator, submissionId)
    expect(claimed.status).toBe(409)
    expect(claimed.body.error.code).toBe('submission_changed')
    await Account.updateOne({ _id: author.account._id }, { status: 'active' })
    const queue = await list(moderator, 'available')
    expect(queue.body.items.map(item => item.submissionId)).toEqual([submissionId])
  })

  it('lets the holder resume a live claim recorded before claim tokens, keeping its expiry', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    expect((await claim(api, moderator, submissionId)).status).toBe(200)
    // The shape the previous code wrote: owner and expiry, no token or acquisition time.
    await PublicationSubmission.updateOne(
      { _id: submissionId },
      { $unset: { claimToken: 1, claimAcquiredAt: 1 } },
    )
    const legacy = await PublicationSubmission.findById(submissionId).lean()
    const summary = await detailOf(moderator, submissionId)
    expect(summary.status).toBe(200)
    expect(summary.body.submission).toMatchObject({
      claimState: 'mine',
      claimResumeRequired: true,
      claimExpiresAt: legacy.claimExpiresAt.toISOString(),
    })
    expect(summary.body.submission.claimToken).toBeUndefined()
    expect(summary.body.actions).toEqual({ canClaim: false, canRelease: false, canDecide: false })
    expect(summary.body.revision).toBeUndefined()
    // A read never adopts the claim.
    const unchanged = await PublicationSubmission.findById(submissionId).lean()
    expect(unchanged.claimToken).toBeUndefined()
    expect(unchanged.version).toBe(legacy.version)

    const resumed = await claimWith(moderator, submissionId, legacy.version)
    expect(resumed.status).toBe(200)
    expect(resumed.body.messageId).toBe('SYS-MSG-MOD-01')
    expect(resumed.body.submission).toMatchObject({
      claimState: 'mine',
      claimResumeRequired: false,
      claimToken: expect.any(String),
      claimExpiresAt: legacy.claimExpiresAt.toISOString(),
    })
    expect(resumed.body.actions).toMatchObject({ canRelease: true, canDecide: true })
    const adopted = await PublicationSubmission.findById(submissionId).lean()
    expect(String(adopted.claimToken)).toBe(resumed.body.submission.claimToken)
    expect(adopted.claimExpiresAt.getTime()).toBe(legacy.claimExpiresAt.getTime())
    expect(adopted.claimAcquiredAt).toBeUndefined()
    expect(adopted.claimVersion).toBe(legacy.claimVersion)

    const decided = await decide(api, moderator, submissionId)
    expect(decided.status).toBe(200)
    expect(decided.body.status).toBe('approved')
  })

  it('clears every claim field when the author work is cancelled and keeps the lease in history', async () => {
    const moderator = await authenticatedAccount('moderator')
    const { author, submissionId } = await submitStory(api)
    await markEvidenceReady(submissionId)
    expect((await claim(api, moderator, submissionId)).status).toBe(200)
    const held = await PublicationSubmission.findById(submissionId).lean()
    const now = new Date()
    await withTransaction(session =>
      cancelAuthorWork({
        accountId: author.account._id,
        actorAccountId: author.account._id,
        session,
        now,
        reason: 'author-role-removed',
      }),
    )
    const cancelled = await PublicationSubmission.findById(submissionId).lean()
    expect(cancelled.status).toBe('cancelled')
    for (const field of ['claimOwnerAccountId', 'claimToken', 'claimAcquiredAt', 'claimExpiresAt'])
      expect(cancelled[field], field).toBeUndefined()
    expect(cancelled.claimVersion).toBe(held.claimVersion + 1)
    expect(cancelled.claimReleaseHistory.at(-1)).toMatchObject({
      ownerAccountId: moderator.account._id,
      claimVersion: held.claimVersion,
      acquiredAt: held.claimAcquiredAt,
      expiresAt: held.claimExpiresAt,
      releasedAt: now,
      reason: 'author-role-removed',
    })
  })
})
