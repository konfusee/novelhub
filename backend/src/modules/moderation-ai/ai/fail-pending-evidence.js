import { withTransaction } from '../../../db/connection.js'
import { EvidenceBatch, ProcessingAttempt, PublicationSubmission } from '../../../models/index.js'
import { STAGE_BY_STATUS } from './evidence-worker.js'
import { RUNNER_ID } from './runner-id.js'

const NON_TERMINAL_STATUSES = [
  'pending',
  'embedding-complete',
  'discovery-complete',
  'llm-complete',
]
class BatchChanged extends Error {}

/**
 * Operator rollback: fails every non-terminal evidence batch of a validated submission with
 * `reason` and moves the submission to manual review, so stopping the worker never strands
 * submissions in `validated`. Each batch commits on its own; a concurrently changed batch is
 * skipped and counted as a conflict.
 */
export async function failPendingEvidence({
  reason = 'operator-disabled',
  dryRun = false,
  now = new Date(),
  log = console.log,
} = {}) {
  if (!/^[a-z][a-z-]{2,40}$/.test(reason)) throw new Error('Invalid --reason')
  const submissions = await PublicationSubmission.find({
    status: 'validated',
    currentEvidenceBatchId: { $ne: null },
  })
    .select('_id currentEvidenceBatchId')
    .lean()
  const batches = await EvidenceBatch.find({
    _id: { $in: submissions.map(submission => submission.currentEvidenceBatchId) },
    status: { $in: NON_TERMINAL_STATUSES },
  }).lean()
  log(`Pending evidence: ${batches.length} batches`)
  if (dryRun) {
    log('DRY RUN: nothing was changed.')
    return { batches: batches.length, failed: 0 }
  }
  let failed = 0
  let moved = 0
  let conflicts = 0
  for (const batch of batches) {
    const stage = STAGE_BY_STATUS[batch.status] ?? batch.stage ?? 'llm'
    try {
      moved += await withTransaction(async session => {
        if (batch.activeLeaseId) {
          const active = await ProcessingAttempt.findOne({
            batchId: batch._id,
            leaseId: batch.activeLeaseId,
          })
            .session(session)
            .lean()
          if (active && ['claimed', 'started'].includes(active.status)) {
            await ProcessingAttempt.updateOne(
              { _id: active._id, status: active.status },
              { $set: { status: 'stale', staleAt: now }, $inc: { version: 1 } },
              { session },
            )
          }
        }
        await ProcessingAttempt.create(
          [
            {
              batchId: batch._id,
              revisionId: batch.revisionId,
              stage,
              attemptKey: batch._id + ':' + stage + ':' + reason + ':' + now.getTime(),
              provider: 'operator',
              status: 'failed',
              failureCode: reason,
              startedAt: now,
              finishedAt: now,
              responseMetadata: { runner: RUNNER_ID, costUsd: 0 },
            },
          ],
          { session },
        )
        const closed = await EvidenceBatch.updateOne(
          { _id: batch._id, version: batch.version },
          {
            $set: { status: 'failed', failedStage: stage },
            $unset: { activeLeaseId: 1 },
            $inc: { version: 1 },
          },
          { session },
        )
        if (closed.modifiedCount !== 1) throw new BatchChanged()
        const promoted = await PublicationSubmission.updateOne(
          { _id: batch.submissionId, status: 'validated', currentEvidenceBatchId: batch._id },
          { $set: { status: 'pending-review' }, $inc: { version: 1 } },
          { session },
        )
        return promoted.modifiedCount
      })
      failed += 1
    } catch (error) {
      if (!(error instanceof BatchChanged)) throw error
      conflicts += 1
    }
  }
  log(
    `Failed ${failed} batches with ${reason}; moved ${moved} submissions to pending-review; ${conflicts} conflicts`,
  )
  return { batches: batches.length, failed, moved, conflicts }
}
