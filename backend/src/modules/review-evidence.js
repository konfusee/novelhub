import { ModerationHistory } from '../models/index.js'

export function terminalEvidenceReady(batch) {
  return (
    !!batch &&
    ((batch.status === 'available-for-human-review' && batch.stage === 'llm') ||
      (batch.status === 'failed' && ['embedding', 'comparison', 'llm'].includes(batch.failedStage)))
  )
}
// A signed human decision is distinct from AI output; pending AI records remain untouched.
export async function approvedReviewEvidence(submission, batch, session) {
  if (terminalEvidenceReady(batch)) return true
  if (!submission || !batch || batch.activeLeaseId || batch.status !== 'pending') return false
  return !!(await ModerationHistory.exists({
    submissionId: submission._id,
    revisionId: submission.revisionId,
    action: 'manual-review.decided',
    outcome: 'approved',
    evidenceBatchId: batch._id,
    evidenceBatchVersion: batch.version,
    beforeStateDigest: submission.packageDigest,
    correlationId: 'manual-review-ai-deferred-v1',
  }).session(session ?? null))
}
