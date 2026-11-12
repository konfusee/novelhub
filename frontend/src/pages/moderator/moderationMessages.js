const errorKeys = {
  claim_conflict: 'reviewClaims.claimHeld',
  claim_not_held: 'manualReview.claimRequired',
  analysis_running: 'manualReview.evidencePending',
  submission_changed: 'manualReview.changed',
  forbidden: 'manualReview.permissionChanged',
  validation_error: 'manualReview.invalid',
  not_found: 'manualReview.notFound',
}

/** Maps a moderator API error code to the locale key every submission page shows for it. */
export function moderationErrorKey(code) {
  return Object.hasOwn(errorKeys, code) ? errorKeys[code] : 'manualReview.saveFailed'
}

/** Locale key and values of a waiting age in whole days, hours and minutes (UC-MOD-01). */
export function waitingAge(seconds) {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return ['reviewClaims.age.days', { days, hours: hours % 24 }]
  if (hours > 0) return ['reviewClaims.age.hours', { hours, minutes: minutes % 60 }]
  return ['reviewClaims.age.minutes', { minutes }]
}
