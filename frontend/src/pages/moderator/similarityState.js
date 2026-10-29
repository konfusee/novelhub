/**
 * Locale key explaining an empty findings list. Fails closed: "no findings" is claimed only for a
 * chapter whose comparison attempt succeeded; processing or failed comparisons stay inconclusive.
 */
export function similarityEmptyState(submission, evidence) {
  if (submission.type === 'story') return 'manualReview.evidence.comparisonSkipped'
  if (
    evidence.attempts.some(
      attempt => attempt.stage === 'comparison' && attempt.status === 'succeeded',
    )
  )
    return 'manualReview.evidence.noFindings'
  return 'manualReview.evidence.comparisonUnavailable'
}
