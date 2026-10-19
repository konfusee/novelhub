import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ContentRevision, PublicationSubmission, RightsDeclaration } from '../models/index.js'
import { HttpError } from '../middleware/errors.js'
import { ownStory } from './author-ownership.js'
import { readAuthorMedia } from './author-media.js'
import { chapterMediaIds, readRichChapter } from './rich-chapter-document.js'
import { digest, rightsFacts } from './submission-digests.js'

const oid = z.string().regex(/^[a-f\d]{24}$/)
const manifestSchema = z
  .array(
    z
      .object({
        mediaId: oid,
        checksum: z.string().regex(/^[a-f\d]{64}$/),
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(10 * 1024 * 1024),
        contentType: z.literal('image/webp'),
        storageProvider: z.literal('local'),
      })
      .strict(),
  )
  .min(1)
  .max(20)
const unavailable = () =>
  new HttpError(
    409,
    'package_unavailable',
    'Gói đã gửi không còn đủ dữ liệu toàn vẹn để xem. Bản gốc được giữ nguyên.',
  )

export async function loadSubmittedPackage(account, submissionId, session) {
  const submission = await PublicationSubmission.findOne({
    _id: submissionId,
    authorAccountId: account._id,
  })
    .session(session ?? null)
    .lean()
  if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy gói đã gửi.')
  await ownStory(account, submission.storyId, session)
  const revision = await ContentRevision.findOne({
    _id: submission.revisionId,
    storyId: submission.storyId,
    authorAccountId: account._id,
    chapterId: submission.chapterId ?? null,
    contentType: submission.chapterId ? 'chapter' : 'story',
    immutableAt: { $ne: null },
  })
    .session(session ?? null)
    .lean()
  if (!revision?.packageDigest || revision.packageDigest !== submission.packageDigest)
    throw unavailable()
  const rights = await RightsDeclaration.findOne({
    _id: revision.rightsDeclarationId,
    storyId: submission.storyId,
    declaredBy: account._id,
    asserted: true,
    immutableAt: { $ne: null },
  })
    .session(session ?? null)
    .lean()
  if (!rights) throw unavailable()
  const illustrated = revision.formatVersion === 'blocks-v3'
  if (
    (!submission.chapterId || illustrated) &&
    (String(rights.revisionId) !== String(revision._id) ||
      String(rights.submissionId) !== String(submission._id))
  )
    throw unavailable()
  let manifest = []
  let document
  if (submission.chapterId) document = readRichChapter(revision)
  else if (
    revision.formatVersion !== 'story-v1' ||
    !z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(10000),
        categoryIds: z.array(oid).min(1).max(10),
      })
      .strict()
      .safeParse(revision.content).success
  )
    throw unavailable()
  if (illustrated) {
    const result = manifestSchema.safeParse(revision.validation?.mediaManifest)
    if (
      !result.success ||
      revision.validation?.mediaManifestVersion !== 'chapter-images-v1' ||
      revision.validation?.validator !== 'publishing-images-v1'
    )
      throw unavailable()
    manifest = result.data
    if (
      JSON.stringify(chapterMediaIds(document)) !==
        JSON.stringify(manifest.map(item => item.mediaId)) ||
      JSON.stringify(revision.mediaIds.map(String)) !==
        JSON.stringify(manifest.map(item => item.mediaId))
    )
      throw unavailable()
  } else if (revision.mediaIds?.length) throw unavailable()
  const mediaDigest = illustrated
    ? createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
    : digest([])
  const parentRightsId = illustrated
    ? revision.validation.parentRightsDeclarationId
    : String(rights._id)
  let parent = null
  if (submission.chapterId) {
    if (!oid.safeParse(parentRightsId).success) throw unavailable()
    const parentRights = await RightsDeclaration.findOne({
      _id: parentRightsId,
      storyId: submission.storyId,
      declaredBy: account._id,
      asserted: true,
      immutableAt: { $ne: null },
    })
      .session(session ?? null)
      .lean()
    parent = parentRights
      ? await ContentRevision.findOne({
          _id: parentRights.revisionId,
          storyId: submission.storyId,
          authorAccountId: account._id,
          contentType: 'story',
          immutableAt: { $ne: null },
        })
          .session(session ?? null)
          .lean()
      : null
    if (!parent || typeof parent.content?.title !== 'string') throw unavailable()
  }
  const rightsDigest = illustrated
    ? digest({
        declaration: rightsFacts(rights),
        parentRightsDeclarationId: parentRightsId,
        mediaDigest,
      })
    : digest(rightsFacts(rights))
  if (
    mediaDigest !== revision.mediaDigest ||
    rightsDigest !== revision.rightsDigest ||
    digest({
      formatVersion: revision.formatVersion,
      content: revision.content,
      rightsDigest,
      mediaDigest,
    }) !== revision.packageDigest
  )
    throw unavailable()
  return { submission, revision, rights, parent, manifest, document }
}

export async function submittedPackage(account, submissionId) {
  const { submission, revision, rights, parent, manifest, document } = await loadSubmittedPackage(
    account,
    submissionId,
  )
  return {
    submission: {
      id: String(submission._id),
      status: submission.status,
      submittedAt: submission.submittedAt,
    },
    story: {
      id: String(submission.storyId),
      title: parent?.content.title ?? revision.content.title,
    },
    revision: {
      id: String(revision._id),
      number: revision.revisionNumber,
      formatVersion: revision.formatVersion,
    },
    packageDigest: revision.packageDigest,
    rights: rightsFacts(rights),
    media: manifest,
    ...(submission.chapterId
      ? { chapter: { id: String(submission.chapterId), document } }
      : { metadata: revision.content }),
  }
}

export async function submittedImage(
  config,
  account,
  submissionId,
  mediaId,
  { requireApproved = false } = {},
) {
  const { manifest, submission, revision, rights } = await loadSubmittedPackage(
    account,
    submissionId,
  )
  if (
    requireApproved &&
    (submission.status !== 'approved' ||
      !['approved', 'immutable'].includes(revision.status) ||
      rights.status !== 'asserted')
  )
    throw new HttpError(404, 'not_found', 'Ảnh chưa sẵn sàng.')
  const entry = manifest.find(item => item.mediaId === mediaId)
  if (!entry) throw new HttpError(404, 'not_found', 'Ảnh không thuộc gói đã gửi.')
  const bytes = await readAuthorMedia(config, account._id, mediaId)
  if (
    bytes.length !== entry.sizeBytes ||
    createHash('sha256').update(bytes).digest('hex') !== entry.checksum
  )
    throw new HttpError(409, 'media_changed', 'Ảnh không khớp gói đã gửi.')
  return bytes
}
