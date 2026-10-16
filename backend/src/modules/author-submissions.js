import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  ModerationHistory,
  PublicationSubmission,
  RightsDeclaration,
  Story,
} from '../models/index.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';
import { lockAuthor, ownStory } from './author-ownership.js';
import { textChapterDocument } from './chapter-document.js';
import { richChapterDocument, chapterTextProjection } from './rich-chapter-document.js';

const oid = z.string().regex(/^[a-f\d]{24}$/i);
const storyContent = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    categoryIds: z.array(oid).min(1).max(10),
  })
  .strict();
const markup = /<\/?[a-z][^>]*>|```|\*\*|__|!\[[^\]]*\]\(|^\s{0,3}(?:#{1,6}\s|>\s)/imu;
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const digest = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
const rightsFacts = (rights) => ({
  basis: rights.basis,
  asserted: rights.asserted,
  sourceLicenceNote: rights.sourceLicenceNote ?? '',
});

async function packageState(account, input, session) {
  const story = await ownStory(account, input.storyId, session);
  const target = input.chapterId
    ? await Chapter.findOne({ _id: input.chapterId, storyId: story._id }).session(session ?? null)
    : story;
  if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.');
  const revision = await ContentRevision.findOne({
    _id: target.draftRevisionId ?? target.currentRevisionId,
    storyId: story._id,
    authorAccountId: account._id,
    contentType: input.chapterId ? 'chapter' : 'story',
    ...(input.chapterId ? { chapterId: target._id } : { chapterId: null }),
  }).session(session ?? null);
  if (!revision) throw new HttpError(409, 'missing_revision', 'Không tìm thấy bản nháp để gửi.');
  const content =
    revision.content && typeof revision.content === 'object' && !Array.isArray(revision.content)
      ? revision.content
      : {};
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  let valid = input.chapterId
    ? ((revision.formatVersion === 'blocks-v1' && textChapterDocument.safeParse(content).success) ||
        (revision.formatVersion === 'blocks-v2' &&
          richChapterDocument.safeParse(content).success)) &&
      chapterTextProjection(revision).some((text) => text.trim())
    : revision.formatVersion === 'story-v1' && storyContent.safeParse(content).success;
  const text = input.chapterId
    ? chapterTextProjection(revision).join('\n')
    : (content.description ?? '');
  valid = Boolean(
    valid &&
    (revision.formatVersion === 'blocks-v2' || !markup.test(text)) &&
    !markup.test(content.title ?? ''),
  );
  const rawCategoryIds = input.chapterId ? story.categoryIds.map(String) : content.categoryIds;
  const categoryIds = Array.isArray(rawCategoryIds)
    ? rawCategoryIds.filter((value) => oid.safeParse(value).success)
    : [];
  const active = await Category.countDocuments({
    _id: { $in: categoryIds },
    status: 'active',
  }).session(session ?? null);
  const categoriesValid =
    Array.isArray(rawCategoryIds) &&
    categoryIds.length === rawCategoryIds.length &&
    categoryIds.length > 0 &&
    new Set(categoryIds.map(String)).size === categoryIds.length &&
    active === categoryIds.length;
  const mediaSupported =
    !story.coverMediaId &&
    !story.theme?.coverBannerMediaId &&
    !revision.mediaIds?.length &&
    !blocks.some((block) => block?.type === 'image');
  const rights = input.chapterId
    ? await RightsDeclaration.findOne({
        storyId: story._id,
        revisionId: story.publishedRevisionId ?? story.currentRevisionId,
        declaredBy: account._id,
        asserted: true,
        status: 'asserted',
        immutableAt: { $ne: null },
      }).session(session ?? null)
    : null;
  const approvedParent = rights
    ? await ContentRevision.exists({
        _id: rights.revisionId,
        storyId: story._id,
        authorAccountId: account._id,
        contentType: 'story',
        status: { $in: ['approved', 'immutable'] },
        immutableAt: { $ne: null },
      }).session(session ?? null)
    : false;
  const parentReady =
    !input.chapterId ||
    (['published', 'approved'].includes(story.publicationStatus) &&
      Boolean(rights) &&
      Boolean(approvedParent));
  const editable =
    !story.authoringFrozen &&
    !['submitted', 'under-review', 'archived'].includes(story.publicationStatus) &&
    (!input.chapterId || target.status === 'draft') &&
    revision.status === 'editable' &&
    !revision.immutableAt;
  return {
    story,
    target,
    revision,
    rights,
    checks: [
      { code: 'editable', ok: editable },
      { code: 'content', ok: valid },
      { code: 'categories', ok: categoriesValid },
      { code: 'media', ok: mediaSupported },
      { code: 'parent', ok: parentReady },
    ],
  };
}
export async function prepareSubmission(account, input) {
  const state = await packageState(account, input);
  return {
    story: { id: String(state.story._id), title: state.story.title, author: account.displayName },
    target: {
      id: String(state.target._id),
      type: input.chapterId ? 'chapter' : 'story',
      title: state.revision.content?.title ?? '',
      version: state.target.version,
      revisionId: String(state.revision._id),
      revisionNumber: state.revision.revisionNumber,
    },
    checks: state.checks,
    ready: state.checks.every((check) => check.ok),
    words: (input.chapterId
      ? chapterTextProjection(state.revision)
      : [state.revision.content?.description ?? '']
    ).reduce((sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0), 0),
    requiresRights: !input.chapterId,
  };
}
export async function submitContent(account, input) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    await ownStory(account, input.storyId, session);
    const existing = await PublicationSubmission.findOne({
      revisionId: input.revisionId,
      storyId: input.storyId,
      authorAccountId: account._id,
      chapterId: input.chapterId ?? null,
    }).session(session);
    if (existing) {
      if (!input.chapterId) {
        const rights = await RightsDeclaration.findOne({ submissionId: existing._id }).session(
          session,
        );
        if (!rights || digest(rightsFacts(rights)) !== digest(rightsFacts(input.rights)))
          throw new HttpError(409, 'package_changed', 'Nội dung quyền khác với gói đã gửi.');
      }
      return { id: String(existing._id), status: existing.status, replayed: true };
    }
    const state = await packageState(account, input, session);
    if (
      String(state.revision._id) !== input.revisionId ||
      state.target.version !== input.expectedVersion
    )
      throw new HttpError(409, 'stale_content', 'Bản nháp đã thay đổi. Hãy tải lại trước khi gửi.');
    if (!state.checks.every((check) => check.ok))
      throw new HttpError(409, 'submission_not_ready', 'Bản nháp chưa đủ điều kiện gửi.', {
        checks: state.checks,
      });
    const now = new Date();
    const submissionId = new mongoose.Types.ObjectId();
    let rights = state.rights;
    if (!input.chapterId) {
      [rights] = await RightsDeclaration.create(
        [
          {
            ...rightsFacts(input.rights),
            storyId: state.story._id,
            submissionId,
            revisionId: state.revision._id,
            declaredBy: account._id,
            declaredAt: now,
            status: 'asserted',
            immutableAt: now,
          },
        ],
        { session },
      );
    }
    const rightsDigest = digest(rightsFacts(rights));
    const mediaDigest = digest([]);
    const packageDigest = digest({
      formatVersion: state.revision.formatVersion,
      content: state.revision.content,
      rightsDigest,
      mediaDigest,
    });
    state.revision.set({
      rightsDeclarationId: rights._id,
      rightsDigest,
      mediaDigest,
      packageDigest,
      validation: { valid: true, validator: 'publishing-text-v2', validatedAt: now },
      status: 'submitted',
      submittedAt: now,
      immutableAt: now,
    });
    await state.revision.save({ session });
    const [submission] = await PublicationSubmission.create(
      [
        {
          _id: submissionId,
          storyId: state.story._id,
          ...(input.chapterId ? { chapterId: state.target._id } : {}),
          revisionId: state.revision._id,
          authorAccountId: account._id,
          status: 'validated',
          submittedAt: now,
          packageDigest,
        },
      ],
      { session },
    );
    const [batch] = await EvidenceBatch.create(
      [
        {
          submissionId,
          revisionId: state.revision._id,
          packageDigest,
          stage: 'embedding',
          status: 'pending',
        },
      ],
      { session },
    );
    submission.currentEvidenceBatchId = batch._id;
    await submission.save({ session });
    if (input.chapterId) {
      state.target.status = 'submitted';
      await state.target.save({ session });
    } else {
      state.story.authoringFrozen = true;
      if (state.story.publicationStatus !== 'published')
        state.story.publicationStatus = 'submitted';
      await state.story.save({ session });
    }
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'content.submitted',
          targetType: 'PublicationSubmission',
          targetId: submissionId,
          result: 'accepted',
          occurredAt: now,
          dataDigest: packageDigest,
          targetVersion: submission.version,
        },
      ],
      { session },
    );
    await ModerationHistory.create(
      [
        {
          aggregateType: input.chapterId ? 'chapter' : 'story',
          aggregateId: state.target._id,
          action: 'submitted',
          outcome: 'validated',
          submissionId,
          revisionId: state.revision._id,
          evidenceBatchId: batch._id,
          actorAccountId: account._id,
          actorAuthorizationEpoch: account.authorizationEpoch,
          afterStateDigest: packageDigest,
          occurredAt: now,
        },
      ],
      { session },
    );
    return { id: String(submissionId), status: 'validated', replayed: false };
  });
}
export async function submissionList(account, { page = 1 } = {}) {
  const filter = { authorAccountId: account._id };
  const [total, items, stories] = await Promise.all([
    PublicationSubmission.countDocuments(filter),
    PublicationSubmission.find(filter)
      .sort({ submittedAt: -1, _id: -1 })
      .skip((page - 1) * 10)
      .limit(10)
      .lean(),
    Story.find({ authorAccountId: account._id }).sort({ updatedAt: -1 }).select('title').lean(),
  ]);
  const revisions = await ContentRevision.find({
    _id: { $in: items.map((item) => item.revisionId) },
    authorAccountId: account._id,
  })
    .select('content.title revisionNumber')
    .lean();
  const history = await ModerationHistory.find({
    submissionId: { $in: items.map((item) => item._id) },
  })
    .sort({ occurredAt: -1, _id: -1 })
    .select('submissionId action outcome feedback occurredAt')
    .lean();
  const batches = await EvidenceBatch.find({
    _id: { $in: items.map((item) => item.currentEvidenceBatchId).filter(Boolean) },
  })
    .select('status failedStage')
    .lean();
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / 10)),
    stories: stories.map((story) => ({ id: String(story._id), title: story.title })),
    items: items.map((item) => {
      const revision = revisions.find((revision) => revision._id.equals(item.revisionId));
      const batch = batches.find((batch) => batch._id.equals(item.currentEvidenceBatchId));
      return {
        id: String(item._id),
        storyId: String(item.storyId),
        chapterId: item.chapterId ? String(item.chapterId) : null,
        title: revision?.content?.title ?? '',
        revisionNumber: revision?.revisionNumber ?? null,
        status: item.status,
        version: item.version,
        submittedAt: item.submittedAt,
        decisionSummary: item.decisionSummary ?? '',
        processing: batch ? { status: batch.status, failedStage: batch.failedStage ?? null } : null,
        history: history
          .filter((row) => row.submissionId.equals(item._id))
          .map((row) => ({
            id: String(row._id),
            action: row.action,
            outcome: row.outcome ?? '',
            feedback: row.feedback ?? '',
            occurredAt: row.occurredAt,
          })),
      };
    }),
  };
}

/** A review result starts a new editable revision; the reviewed package stays immutable. */
export async function reviseSubmission(account, submissionId, expectedVersion) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    const submission = await PublicationSubmission.findOne({
      _id: submissionId,
      authorAccountId: account._id,
    }).session(session);
    if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy gói gửi.');
    if (submission.version !== expectedVersion)
      throw new HttpError(409, 'stale_submission', 'Kết quả xét duyệt đã thay đổi. Hãy tải lại.');
    if (!['rejected', 'revision-requested'].includes(submission.status))
      throw new HttpError(409, 'revision_not_allowed', 'Gói chưa có kết quả yêu cầu chỉnh sửa.');
    const story = await ownStory(account, submission.storyId, session);
    if (story.publicationStatus === 'archived')
      throw new HttpError(409, 'content_frozen', 'Truyện đã được lưu trữ.');
    const target = submission.chapterId
      ? await Chapter.findOne({ _id: submission.chapterId, storyId: story._id }).session(session)
      : story;
    if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy nội dung.');
    if (submission.chapterId && story.authoringFrozen)
      throw new HttpError(409, 'content_frozen', 'Truyện đang có gói thông tin chờ xử lý.');
    if (['archived', 'cancelled', 'published', 'scheduled', 'due'].includes(target.status))
      throw new HttpError(409, 'content_frozen', 'Nội dung không còn ở vòng chỉnh sửa này.');
    const currentId = target.draftRevisionId ?? target.currentRevisionId;
    const current = await ContentRevision.findOne({
      _id: currentId,
      storyId: story._id,
      authorAccountId: account._id,
      contentType: submission.chapterId ? 'chapter' : 'story',
      chapterId: submission.chapterId ?? null,
    }).session(session);
    if (!current)
      throw new HttpError(409, 'missing_revision', 'Không tìm thấy phiên bản hiện tại.');
    if (
      current.parentRevisionId?.equals(submission.revisionId) &&
      current.status === 'editable' &&
      !current.immutableAt
    )
      return {
        id: String(current._id),
        storyId: String(story._id),
        chapterId: submission.chapterId ? String(target._id) : null,
        replayed: true,
      };
    if (!current._id.equals(submission.revisionId) || !current.immutableAt)
      throw new HttpError(409, 'stale_content', 'Nội dung đã chuyển sang phiên bản khác.');
    const last = await ContentRevision.findOne({
      storyId: story._id,
      contentType: current.contentType,
      chapterId: submission.chapterId ?? null,
    })
      .sort({ revisionNumber: -1 })
      .session(session);
    const [revision] = await ContentRevision.create(
      [
        {
          contentType: current.contentType,
          storyId: story._id,
          ...(submission.chapterId ? { chapterId: target._id } : {}),
          authorAccountId: account._id,
          parentRevisionId: current._id,
          revisionNumber: (last?.revisionNumber ?? 0) + 1,
          content: structuredClone(current.content),
          formatVersion: current.formatVersion,
          mediaIds: current.mediaIds,
          ...(current.altText ? { altText: current.altText } : {}),
        },
      ],
      { session },
    );
    target.draftRevisionId = revision._id;
    target.currentRevisionId = revision._id;
    if (submission.chapterId) target.status = 'draft';
    else {
      story.authoringFrozen = false;
      if (!['published', 'unpublished'].includes(story.publicationStatus))
        story.publicationStatus = story.publishedRevisionId ? 'unpublished' : 'draft';
    }
    await target.save({ session });
    const now = new Date();
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'content.revision-created',
          targetType: 'ContentRevision',
          targetId: revision._id,
          result: 'accepted',
          occurredAt: now,
          targetVersion: revision.version,
          dataDigest: digest({ parentRevisionId: String(current._id), content: revision.content }),
        },
      ],
      { session },
    );
    await ModerationHistory.create(
      [
        {
          aggregateType: current.contentType,
          aggregateId: target._id,
          action: 'revision-created',
          outcome: 'draft',
          submissionId: submission._id,
          revisionId: revision._id,
          actorAccountId: account._id,
          actorAuthorizationEpoch: account.authorizationEpoch,
          occurredAt: now,
        },
      ],
      { session },
    );
    return {
      id: String(revision._id),
      storyId: String(story._id),
      chapterId: submission.chapterId ? String(target._id) : null,
      replayed: false,
    };
  });
}
