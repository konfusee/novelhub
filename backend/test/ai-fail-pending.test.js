import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { EvidenceBatch, ProcessingAttempt, PublicationSubmission } from '../src/models/index.js'
import { failPendingEvidence } from '../src/modules/ai/fail-pending-evidence.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { apiClient, approvedStory, origin, submitChapter } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const api = apiClient(createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin })))
const log = vi.fn()

async function chapter(moderator) {
  const author = await authenticatedAccount('author')
  const { storyId } = await approvedStory(api, moderator, { author })
  const { submissionId } = await submitChapter(api, { author, storyId })
  const submission = await PublicationSubmission.findById(submissionId)
  return { submissionId, batchId: submission.currentEvidenceBatchId }
}
const statusOf = async submissionId => (await PublicationSubmission.findById(submissionId)).status

describe('operator rollback of pending evidence', () => {
  it('lists pending evidence and changes nothing on a dry run', async () => {
    const moderator = await authenticatedAccount('moderator')
    const rows = [await chapter(moderator), await chapter(moderator)]
    expect(await failPendingEvidence({ dryRun: true, log })).toEqual({ batches: 2, failed: 0 })
    for (const row of rows) {
      expect(await statusOf(row.submissionId)).toBe('validated')
      expect((await EvidenceBatch.findById(row.batchId)).status).toBe('pending')
    }
    expect(await ProcessingAttempt.countDocuments()).toBe(0)
  })

  it('fails every non-terminal batch to manual review and closes active leases', async () => {
    const moderator = await authenticatedAccount('moderator')
    const pending = await chapter(moderator)
    const leased = await chapter(moderator)
    const ready = await chapter(moderator)
    const leasedBatch = await EvidenceBatch.findById(leased.batchId)
    const live = await ProcessingAttempt.create({
      batchId: leasedBatch._id,
      revisionId: leasedBatch.revisionId,
      stage: 'llm',
      attemptKey: leasedBatch._id + ':llm:1',
      leaseId: 'live-lease',
      claimVersion: 1,
      leaseExpiresAt: new Date(Date.now() + 300000),
      provider: 'openai',
      status: 'started',
    })
    await EvidenceBatch.updateOne(
      { _id: leased.batchId },
      { $set: { status: 'discovery-complete', stage: 'llm', activeLeaseId: 'live-lease' } },
    )
    await EvidenceBatch.updateOne(
      { _id: ready.batchId },
      { $set: { status: 'available-for-human-review', stage: 'llm' } },
    )
    const readyBefore = await EvidenceBatch.findById(ready.batchId).lean()
    const result = await failPendingEvidence({ log })
    expect(result).toMatchObject({ batches: 2, failed: 2, moved: 2, conflicts: 0 })
    for (const [row, failedStage] of [
      [pending, 'embedding'],
      [leased, 'llm'],
    ]) {
      const batch = await EvidenceBatch.findById(row.batchId)
      expect(batch.status).toBe('failed')
      expect(batch.failedStage).toBe(failedStage)
      expect(batch.activeLeaseId).toBeUndefined()
      expect(
        await ProcessingAttempt.countDocuments({
          batchId: row.batchId,
          failureCode: 'operator-disabled',
        }),
      ).toBe(1)
      expect(await statusOf(row.submissionId)).toBe('pending-review')
    }
    expect((await ProcessingAttempt.findById(live._id)).status).toBe('stale')
    expect(await EvidenceBatch.findById(ready.batchId).lean()).toEqual(readyBefore)
  })

  it('leaves cancelled submissions and rejects a bad reason', async () => {
    const moderator = await authenticatedAccount('moderator')
    const cancelled = await chapter(moderator)
    await PublicationSubmission.updateOne(
      { _id: cancelled.submissionId, status: 'validated' },
      { $set: { status: 'cancelled' }, $inc: { version: 1 } },
    )
    const before = await EvidenceBatch.findById(cancelled.batchId).lean()
    expect(await failPendingEvidence({ log })).toMatchObject({ batches: 0, failed: 0 })
    expect(await EvidenceBatch.findById(cancelled.batchId).lean()).toEqual(before)
    expect(await ProcessingAttempt.countDocuments()).toBe(0)
    await expect(failPendingEvidence({ reason: 'Bad Reason', log })).rejects.toThrow(
      /Invalid --reason/,
    )
  })
})
