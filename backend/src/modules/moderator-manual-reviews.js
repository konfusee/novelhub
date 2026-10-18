import {
  Account,
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  Notification,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { loadSubmittedPackage } from './author-submitted-package.js';
import { lockModerator, reviewClaimView } from './moderator-review-claims.js';
import { terminalEvidenceReady } from './review-evidence.js';
import { chapterTextProjection } from './rich-chapter-document.js';
import { digest, rightsFacts } from './submission-digests.js';

const correlationId = 'manual-review-ai-deferred-v1';
async function state(submissionId, session, lock = false) {
  const submission = await PublicationSubmission.findById(submissionId).session(session ?? null);
  if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.');
  const author = lock
    ? await Account.findOneAndUpdate(
        { _id: submission.authorAccountId, status: 'active' },
        { $inc: { version: 1 } },
        { session },
      )
    : await Account.findOne({ _id: submission.authorAccountId, status: 'active' }).session(
        session ?? null,
      );
  const role = await RoleAssignment.exists({
    accountId: submission.authorAccountId,
    role: 'author',
    status: 'active',
  }).session(session ?? null);
  if (!author || !role)
    throw new HttpError(409, 'author_unavailable', 'Quyền tác giả không còn hiệu lực.');
  const snapshot = await loadSubmittedPackage(author, submissionId, session);
  if (snapshot.rights.status !== 'asserted')
    throw new HttpError(409, 'rights_changed', 'Khai báo quyền không còn hiệu lực.');
  if (snapshot.manifest.length || snapshot.revision.mediaIds?.length)
    throw new HttpError(
      409,
      'media_deferred',
      'Gói có media nằm ngoài luồng duyệt văn bản hiện tại.',
    );
  const story = await Story.findOne({
    _id: submission.storyId,
    authorAccountId: author._id,
  }).session(session ?? null);
  const target = submission.chapterId
    ? await Chapter.findOne({ _id: submission.chapterId, storyId: submission.storyId }).session(
        session ?? null,
      )
    : story;
  if (
    !target ||
    ((lock || ['validated', 'pending-review'].includes(submission.status)) &&
      String(target.draftRevisionId ?? target.currentRevisionId) !==
        String(submission.revisionId)) ||
    (submission.chapterId && story.authoringFrozen)
  )
    throw new HttpError(409, 'stale_package', 'Gói duyệt không còn là phiên bản hiện tại.');
  const revision = await ContentRevision.findById(submission.revisionId).session(session ?? null);
  const batch = await EvidenceBatch.findOne({
    _id: submission.currentEvidenceBatchId,
    submissionId: submission._id,
    revisionId: submission.revisionId,
    packageDigest: submission.packageDigest,
  }).session(session ?? null);
  if (
    !batch ||
    batch.activeLeaseId ||
    (!terminalEvidenceReady(batch) && batch.status !== 'pending')
  )
    throw new HttpError(409, 'evidence_changed', 'Bằng chứng đang xử lý hoặc không đúng gói.');
  return { submission, author, snapshot, story, target, revision, batch };
}
const historyFields = (s, moderator, now) => ({
  aggregateType: s.submission.chapterId ? 'chapter' : 'story',
  aggregateId: s.target._id,
  submissionId: s.submission._id,
  revisionId: s.revision._id,
  evidenceBatchId: s.batch._id,
  evidenceBatchVersion: s.batch.version,
  actorAccountId: moderator._id,
  actorAuthorizationEpoch: moderator.authorizationEpoch,
  beforeStateDigest: s.submission.packageDigest,
  occurredAt: now,
  correlationId,
});
async function pinBatch(s, expectedVersion, session) {
  const pinned = await EvidenceBatch.updateOne(
    { _id: s.batch._id, version: expectedVersion, activeLeaseId: null },
    { $inc: { version: 1 } },
    { session },
  );
  if (pinned.modifiedCount !== 1)
    throw new HttpError(409, 'evidence_changed', 'Bằng chứng đã thay đổi.');
  s.batch.version = expectedVersion + 1;
}
export async function manualReview(moderator, submissionId) {
  if (moderator.everAuthor)
    throw new HttpError(403, 'forbidden', 'Tài khoản từng là Author không được kiểm duyệt.');
  const s = await state(submissionId);
  const { submission, revision, batch, snapshot } = s;
  const history = await ModerationHistory.find({ submissionId: submission._id })
    .sort({ occurredAt: -1, _id: -1 })
    .limit(20)
    .lean();
  return {
    submission: { ...reviewClaimView(submission), status: submission.status },
    revision: {
      id: String(revision._id),
      version: revision.version,
      packageDigest: revision.packageDigest,
    },
    evidence: { id: String(batch._id), version: batch.version, status: batch.status },
    title: revision.content.title,
    metadata: submission.chapterId ? null : revision.content,
    paragraphs: submission.chapterId ? chapterTextProjection(revision) : [],
    history: history.map((h) => ({
      id: String(h._id),
      action: h.action,
      outcome: h.outcome ?? '',
      reason: h.reason ?? '',
      occurredAt: h.occurredAt,
    })),
    rights: rightsFacts(snapshot.rights),
    canAdmit: submission.status === 'validated',
    canDecide:
      submission.status === 'pending-review' &&
      String(submission.claimOwnerAccountId) === String(moderator._id) &&
      submission.claimExpiresAt > new Date(),
  };
}
export async function admitManualReview(moderator, submissionId, input) {
  if (input.confirmedManualReview !== true)
    throw new HttpError(400, 'confirmation_required', 'Cần xác nhận kiểm duyệt thủ công.');
  return withTransaction(async (session) => {
    await lockModerator(moderator, session);
    const s = await state(submissionId, session, true),
      now = new Date();
    if (
      s.submission.status !== 'validated' ||
      s.submission.version !== input.expectedVersion ||
      String(s.revision._id) !== input.revisionId ||
      s.batch.version !== input.expectedEvidenceVersion
    )
      throw new HttpError(409, 'stale_review', 'Hồ sơ hoặc bằng chứng đã thay đổi.');
    await pinBatch(s, input.expectedEvidenceVersion, session);
    s.submission.status = 'pending-review';
    await s.submission.save({ session });
    await ModerationHistory.create(
      [
        {
          ...historyFields(s, moderator, now),
          action: 'manual-review.admitted',
          outcome: 'pending-review',
          reason: input.reason,
          afterStateDigest: s.submission.packageDigest,
        },
      ],
      { session },
    );
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: moderator._id,
          action: 'review.manual-admitted',
          targetType: 'PublicationSubmission',
          targetId: s.submission._id,
          targetVersion: s.submission.version,
          result: 'pending-review',
          reason: input.reason,
          dataDigest: s.submission.packageDigest,
          correlationId,
          occurredAt: now,
        },
      ],
      { session },
    );
    return { claim: reviewClaimView(s.submission), status: s.submission.status };
  });
}
export async function decideManualReview(moderator, submissionId, input) {
  if (input.confirmedManualReview !== true)
    throw new HttpError(400, 'confirmation_required', 'Cần xác nhận kiểm duyệt thủ công.');
  return withTransaction(async (session) => {
    await lockModerator(moderator, session);
    const s = await state(submissionId, session, true),
      now = new Date();
    const { submission, revision, batch, story, target } = s;
    if (
      submission.status !== 'pending-review' ||
      submission.version !== input.expectedVersion ||
      submission.claimVersion !== input.expectedClaimVersion ||
      String(submission.claimOwnerAccountId) !== String(moderator._id) ||
      !submission.claimExpiresAt ||
      submission.claimExpiresAt <= now ||
      String(revision._id) !== input.revisionId ||
      revision.version !== input.expectedRevisionVersion ||
      batch.version !== input.expectedEvidenceVersion ||
      String(batch._id) !== input.evidenceBatchId ||
      !['submitted', 'immutable'].includes(revision.status)
    )
      throw new HttpError(
        409,
        'stale_review',
        'Claim, phiên bản hoặc bằng chứng không còn hợp lệ.',
      );
    if (
      !terminalEvidenceReady(batch) &&
      !(await ModerationHistory.exists({
        submissionId: submission._id,
        revisionId: revision._id,
        action: 'manual-review.admitted',
        evidenceBatchId: batch._id,
        evidenceBatchVersion: batch.version,
        beforeStateDigest: submission.packageDigest,
        correlationId,
      }).session(session))
    )
      throw new HttpError(
        409,
        'manual_admission_required',
        'Hồ sơ chưa được tiếp nhận duyệt thủ công.',
      );
    await pinBatch(s, input.expectedEvidenceVersion, session);
    if (input.outcome === 'approved' && !submission.chapterId) {
      const ids = revision.content.categoryIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        new Set(ids).size !== ids.length ||
        (await Category.countDocuments({ _id: { $in: ids }, status: 'active' }).session(
          session,
        )) !== ids.length
      )
        throw new HttpError(
          409,
          'categories_changed',
          'Thể loại của gói không còn hoạt động. Yêu cầu tác giả chỉnh sửa.',
        );
    }
    submission.status = input.outcome;
    submission.decisionSummary = input.reason;
    submission.claimReleaseHistory.push({
      ownerAccountId: moderator._id,
      claimVersion: submission.claimVersion,
      expiresAt: submission.claimExpiresAt,
      releasedAt: now,
      reason: `decision:${input.outcome}`,
      actorAccountId: moderator._id,
    });
    submission.claimOwnerAccountId = undefined;
    submission.claimExpiresAt = undefined;
    submission.claimVersion++;
    revision.status =
      input.outcome === 'approved'
        ? 'approved'
        : input.outcome === 'rejected'
          ? 'rejected'
          : 'immutable';
    if (submission.chapterId) {
      target.status =
        input.outcome === 'approved'
          ? target.requestedReleaseAt
            ? target.requestedReleaseAt <= now
              ? 'due'
              : 'scheduled'
            : 'approved'
          : 'draft';
      await target.save({ session });
    } else {
      story.authoringFrozen = false;
      if (!['published', 'unpublished'].includes(story.publicationStatus))
        story.publicationStatus = input.outcome === 'approved' ? 'approved' : 'draft';
      await story.save({ session });
    }
    await revision.save({ session });
    await submission.save({ session });
    await ModerationHistory.create(
      [
        {
          ...historyFields(s, moderator, now),
          action: 'manual-review.decided',
          outcome: input.outcome,
          reason: input.reason,
          feedback: input.reason,
          afterStateDigest: digest({
            status: submission.status,
            packageDigest: submission.packageDigest,
            claimVersion: submission.claimVersion,
          }),
        },
      ],
      { session },
    );
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: moderator._id,
          action: 'review.manual-decided',
          targetType: 'PublicationSubmission',
          targetId: submission._id,
          targetVersion: submission.version,
          result: input.outcome,
          reason: input.reason,
          dataDigest: submission.packageDigest,
          correlationId,
          occurredAt: now,
        },
      ],
      { session },
    );
    await Notification.create(
      [
        {
          recipientAccountId: s.author._id,
          eventType: 'publication.decided',
          sourceEventKey: `publication-decision:${submission._id}`,
          payload: {
            title: 'Đã có kết quả kiểm duyệt nội dung',
            body: input.reason,
            status: input.outcome,
            submissionId: String(submission._id),
          },
          deliveryState: 'delivered',
        },
      ],
      { session },
    );
    return { id: String(submission._id), status: submission.status, version: submission.version };
  });
}
