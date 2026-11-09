export function terminalEvidenceReady(batch) {
  return (
    !!batch &&
    ((batch.status === 'available-for-human-review' && batch.stage === 'llm') ||
      (batch.status === 'failed' && ['embedding', 'comparison', 'llm'].includes(batch.failedStage)))
  )
}
