import mongoose from 'mongoose'
import { policy } from '../../accounts-administration/service.js'
import { HttpError } from '../../../middleware/errors.js'

/**
 * Claim rules shared by publication submissions and content reports (BR-NEW-S01, SDS ClaimLease).
 * A claim is live while claimExpiresAt > now. These helpers only change or check the in-memory
 * document; the caller saves it in its transaction, so the version CAS admits one writer.
 */

export const claimConflict = () =>
  new HttpError(409, 'claim_conflict', 'Mục này đang được kiểm duyệt viên khác xử lý.')
export const claimNotHeld = () =>
  new HttpError(
    409,
    'claim_not_held',
    'Claim của bạn đã hết hạn hoặc không còn được giữ. Hãy nhận lại trước khi tiếp tục.',
  )

/** unclaimed, mine (live, held by accountId), other (live, held by someone else) or expired. */
export function claimState(doc, accountId, now) {
  if (!doc.claimOwnerAccountId) return 'unclaimed'
  if (!(doc.claimExpiresAt > now)) return 'expired'
  return String(doc.claimOwnerAccountId) === String(accountId) ? 'mine' : 'other'
}

/** Claim duration in hours from the platform policy effective at now (A-UC-15). */
export async function policyTtlHours(config, now, session) {
  const effective = await policy.getEffective({ session, now, required: false })
  return effective?.claimExpiryHours ?? config.moderationClaimHours
}

/** Moves the current claim into claimReleaseHistory and clears it. */
export function endClaim(doc, reason, actorAccountId, now) {
  doc.claimReleaseHistory.push({
    ownerAccountId: doc.claimOwnerAccountId,
    claimVersion: doc.claimVersion,
    acquiredAt: doc.claimAcquiredAt ?? null,
    expiresAt: doc.claimExpiresAt ?? null,
    releasedAt: now,
    reason,
    actorAccountId,
  })
  doc.claimOwnerAccountId = undefined
  doc.claimToken = undefined
  doc.claimAcquiredAt = undefined
  doc.claimExpiresAt = undefined
  doc.claimVersion += 1
}

/**
 * Takes a new claim after the caller's status and version checks. Another live claim is a
 * conflict; an expired one is recorded as expired and replaced.
 */
export function acquireClaim(doc, account, ttlHours, now) {
  const state = claimState(doc, account._id, now)
  if (state === 'other') throw claimConflict()
  if (state === 'expired') endClaim(doc, 'expired', account._id, now)
  doc.claimOwnerAccountId = account._id
  doc.claimToken = new mongoose.Types.ObjectId()
  doc.claimAcquiredAt = now
  doc.claimExpiresAt = new Date(now.getTime() + ttlHours * 3600000)
  doc.claimVersion += 1
}

/** Fails unless the account holds the live claim identified by claimToken. */
export function requireLiveClaim(doc, account, claimToken, now) {
  if (
    claimState(doc, account._id, now) !== 'mine' ||
    !doc.claimToken ||
    String(doc.claimToken) !== String(claimToken)
  )
    throw claimNotHeld()
}

/**
 * The holder re-opening its own live claim takes no new claim (UC-MOD-02 AF1, UC-MOD-05 AF2).
 * A live claim recorded before claim tokens existed gets its token here; returns whether the
 * document changed and must be saved.
 */
export function adoptOwnClaim(doc) {
  if (doc.claimToken) return false
  doc.claimToken = new mongoose.Types.ObjectId()
  return true
}

/** Claim state and expiry of a list row; never carries the token. */
export function claimSummary(doc, account, now) {
  return {
    claimState: claimState(doc, account._id, now),
    claimExpiresAt: doc.claimOwnerAccountId ? (doc.claimExpiresAt ?? null) : null,
  }
}

/**
 * Claim fields of a detail response; the token is returned only to the live holder. A live claim
 * recorded before claim tokens existed is reported as claimResumeRequired: the holder resumes it
 * through the claim mutation (adoptOwnClaim, same expiry), never through a read.
 */
export function claimFields(doc, account, now) {
  const summary = claimSummary(doc, account, now)
  if (summary.claimState !== 'mine') return { ...summary, claimResumeRequired: false }
  return doc.claimToken
    ? { ...summary, claimToken: String(doc.claimToken), claimResumeRequired: false }
    : { ...summary, claimResumeRequired: true }
}

/** Whether the account holds the live claim with its token, so fenced actions may be offered. */
export function holdsClaimToken(doc, account, now) {
  return claimState(doc, account._id, now) === 'mine' && Boolean(doc.claimToken)
}
