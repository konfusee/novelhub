export function terminalEvidenceReady(batch) {
  return (
    !!batch &&
    ((batch.status === 'available-for-human-review' && batch.stage === 'llm') ||
      (batch.status === 'failed' && ['embedding', 'comparison', 'llm'].includes(batch.failedStage)))
  )
}

/** Evidence state shown to Moderators: processing, ready or failed (UC-MOD-01 step 4). */
export function evidenceState(batch) {
  if (!batch) return 'processing'
  if (!terminalEvidenceReady(batch)) return 'processing'
  return batch.status === 'failed' ? 'failed' : 'ready'
}
