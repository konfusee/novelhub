import mongoose from 'mongoose'
import { z } from 'zod'
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
} from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { withTransaction } from '../../../db/connection.js'
import { lockAuthor, ownStory } from './author-ownership.js'
import { textChapterDocument } from '../content/chapter-document.js'
import { digest, rightsFacts } from '../submissions/submission-digests.js'
import { inspectChapterImages, pinChapterImages } from './author-chapter-media.js'
import {
  STORY_MEDIA_MANIFEST,
  STORY_MEDIA_VALIDATOR,
  inspectStoryImages,
  pinStoryImages,
} from './author-story-media.js'
import { loadSubmittedPackage } from './author-submitted-package.js'
import {
  richChapterDocument,
  editableChapterDocument,
  chapterTextProjection,
} from '../content/rich-chapter-document.js'
import { storedTags } from '../content/story-tags.js'

const oid = z.string().regex(/^[a-f\d]{24}$/i)
const storyContent = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    categoryId: oid,
    tags: storedTags.optional(),
    coverMediaId: oid.nullable().optional(),
    coverBannerMediaId: oid.nullable().optional(),
  })
  .strict()
const markup = /<\/?[a-z][^>]*>|```|\*\*|__|!\[[^\]]*\]\(|^\s{0,3}(?:#{1,6}\s|>\s)/imu

export function canReviseUnpublished(submission, target, revision, story) {
  if (!submission?.chapterId || !target || !revision || !story) return false
  return Boolean(
    submission.status === 'approved' &&
    !story.authoringFrozen &&
    ['published', 'unpublished'].includes(story.publicationStatus) &&
    ['published', 'unpublished'].includes(target?.status) &&
    String(target.storyId) === String(submission.storyId) &&
    String(revision?._id) === String(submission.revisionId) &&
    revision?.immutableAt &&
    ['approved', 'immutable'].includes(revision.status) &&
    String(target.publishedRevisionId) === String(submission.revisionId) &&
    String(target.draftRevisionId ?? target.currentRevisionId) === String(submission.revisionId),
  )
}

export function canReviseApprovedUnreleased(submission, target, revision, story) {
  if (!submission?.chapterId || !target || !revision || !story) return false
  return Boolean(
    submission.status === 'approved' &&
    !story.authoringFrozen &&
    story.publicationStatus !== 'archived' &&
    ['approved', 'scheduled', 'due'].includes(target?.status) &&
    !target.firstReleasedAt &&
    !target.publishedRevisionId &&
    String(target.storyId) === String(submission.storyId) &&
    String(target.draftRevisionId ?? target.currentRevisionId) === String(submission.revisionId) &&
    String(revision?._id) === String(submission.revisionId) &&
    revision?.immutableAt &&
    ['approved', 'immutable'].includes(revision.status),
  )
}

// Mirrors the reviseSubmission guards for a rejected package (create or replay).
export function canReviseRejected(submission, target, current, story) {
  if (submission.status !== 'rejected' || !target || !current) return false
  if (story.publicationStatus === 'archived') return false
  if (submission.chapterId && story.authoringFrozen) return false
  if (['archived', 'cancelled', 'scheduled', 'due'].includes(target.status)) return false
  const replay =
    String(current.parentRevisionId) === String(submission.revisionId) &&
    current.status === 'editable' &&
    !current.immutableAt
  const create =
    String(current._id) === String(submission.revisionId) && Boolean(current.immutableAt)
  return replay || create
}

async function packageState(account, input, session, config) {
  const story = await ownStory(account, input.storyId, session)
  const target = input.chapterId
    ? await Chapter.findOne({ _id: input.chapterId, storyId: story._id }).session(session ?? null)
    : story
  if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.')
  const revision = await ContentRevision.findOne({
    _id: target.draftRevisionId ?? target.currentRevisionId,
    storyId: story._id,
    authorAccountId: account._id,
    contentType: input.chapterId ? 'chapter' : 'story',
    ...(input.chapterId ? { chapterId: target._id } : { chapterId: null }),
  }).session(session ?? null)
  if (!revision) throw new HttpError(409, 'missing_revision', 'Không tìm thấy bản nháp để gửi.')
  const content =
    revision.content && typeof revision.content === 'object' && !Array.isArray(revision.content)
      ? revision.content
      : {}
  const blocks = Array.isArray(content.blocks) ? content.blocks : []
  let valid = input.chapterId
    ? ((revision.formatVersion === 'blocks-v1' && textChapterDocument.safeParse(content).success) ||
        (revision.formatVersion === 'blocks-v2' &&
          richChapterDocument.safeParse(content).success) ||
        (revision.formatVersion === 'blocks-v3' &&
          editableChapterDocument.safeParse(content).success)) &&
      chapterTextProjection(revision).some(text => text.trim())
    : revision.formatVersion === 'story-v1' && storyContent.safeParse(content).success
  const text = input.chapterId
    ? chapterTextProjection(revision).join('\n')
    : (content.description ?? '')
  valid = Boolean(
    valid &&
    (['blocks-v2', 'blocks-v3'].includes(revision.formatVersion) || !markup.test(text)) &&
    !markup.test(content.title ?? ''),
  )
  const categoryId = input.chapterId ? String(story.categoryId) : content.categoryId
  const categoryValid =
    oid.safeParse(categoryId).success &&
    Boolean(await Category.exists({ _id: categoryId, status: 'active' }).session(session ?? null))
  const illustrated = Boolean(input.chapterId && revision.formatVersion === 'blocks-v3')
  let images = null
  if (illustrated && valid) {
    try {
      images = await inspectChapterImages(config, account, story._id, content, session)
      if (
        !images.mediaIds.length ||
        JSON.stringify(revision.mediaIds.map(String)) !== JSON.stringify(images.mediaIds) ||
        revision.mediaDigest !== images.mediaDigest ||
        digest(revision.validation?.mediaManifest ?? null) !==
          digest(images.validation.mediaManifest) ||
        revision.validation?.mediaManifestVersion !== 'chapter-images-v1'
      )
        images = null
    } catch (error) {
      if (!(error instanceof HttpError) || ![404, 409].includes(error.status)) throw error
    }
  }
  // A story package includes its cover and banner: owned, scoped to the story, of the right kind,
  // available and matching their stored bytes (UC-AUT-09 steps 2-3).
  let storyImages = null
  let storyImagesValid = true
  if (!input.chapterId && storyContent.safeParse(content).success) {
    try {
      storyImages = await inspectStoryImages(config, account, story._id, content, session)
    } catch (error) {
      if (!(error instanceof HttpError) || ![404, 409].includes(error.status)) throw error
      storyImagesValid = false
    }
  }
  const mediaSupported = illustrated
    ? Boolean(images)
    : !revision.mediaIds?.length &&
      !blocks.some(block => block?.type === 'image') &&
      storyImagesValid
  const rights = input.chapterId
    ? await RightsDeclaration.findOne({
        storyId: story._id,
        revisionId: story.publishedRevisionId ?? story.currentRevisionId,
        declaredBy: account._id,
        asserted: true,
        status: 'asserted',
        immutableAt: { $ne: null },
      }).session(session ?? null)
    : null
  const approvedParent = rights
    ? await ContentRevision.exists({
        _id: rights.revisionId,
        storyId: story._id,
        authorAccountId: account._id,
        contentType: 'story',
        status: { $in: ['approved', 'immutable'] },
        immutableAt: { $ne: null },
      }).session(session ?? null)
    : false
  const parentReady =
    !input.chapterId ||
    (['published', 'approved'].includes(story.publicationStatus) &&
      Boolean(rights) &&
      Boolean(approvedParent))
  const editable =
    !story.authoringFrozen &&
    !['submitted', 'under-review', 'archived'].includes(story.publicationStatus) &&
    (!input.chapterId ||
      target.status === 'draft' ||
      (target.status === 'published' &&
        target.publishedRevisionId &&
        target.draftRevisionId &&
        String(target.draftRevisionId) !== String(target.publishedRevisionId))) &&
    revision.status === 'editable' &&
    !revision.immutableAt
  return {
    story,
    target,
    revision,
    rights,
    images,
    storyImages,
    illustrated,
    checks: [
      { code: 'editable', ok: editable },
      { code: 'content', ok: valid },
      { code: 'categories', ok: categoryValid },
      { code: 'media', ok: mediaSupported },
      { code: 'parent', ok: parentReady },
    ],
  }
}
// The story images a declaration covers: the frozen manifest of a submitted revision, otherwise
// the cover and banner validated now. Plain chapters and stories without images have none.
function storyImageRights({ revision, storyImages }) {
  const imageRights = revision.immutableAt
    ? revision.validation?.mediaManifestVersion === STORY_MEDIA_MANIFEST && {
        mediaDigest: revision.mediaDigest,
        count: revision.validation.mediaManifest.length,
      }
    : storyImages && {
        mediaDigest: storyImages.mediaDigest,
        count: storyImages.validation.mediaManifest.length,
      }
  return imageRights ? { imageRights } : {}
}
export async function prepareSubmission(account, input, config) {
  const state = await packageState(account, input, undefined, config)
  const frozenRights = state.revision.immutableAt
    ? await RightsDeclaration.findOne({
        _id: state.revision.rightsDeclarationId,
        revisionId: state.revision._id,
        declaredBy: account._id,
        immutableAt: { $ne: null },
      }).lean()
    : null
  return {
    story: { id: String(state.story._id), title: state.story.title, author: account.displayName },
    target: {
      id: String(state.target._id),
      type: input.chapterId ? 'chapter' : 'story',
      title: state.revision.content?.title ?? '',
      version: state.target.version,
      revisionId: String(state.revision._id),
      revisionNumber: state.revision.revisionNumber,
      formatVersion: state.revision.formatVersion,
    },
    checks: state.checks,
    ready: state.checks.every(check => check.ok),
    words: (input.chapterId
      ? chapterTextProjection(state.revision)
      : [state.revision.content?.description ?? '']
    ).reduce((sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0), 0),
    requiresRights: !input.chapterId || state.illustrated,
    ...(frozenRights ? { frozenRights: rightsFacts(frozenRights) } : {}),
    ...(state.illustrated
      ? {
          imageRights: {
            mediaDigest: state.revision.mediaDigest ?? null,
            count: state.revision.mediaIds.length,
          },
        }
      : storyImageRights(state)),
  }
}
export async function submitContent(account, input, config) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    await ownStory(account, input.storyId, session)
    const existing = await PublicationSubmission.findOne({
      revisionId: input.revisionId,
      storyId: input.storyId,
      authorAccountId: account._id,
      chapterId: input.chapterId ?? null,
    }).session(session)
    if (existing) {
      const frozen = await ContentRevision.findById(existing.revisionId).session(session)
      const illustrated = frozen?.formatVersion === 'blocks-v3'
      if (!input.chapterId || illustrated) {
        const imaged =
          illustrated || frozen?.validation?.mediaManifestVersion === STORY_MEDIA_MANIFEST
        const rights = await RightsDeclaration.findOne({ submissionId: existing._id }).session(
          session,
        )
        if (
          !rights ||
          !input.rights ||
          digest(rightsFacts(rights)) !== digest(rightsFacts(input.rights)) ||
          (imaged
            ? input.imageManifestDigest !== frozen.mediaDigest
            : Boolean(input.imageManifestDigest))
        )
          throw new HttpError(409, 'package_changed', 'Nội dung quyền khác với gói đã gửi.')
      } else if (input.rights || input.imageManifestDigest)
        throw new HttpError(
          400,
          'validation_error',
          'Chương văn bản dùng khai báo quyền của truyện.',
        )
      return { id: String(existing._id), status: existing.status, replayed: true }
    }
    const state = await packageState(account, input, session, config)
    if (
      String(state.revision._id) !== input.revisionId ||
      state.target.version !== input.expectedVersion
    )
      throw new HttpError(409, 'stale_content', 'Bản nháp đã thay đổi. Hãy tải lại trước khi gửi.')
    if (!state.checks.every(check => check.ok))
      throw new HttpError(409, 'submission_not_ready', 'Bản nháp chưa đủ điều kiện gửi.', {
        checks: state.checks,
      })
    if (state.illustrated) {
      if (!input.rights || input.imageManifestDigest !== state.images.mediaDigest)
        throw new HttpError(
          409,
          'image_rights_required',
          'Hãy khai báo quyền cho đúng danh sách ảnh của bản nháp.',
        )
      // Pin the verified assets in the same transaction as the immutable package.
      const pinned = await pinChapterImages(
        config,
        account,
        state.story._id,
        state.revision.content,
        session,
      )
      if (pinned.mediaDigest !== state.images.mediaDigest)
        throw new HttpError(409, 'media_changed', 'Ảnh đã thay đổi. Hãy kiểm tra lại bản nháp.')
    } else if (state.storyImages) {
      // The declaration covers the cover and banner the author validated (UC-AUT-09 EX3, EX4).
      if (!input.imageManifestDigest)
        throw new HttpError(
          409,
          'image_rights_required',
          'Hãy khai báo quyền cho cả ảnh bìa và banner của bản nháp.',
        )
      const changed = () =>
        new HttpError(
          409,
          'media_changed',
          'Ảnh bìa hoặc banner đã thay đổi. Hãy kiểm tra lại bản nháp.',
        )
      if (input.imageManifestDigest !== state.storyImages.mediaDigest) throw changed()
      const pinned = await pinStoryImages(
        config,
        account,
        state.story._id,
        state.revision.content,
        session,
      )
      if (pinned?.mediaDigest !== state.storyImages.mediaDigest) throw changed()
    } else if (input.imageManifestDigest || (input.chapterId && input.rights)) {
      throw new HttpError(400, 'validation_error', 'Khai báo ảnh không phù hợp với phiên bản này.')
    }
    if (
      (!input.chapterId || state.illustrated) &&
      input.rights?.basis === 'licensed' &&
      !input.rights.sourceLicenceNote?.trim()
    )
      throw new HttpError(
        400,
        'licence_note_required',
        'Hãy ghi nguồn và phạm vi được cấp phép cho nội dung và ảnh.',
      )
    const now = new Date()
    const submissionId = new mongoose.Types.ObjectId()
    let rights = state.rights
    if (!input.chapterId || state.illustrated) {
      ;[rights] = await RightsDeclaration.create(
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
      )
    }
    const mediaDigest = state.images?.mediaDigest ?? state.storyImages?.mediaDigest ?? digest([])
    const rightsDigest = state.illustrated
      ? digest({
          declaration: rightsFacts(rights),
          parentRightsDeclarationId: String(state.rights._id),
          mediaDigest,
        })
      : state.storyImages
        ? digest({ declaration: rightsFacts(rights), mediaDigest })
        : digest(rightsFacts(rights))
    const packageDigest = digest({
      formatVersion: state.revision.formatVersion,
      content: state.revision.content,
      rightsDigest,
      mediaDigest,
    })
    state.revision.set({
      rightsDeclarationId: rights._id,
      rightsDigest,
      mediaDigest,
      packageDigest,
      validation: {
        ...(state.images?.validation ?? state.storyImages?.validation ?? {}),
        ...(state.illustrated ? { parentRightsDeclarationId: String(state.rights._id) } : {}),
        valid: true,
        validator: state.illustrated
          ? 'publishing-images-v1'
          : state.storyImages
            ? STORY_MEDIA_VALIDATOR
            : 'publishing-text-v2',
        validatedAt: now,
      },
      status: 'submitted',
      submittedAt: now,
      immutableAt: now,
    })
    await state.revision.save({ session })
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
    )
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
    )
    submission.currentEvidenceBatchId = batch._id
    await submission.save({ session })
    if (input.chapterId) {
      if (state.target.status !== 'published') state.target.status = 'submitted'
      await state.target.save({ session })
    } else {
      state.story.authoringFrozen = true
      if (state.story.publicationStatus !== 'published') state.story.publicationStatus = 'submitted'
      await state.story.save({ session })
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
    )
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
    )
    return { id: String(submissionId), status: 'validated', replayed: false }
  })
}
export async function submissionList(
  account,
  { page = 1, storyId, chapterId, targetType, status } = {},
) {
  const filter = {
    authorAccountId: account._id,
    ...(storyId ? { storyId } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(targetType === 'story' ? { chapterId: null } : {}),
    ...(targetType === 'chapter' ? { chapterId: { $ne: null } } : {}),
    ...(status ? { status } : {}),
  }
  const [total, items, stories] = await Promise.all([
    PublicationSubmission.countDocuments(filter),
    PublicationSubmission.find(filter)
      .sort({ submittedAt: -1, _id: -1 })
      .skip((page - 1) * 10)
      .limit(10)
      .lean(),
    Story.find({
      authorAccountId: account._id,
      'publicationTransition.result': { $ne: 'author-draft-deleted' },
    })
      .sort({ updatedAt: -1 })
      .select('title authoringFrozen publicationStatus draftRevisionId currentRevisionId')
      .lean(),
  ])
  const revisionIds = items.map(item => item.revisionId).filter(Boolean)
  const chapterIds = items.map(item => item.chapterId).filter(Boolean)
  const submissionIds = items.map(item => item._id).filter(Boolean)
  const batchIds = items.map(item => item.currentEvidenceBatchId).filter(Boolean)
  const [revisions, chapters, history, batches] = await Promise.all([
    revisionIds.length
      ? ContentRevision.find({ _id: { $in: revisionIds }, authorAccountId: account._id })
          .select('content.title revisionNumber status immutableAt')
          .lean()
      : [],
    chapterIds.length
      ? Chapter.find({
          _id: { $in: chapterIds },
          storyId: { $in: stories.map(story => story._id) },
        })
          .select('status publishedRevisionId draftRevisionId currentRevisionId storyId')
          .lean()
      : [],
    submissionIds.length
      ? ModerationHistory.find({ submissionId: { $in: submissionIds } })
          .sort({ occurredAt: -1, _id: -1 })
          .select('submissionId action outcome feedback occurredAt')
          .lean()
      : [],
    batchIds.length
      ? EvidenceBatch.find({ _id: { $in: batchIds } })
          .select('status failedStage')
          .lean()
      : [],
  ])
  const byId = (rows, id) => rows.find(row => row?._id && id && String(row._id) === String(id))
  const targetOf = item =>
    item.chapterId ? byId(chapters, item.chapterId) : byId(stories, item.storyId)
  const currentIds = items
    .map(targetOf)
    .filter(Boolean)
    .map(target => target.draftRevisionId ?? target.currentRevisionId)
    .filter(Boolean)
  const currents = currentIds.length
    ? await ContentRevision.find({
        _id: { $in: currentIds },
        authorAccountId: account._id,
      })
        .select('parentRevisionId status immutableAt')
        .lean()
    : []
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / 10)),
    stories: stories.map(story => ({ id: String(story._id), title: story.title })),
    items: items.map(item => {
      const revision = byId(revisions, item.revisionId)
      const batch = byId(batches, item.currentEvidenceBatchId)
      const target = targetOf(item)
      const current = target
        ? byId(currents, target.draftRevisionId ?? target.currentRevisionId)
        : undefined
      return {
        id: String(item._id),
        storyId: String(item.storyId),
        chapterId: item.chapterId ? String(item.chapterId) : null,
        title: revision?.content?.title ?? '',
        revisionNumber: revision?.revisionNumber ?? null,
        status: item.status,
        canRevise:
          canReviseRejected(item, target, current, byId(stories, item.storyId) ?? {}) ||
          canReviseUnpublished(
            item,
            byId(chapters, item.chapterId),
            revision,
            byId(stories, item.storyId) ?? {},
          ) ||
          canReviseApprovedUnreleased(item, target, current, byId(stories, item.storyId) ?? {}),
        version: item.version,
        submittedAt: item.submittedAt,
        decisionSummary: item.decisionSummary ?? '',
        processing: batch ? { status: batch.status, failedStage: batch.failedStage ?? null } : null,
        history: history
          .filter(row => row.submissionId && String(row.submissionId) === String(item._id))
          .map(row => ({
            id: String(row._id),
            action: row.action,
            outcome: row.outcome ?? '',
            feedback: row.feedback ?? '',
            occurredAt: row.occurredAt,
          })),
      }
    }),
  }
}

/** Clones a frozen revision into the next editable revision of the same target. */
export async function createEditableRevision({
  current,
  storyId,
  chapterId,
  authorAccountId,
  session,
}) {
  const last = await ContentRevision.findOne({
    storyId,
    contentType: current.contentType,
    chapterId: chapterId ?? null,
  })
    .sort({ revisionNumber: -1 })
    .session(session)
  const [revision] = await ContentRevision.create(
    [
      {
        contentType: current.contentType,
        storyId,
        ...(chapterId ? { chapterId } : {}),
        authorAccountId,
        parentRevisionId: current._id,
        revisionNumber: (last?.revisionNumber ?? 0) + 1,
        content: structuredClone(current.content),
        formatVersion: current.formatVersion,
        mediaIds: current.mediaIds,
        ...(current.formatVersion === 'blocks-v3'
          ? {
              mediaDigest: current.mediaDigest,
              validation: {
                mediaManifestVersion: current.validation?.mediaManifestVersion,
                mediaManifest: structuredClone(current.validation?.mediaManifest),
              },
            }
          : {}),
        ...(current.altText ? { altText: current.altText } : {}),
      },
    ],
    { session },
  )
  return revision
}

/** A review result starts a new editable revision; the reviewed package stays immutable. */
export async function reviseSubmission(account, submissionId, expectedVersion) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const submission = await PublicationSubmission.findOne({
      _id: submissionId,
      authorAccountId: account._id,
    }).session(session)
    if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy gói gửi.')
    if (submission.version !== expectedVersion)
      throw new HttpError(409, 'stale_submission', 'Kết quả xét duyệt đã thay đổi. Hãy tải lại.')
    const story = await ownStory(account, submission.storyId, session)
    if (story.publicationStatus === 'archived')
      throw new HttpError(409, 'content_frozen', 'Truyện đã được lưu trữ.')
    const target = submission.chapterId
      ? await Chapter.findOne({ _id: submission.chapterId, storyId: story._id }).session(session)
      : story
    if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy nội dung.')
    if (submission.chapterId && story.authoringFrozen)
      throw new HttpError(409, 'content_frozen', 'Truyện đang có gói thông tin chờ xử lý.')
    if (['archived', 'cancelled'].includes(target.status))
      throw new HttpError(409, 'content_frozen', 'Nội dung không còn ở vòng chỉnh sửa này.')
    const currentId = target.draftRevisionId ?? target.currentRevisionId
    const current = await ContentRevision.findOne({
      _id: currentId,
      storyId: story._id,
      authorAccountId: account._id,
      contentType: submission.chapterId ? 'chapter' : 'story',
      chapterId: submission.chapterId ?? null,
    }).session(session)
    if (!current) throw new HttpError(409, 'missing_revision', 'Không tìm thấy phiên bản hiện tại.')
    const unpublished = canReviseUnpublished(submission, target, current, story)
    const approvedUnreleased = canReviseApprovedUnreleased(submission, target, current, story)
    const rejected = submission.status === 'rejected'
    const rejectedAllowed = rejected && canReviseRejected(submission, target, current, story)
    const unpublishedReplay =
      submission.chapterId &&
      submission.status === 'approved' &&
      ['draft', 'published'].includes(target.status) &&
      String(target.publishedRevisionId) === String(submission.revisionId) &&
      current.parentRevisionId?.equals(submission.revisionId) &&
      current.status === 'editable' &&
      !current.immutableAt
    if (rejected && !rejectedAllowed)
      throw new HttpError(409, 'revision_not_allowed', 'Gói chưa đủ điều kiện tạo bản sửa.')
    if (!rejected && !unpublished && !approvedUnreleased && !unpublishedReplay)
      throw new HttpError(409, 'revision_not_allowed', 'Gói chưa đủ điều kiện tạo bản sửa.')
    if (
      current.parentRevisionId?.equals(submission.revisionId) &&
      current.status === 'editable' &&
      !current.immutableAt
    )
      return {
        id: String(current._id),
        storyId: String(story._id),
        chapterId: submission.chapterId ? String(target._id) : null,
        formatVersion: current.formatVersion,
        replayed: true,
      }
    if (!current._id.equals(submission.revisionId) || !current.immutableAt)
      throw new HttpError(409, 'stale_content', 'Nội dung đã chuyển sang phiên bản khác.')
    if (unpublished || approvedUnreleased)
      await loadSubmittedPackage(account, submission._id, session)
    const revision = await createEditableRevision({
      current,
      storyId: story._id,
      chapterId: submission.chapterId ? target._id : null,
      authorAccountId: account._id,
      session,
    })
    target.draftRevisionId = revision._id
    target.currentRevisionId = revision._id
    if (submission.chapterId) {
      if (target.status !== 'published') target.status = 'draft'
      if (approvedUnreleased) target.requestedReleaseAt = undefined
    } else {
      story.authoringFrozen = false
      if (!['published', 'unpublished'].includes(story.publicationStatus))
        story.publicationStatus = story.publishedRevisionId ? 'unpublished' : 'draft'
    }
    await target.save({ session })
    if (unpublished || approvedUnreleased) {
      story.increment()
      await story.save({ session })
    }
    if (approvedUnreleased) {
      submission.status = 'superseded'
      await submission.save({ session })
    }
    const now = new Date()
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
    )
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
    )
    if (approvedUnreleased)
      await ModerationHistory.create(
        [
          {
            aggregateType: 'chapter',
            aggregateId: target._id,
            action: 'publication.superseded',
            outcome: 'superseded',
            submissionId: submission._id,
            revisionId: current._id,
            actorAccountId: account._id,
            actorAuthorizationEpoch: account.authorizationEpoch,
            reason: 'Bản duyệt đã được thay thế bằng bản sửa mới.',
            occurredAt: now,
          },
        ],
        { session },
      )
    return {
      id: String(revision._id),
      storyId: String(story._id),
      chapterId: submission.chapterId ? String(target._id) : null,
      formatVersion: revision.formatVersion,
      replayed: false,
    }
  })
}
