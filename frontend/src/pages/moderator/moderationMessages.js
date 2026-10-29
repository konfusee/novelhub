const errorKeys = {
  claim_held: 'reviewClaims.claimHeld',
  evidence_pending: 'manualReview.evidencePending',
  submission_changed: 'manualReview.changed',
  evidence_changed: 'manualReview.changed',
  content_changed: 'manualReview.changed',
  claim_required: 'manualReview.claimRequired',
  author_unavailable: 'manualReview.authorUnavailable',
  account_changed: 'manualReview.permissionChanged',
  forbidden: 'manualReview.permissionChanged',
}

/** Maps a moderator API error code to the locale key every moderator page shows for it. */
export function moderationErrorKey(code) {
  return Object.hasOwn(errorKeys, code) ? errorKeys[code] : 'manualReview.saveFailed'
}
