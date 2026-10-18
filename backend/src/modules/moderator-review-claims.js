import {
  Account,
  AuditEvent,
  ContentRevision,
  PolicyVersion,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { digest } from './submission-digests.js';

export const reviewClaimView = (submission) => ({
  id: String(submission._id),
  version: submission.version,
  claimVersion: submission.claimVersion,
  ownerAccountId: submission.claimOwnerAccountId ? String(submission.claimOwnerAccountId) : null,
  expiresAt: submission.claimExpiresAt ?? null,
});
async function lockModerator(moderator, session) {
  const account = await Account.findOneAndUpdate(
    {
      _id: moderator._id,
      status: 'active',
      everAuthor: false,
      authorizationEpoch: moderator.authorizationEpoch,
      credentialVersion: moderator.credentialVersion,
    },
    { $inc: { version: 1 } },
    { session },
  );
  if (
    !account ||
    !(await RoleAssignment.exists({
      accountId: moderator._id,
      role: 'moderator',
      status: 'active',
    }).session(session)) ||
    (await RoleAssignment.exists({
      accountId: moderator._id,
      role: 'author',
      status: 'active',
    }).session(session))
  )
    throw new HttpError(403, 'forbidden', 'Quyền kiểm duyệt không còn hợp lệ.');
}
export async function changeReviewClaim(
  moderator,
  submissionId,
  input,
  release = false,
  now = new Date(),
) {
  return withTransaction(async (session) => {
    await lockModerator(moderator, session);
    const submission = await PublicationSubmission.findById(submissionId).session(session);
    if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.');
    if (submission.status !== 'pending-review')
      throw new HttpError(409, 'not_reviewable', 'Hồ sơ chưa ở hàng đợi kiểm duyệt.');
    const own = String(submission.claimOwnerAccountId) === String(moderator._id);
    const live = submission.claimOwnerAccountId && submission.claimExpiresAt > now;
    // Exact retry of a completed acquisition is a read, never an extension of its lease.
    if (
      !release &&
      own &&
      live &&
      submission.claimVersion === input.expectedClaimVersion + 1 &&
      submission.version === input.expectedVersion + 1
    )
      return { claim: reviewClaimView(submission), replayed: true };
    if (
      submission.version !== input.expectedVersion ||
      submission.claimVersion !== input.expectedClaimVersion
    )
      throw new HttpError(409, 'claim_changed', 'Hồ sơ hoặc claim đã thay đổi.');
    if (release && (!own || !live))
      throw new HttpError(409, 'claim_not_owned', 'Bạn không còn giữ claim hợp lệ.');
    if (!release && live)
      throw new HttpError(409, 'already_claimed', 'Hồ sơ đang được giữ bởi một claim còn hạn.');
    let policy;
    if (!release) {
      // Coordinate with Author revocation/closure before granting a new claim.
      const author = await Account.findOneAndUpdate(
        { _id: submission.authorAccountId, status: 'active' },
        { $inc: { version: 1 } },
        { session },
      );
      const role = await RoleAssignment.exists({
        accountId: submission.authorAccountId,
        role: 'author',
        status: 'active',
      }).session(session);
      const story = await Story.findOne({
        _id: submission.storyId,
        authorAccountId: submission.authorAccountId,
        authoringFrozen: false,
      }).session(session);
      const revision = await ContentRevision.findOne({
        _id: submission.revisionId,
        storyId: submission.storyId,
        authorAccountId: submission.authorAccountId,
        status: { $in: ['submitted', 'immutable'] },
      }).session(session);
      if (
        !author ||
        !role ||
        !story ||
        !revision ||
        String(revision.chapterId) !== String(submission.chapterId) ||
        revision.contentType !== (submission.chapterId ? 'chapter' : 'story') ||
        (submission.packageDigest && revision.packageDigest !== submission.packageDigest)
      )
        throw new HttpError(
          409,
          'submission_unavailable',
          'Tác giả hoặc gói duyệt không còn hợp lệ.',
        );
      policy = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
        .sort({ effectiveAt: -1, _id: -1 })
        .session(session);
      if (!policy || !Number.isFinite(policy.claimExpiryHours) || policy.claimExpiryHours <= 0)
        throw new HttpError(409, 'policy_required', 'Chưa có chính sách thời hạn claim hợp lệ.');
    }
    if (submission.claimOwnerAccountId)
      submission.claimReleaseHistory.push({
        ownerAccountId: submission.claimOwnerAccountId,
        claimVersion: submission.claimVersion,
        expiresAt: submission.claimExpiresAt ?? null,
        releasedAt: now,
        reason: release ? 'moderator-released' : 'claim-expired',
        actorAccountId: moderator._id,
      });
    submission.claimVersion++;
    if (release) {
      submission.claimOwnerAccountId = undefined;
      submission.claimExpiresAt = undefined;
    } else {
      const expiresAt = new Date(now.getTime() + policy.claimExpiryHours * 3600000);
      if (!Number.isFinite(expiresAt.getTime()))
        throw new HttpError(409, 'invalid_policy', 'Thời hạn claim không hợp lệ.');
      submission.claimOwnerAccountId = moderator._id;
      submission.claimExpiresAt = expiresAt;
    }
    await submission.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: moderator._id,
          action: release ? 'review.claim.released' : 'review.claim.acquired',
          targetType: 'PublicationSubmission',
          targetId: submission._id,
          targetVersion: submission.version,
          result: release ? 'released' : 'claimed',
          occurredAt: now,
          ...(policy ? { correlationId: `policy:${policy._id}:v${policy.version}` } : {}),
          dataDigest: digest({
            claim: reviewClaimView(submission),
            ...(policy
              ? {
                  policyId: String(policy._id),
                  policyVersion: policy.version,
                  claimExpiryHours: policy.claimExpiryHours,
                }
              : {}),
          }),
        },
      ],
      { session },
    );
    return { claim: reviewClaimView(submission), replayed: false };
  });
}
