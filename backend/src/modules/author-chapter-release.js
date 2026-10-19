import {
  AuditEvent,
  Chapter,
  EvidenceBatch,
  PolicyVersion,
  PublicationSubmission,
  RightsDeclaration,
  Story,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { lockAuthor, ownStory } from './author-ownership.js';
import { loadSubmittedPackage } from './author-submitted-package.js';
import { digest } from './submission-digests.js';
import { inspectChapterImages, pinChapterImages } from './author-chapter-media.js';
import { approvedReviewEvidence } from './review-evidence.js';

async function packageFor(account, story, chapterId, revisionId, session) {
  const submission = revisionId
    ? await PublicationSubmission.findOne({
        storyId: story._id,
        chapterId,
        revisionId,
        authorAccountId: account._id,
      })
        .session(session ?? null)
        .lean()
    : null;
  if (!submission) return null;
  try {
    return await loadSubmittedPackage(account, submission._id, session);
  } catch (error) {
    if (!(error instanceof HttpError) || ![404, 409].includes(error.status)) throw error;
    return null;
  }
}
const approved = (snapshot) =>
  Boolean(
    snapshot?.submission.status === 'approved' &&
    ['approved', 'immutable'].includes(snapshot.revision.status) &&
    snapshot.rights.status === 'asserted',
  );

async function validAccessTerms(chapter, session) {
  const terms = chapter.earlyAccess;
  if (!terms?.enabled) return true;
  const policy = terms.policyVersionId
    ? await PolicyVersion.findById(terms.policyVersionId)
        .session(session ?? null)
        .lean()
    : null;
  if (
    !policy ||
    !['effective', 'superseded'].includes(policy.status) ||
    !policy.effectiveAt ||
    policy.effectiveAt > new Date() ||
    ![
      policy.priceMinCoins,
      policy.priceMaxCoins,
      policy.durationMinDays,
      policy.durationMaxDays,
    ].every(Number.isSafeInteger) ||
    ![terms.coinPrice, terms.durationDays].every(Number.isSafeInteger) ||
    terms.coinPrice <= 0 ||
    terms.durationDays <= 0 ||
    terms.coinPrice < policy.priceMinCoins ||
    terms.coinPrice > policy.priceMaxCoins ||
    terms.durationDays < policy.durationMinDays ||
    terms.durationDays > policy.durationMaxDays
  )
    return false;
  // Existing releases keep their original window, including after expiry or revision updates.
  if (chapter.firstReleasedAt)
    return terms.endsAt instanceof Date && Number.isFinite(terms.endsAt.getTime());
  return (
    !terms.endsAt && Number.isFinite(new Date(Date.now() + terms.durationDays * 86400000).getTime())
  );
}

export async function chapterReleaseState(
  account,
  storyId,
  chapterId,
  session,
  config,
  scheduled = false,
) {
  const story = await ownStory(account, storyId, session);
  const chapter = await Chapter.findOne({ _id: chapterId, storyId: story._id }).session(
    session ?? null,
  );
  if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.');
  const revisionId = chapter.draftRevisionId ?? chapter.currentRevisionId;
  const snapshot = await packageFor(account, story, chapter._id, revisionId, session);
  const parent = await packageFor(account, story, null, story.publishedRevisionId, session);
  const submission = snapshot?.submission;
  let imagesValid = true;
  if (snapshot?.revision.formatVersion === 'blocks-v3') {
    try {
      const images = await inspectChapterImages(
        config,
        account,
        story._id,
        snapshot.document,
        session,
      );
      imagesValid =
        images.mediaDigest === snapshot.revision.mediaDigest &&
        digest(images.validation.mediaManifest) === digest(snapshot.manifest);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      imagesValid = false;
    }
  }
  const batch = submission?.currentEvidenceBatchId
    ? await EvidenceBatch.findOne({
        _id: submission.currentEvidenceBatchId,
        submissionId: submission._id,
        revisionId,
        packageDigest: submission.packageDigest,
      })
        .session(session ?? null)
        .lean()
    : null;
  const evidenceReady = await approvedReviewEvidence(submission, batch, session);
  const previous = await Chapter.exists({
    storyId: story._id,
    orderKey: { $lt: chapter.orderKey },
    firstReleasedAt: null,
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  }).session(session ?? null);
  const checks = [
    { code: 'approval', ok: approved(snapshot) },
    { code: 'integrity', ok: Boolean(snapshot) },
    { code: 'evidence', ok: evidenceReady },
    { code: 'parent', ok: story.publicationStatus === 'published' && approved(parent) },
    { code: 'order', ok: !previous },
    { code: 'free', ok: await validAccessTerms(chapter, session) },
    {
      code: 'format',
      ok: Boolean(
        snapshot &&
        ['blocks-v1', 'blocks-v2', 'blocks-v3'].includes(snapshot.revision.formatVersion),
      ),
    },
    { code: 'media', ok: imagesValid },
    {
      code: 'editable',
      ok:
        !story.authoringFrozen &&
        (scheduled ? ['scheduled', 'due'] : ['approved', 'published']).includes(chapter.status) &&
        String(chapter.publishedRevisionId) !== String(revisionId),
    },
  ];
  return { story, chapter, snapshot, parent, checks };
}

export async function prepareChapterRelease(account, storyId, chapterId, config) {
  const { story, chapter, snapshot, checks } = await chapterReleaseState(
    account,
    storyId,
    chapterId,
    undefined,
    config,
  );
  return {
    target: {
      storyId: String(story._id),
      chapterId: String(chapter._id),
      version: chapter.version,
      storyVersion: story.version,
      revisionId: snapshot ? String(snapshot.revision._id) : null,
      submissionId: snapshot ? String(snapshot.submission._id) : null,
      title: snapshot?.revision.content.title ?? chapter.title,
    },
    checks,
    ready: checks.every((check) => check.ok),
  };
}

export async function publishChapter(account, storyId, chapterId, input, config) {
  return commitChapterRelease(account, storyId, chapterId, input, config);
}

// The scheduler is an internal caller; HTTP input cannot enable this mode.
export async function publishScheduledChapter(account, storyId, chapterId, input, config, now) {
  return commitChapterRelease(account, storyId, chapterId, input, config, now);
}

async function commitChapterRelease(account, storyId, chapterId, input, config, scheduledAt) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    const { story, chapter, snapshot, parent, checks } = await chapterReleaseState(
      account,
      storyId,
      chapterId,
      session,
      config,
      Boolean(scheduledAt),
    );
    if (scheduledAt && (!chapter.requestedReleaseAt || chapter.requestedReleaseAt > scheduledAt))
      throw new HttpError(409, 'release_not_due', 'Chương chưa đến lịch phát hành.');
    if (
      !snapshot ||
      String(snapshot.revision._id) !== input.revisionId ||
      String(snapshot.submission._id) !== input.submissionId
    )
      throw new HttpError(
        409,
        'stale_content',
        'Gói chương đã duyệt đã thay đổi. Hãy kiểm tra lại.',
      );
    if (
      chapter.status === 'published' &&
      String(chapter.publishedRevisionId) === input.revisionId &&
      chapter.publicationTransition?.result === 'author-chapter-published' &&
      !story.authoringFrozen &&
      checks.filter((check) => check.code !== 'editable').every((check) => check.ok)
    )
      return {
        id: String(chapter._id),
        status: 'published',
        version: chapter.version,
        replayed: true,
      };
    if (chapter.version !== input.expectedVersion || story.version !== input.expectedStoryVersion)
      throw new HttpError(
        409,
        'stale_content',
        'Truyện hoặc chương đã thay đổi. Hãy kiểm tra lại.',
      );
    if (!checks.every((check) => check.ok))
      throw new HttpError(409, 'release_not_ready', 'Chương chưa đủ điều kiện phát hành.', {
        checks,
      });
    const pinnedStory = await Story.updateOne(
      {
        _id: story._id,
        version: input.expectedStoryVersion,
        publicationStatus: 'published',
        authoringFrozen: false,
      },
      { $inc: { version: 1 } },
      { session },
    );
    if (pinnedStory.modifiedCount !== 1)
      throw new HttpError(409, 'stale_content', 'Truyện cha đã thay đổi. Hãy kiểm tra lại.');
    // Pin both approvals and declarations, including inherited rights only once.
    for (const [Model, rows, status] of [
      [PublicationSubmission, [snapshot.submission, parent.submission], 'approved'],
      [RightsDeclaration, [snapshot.rights, parent.rights], 'asserted'],
    ]) {
      const unique = new Map(rows.map((row) => [String(row._id), row]));
      for (const row of unique.values()) {
        const result = await Model.updateOne(
          { _id: row._id, version: row.version, status },
          { $inc: { version: 1 } },
          { session },
        );
        if (result.modifiedCount !== 1)
          throw new HttpError(409, 'stale_content', 'Quyết định duyệt hoặc quyền đã thay đổi.');
      }
    }
    const now = scheduledAt ?? new Date();
    if (snapshot.revision.formatVersion === 'blocks-v3') {
      const images = await pinChapterImages(config, account, story._id, snapshot.document, session);
      if (
        images.mediaDigest !== snapshot.revision.mediaDigest ||
        digest(images.validation.mediaManifest) !== digest(snapshot.manifest)
      )
        throw new HttpError(409, 'media_changed', 'Ảnh không khớp gói chương đã duyệt.');
    }
    const from = chapter.status;
    const previousPublishedRevisionId = chapter.publishedRevisionId
      ? String(chapter.publishedRevisionId)
      : null;
    chapter.title = snapshot.revision.content.title;
    chapter.status = 'published';
    chapter.publishedRevisionId = snapshot.revision._id;
    chapter.currentRevisionId = snapshot.revision._id;
    chapter.draftRevisionId = undefined;
    if (chapter.earlyAccess?.enabled && !chapter.firstReleasedAt) {
      chapter.earlyAccess.endsAt = new Date(
        now.getTime() + chapter.earlyAccess.durationDays * 86400000,
      );
    }
    chapter.firstReleasedAt = chapter.firstReleasedAt ?? now;
    chapter.publishedAt = chapter.publishedAt ?? now;
    chapter.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from,
      to: 'published',
      result: 'author-chapter-published',
    };
    await chapter.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: scheduledAt ? 'system' : 'account',
          actorId: account._id,
          action: 'chapter.published',
          targetType: 'Chapter',
          targetId: chapter._id,
          targetVersion: chapter.version,
          result: 'accepted',
          occurredAt: now,
          dataDigest: digest({
            revisionId: input.revisionId,
            submissionId: input.submissionId,
            packageDigest: snapshot.revision.packageDigest,
            previousPublishedRevisionId,
            earlyAccess: chapter.earlyAccess?.toObject(),
          }),
        },
      ],
      { session },
    );
    return {
      id: String(chapter._id),
      status: 'published',
      version: chapter.version,
      replayed: false,
    };
  });
}
