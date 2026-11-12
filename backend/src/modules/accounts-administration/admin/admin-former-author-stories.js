import { z } from 'zod'
import {
  Account,
  AuditEvent,
  Category,
  ContentRevision,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { loadSubmittedPackage } from '../../authoring-publishing/author/author-submitted-package.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { storedTags, storyTagFields } from '../../authoring-publishing/content/story-tags.js'

const oid = z.string().regex(/^[a-f\d]{24}$/i)
export const formerStoryInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('correct'),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().min(1).max(10000),
      categoryId: oid,
      expectedVersion: z.number().int().min(0),
      expectedPublishedRevisionId: oid,
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.enum(['unpublish', 'republish']),
      expectedVersion: z.number().int().min(0),
      expectedPublishedRevisionId: oid,
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
])
const metadata = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).optional(),
    categoryId: oid,
    tags: storedTags.optional(),
  })
  .strict()
const unavailable = () =>
  new HttpError(
    409,
    'former_author_only',
    'Chỉ xử lý truyện từng công khai của cựu Author đang hoạt động, đã bị thu hồi quyền và đóng băng soạn thảo.',
  )

async function state(storyId, session, lockOwner = false) {
  const story = await Story.findById(storyId).session(session ?? null)
  if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.')
  const owner = lockOwner
    ? await Account.findOneAndUpdate(
        { _id: story.authorAccountId, status: 'active', everAuthor: true },
        { $inc: { version: 1 } },
        { session, returnDocument: 'after' },
      )
    : await Account.findById(story.authorAccountId).session(session ?? null)
  const roles = await RoleAssignment.find({ accountId: story.authorAccountId, role: 'author' })
    .session(session ?? null)
    .lean()
  if (
    !owner ||
    owner.status !== 'active' ||
    !owner.everAuthor ||
    !story.authoringFrozen ||
    !roles.some(role => role.status === 'revoked') ||
    roles.some(role => role.status === 'active') ||
    !['published', 'unpublished'].includes(story.publicationStatus) ||
    !story.publishedRevisionId
  )
    throw unavailable()
  const source = await ContentRevision.findOne({
    _id: story.publishedRevisionId,
    storyId: story._id,
    authorAccountId: owner._id,
    contentType: 'story',
    formatVersion: 'story-v1',
    status: { $in: ['approved', 'immutable'] },
    immutableAt: { $ne: null },
  })
    .session(session ?? null)
    .lean()
  if (!source || source.mediaIds?.length || !metadata.safeParse(source.content).success)
    throw unavailable()
  const correction = source.validation?.adminFormerAuthorCorrection
  const rootId = correction?.rootRevisionId ?? String(source._id)
  if (correction && source.packageDigest !== digest({ content: source.content, correction }))
    throw unavailable()
  const submission = await PublicationSubmission.findOne({
    revisionId: rootId,
    storyId: story._id,
    chapterId: null,
    authorAccountId: owner._id,
    status: 'approved',
  })
    .session(session ?? null)
    .lean()
  if (!submission) throw unavailable()
  const root = await loadSubmittedPackage({ _id: owner._id }, submission._id, session)
  if (
    root.revision.formatVersion !== 'story-v1' ||
    root.manifest.length ||
    root.rights.status !== 'asserted' ||
    !root.rights.asserted ||
    (correction &&
      (correction.rootPackageDigest !== root.revision.packageDigest ||
        correction.rootRightsDigest !== root.revision.rightsDigest))
  )
    throw unavailable()
  return { story, source, root, owner }
}
const view = ({ story, source, owner }) => ({
  id: String(story._id),
  title: source.content.title,
  description: source.content.description ?? '',
  categoryId: source.content.categoryId,
  status: story.publicationStatus,
  version: story.version,
  publishedRevisionId: String(source._id),
  ownerName: owner.displayName,
})
export async function formerStoryDetail(id) {
  return { story: view(await state(id)) }
}
export async function formerStoryList(page) {
  const match = {
    authoringFrozen: true,
    publishedRevisionId: { $ne: null },
    publicationStatus: { $in: ['published', 'unpublished'] },
  }
  const [items, total] = await Promise.all([
    Story.find(match)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .select('title publicationStatus authorAccountId')
      .lean(),
    Story.countDocuments(match),
  ])
  return {
    items: items.map(item => ({
      id: String(item._id),
      title: item.title,
      status: item.publicationStatus,
      authorId: String(item.authorAccountId),
    })),
    total,
    page,
    pageSize: 20,
  }
}
export async function changeFormerStory(admin, id, input) {
  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        authorizationEpoch: admin.authorizationEpoch,
        credentialVersion: admin.credentialVersion,
      },
      { $inc: { version: 1 } },
      { session },
    )
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!actor || !allowed)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    const current = await state(id, session, true)
    const { story, source, root } = current
    if (
      story.version !== input.expectedVersion ||
      String(story.publishedRevisionId) !== input.expectedPublishedRevisionId
    )
      throw new HttpError(409, 'stale_content', 'Truyện đã thay đổi. Hãy tải lại.')
    if (
      (input.action === 'unpublish' && story.publicationStatus !== 'published') ||
      (input.action === 'republish' && story.publicationStatus !== 'unpublished')
    )
      throw new HttpError(409, 'state_changed', 'Trạng thái truyện không phù hợp. Hãy tải lại.')
    const categoryId = input.action === 'correct' ? input.categoryId : source.content.categoryId
    if (
      input.action !== 'unpublish' &&
      !(await Category.exists({ _id: categoryId, status: 'active' }).session(session))
    )
      throw new HttpError(400, 'invalid_category', 'Hãy chọn một thể loại đang hoạt động.')
    const now = new Date(),
      before = story.publicationStatus,
      previous = String(source._id)
    if (input.action === 'correct') {
      const last = await ContentRevision.findOne({ storyId: story._id, contentType: 'story' })
        .sort({ revisionNumber: -1 })
        .session(session)
      const content = {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        tags: source.content.tags ?? [],
      }
      const correction = {
        rootRevisionId: String(root.revision._id),
        rootPackageDigest: root.revision.packageDigest,
        rootRightsDigest: root.revision.rightsDigest,
        previousPublishedRevisionId: previous,
        actorId: String(admin._id),
        occurredAt: now.toISOString(),
      }
      const [revision] = await ContentRevision.create(
        [
          {
            contentType: 'story',
            storyId: story._id,
            authorAccountId: story.authorAccountId,
            revisionNumber: (last?.revisionNumber ?? 0) + 1,
            parentRevisionId: source._id,
            formatVersion: 'story-v1',
            content,
            status: 'immutable',
            immutableAt: now,
            validation: { adminFormerAuthorCorrection: correction },
            packageDigest: digest({ content, correction }),
          },
        ],
        { session },
      )
      story.publishedRevisionId = revision._id
      story.currentRevisionId = revision._id
      story.title = input.title
      story.description = input.description
      story.categoryId = input.categoryId
      story.set(storyTagFields(content.tags))
    }
    if (input.action === 'unpublish') story.publicationStatus = 'unpublished'
    if (input.action === 'republish') story.publicationStatus = 'published'
    story.publicationTransition = {
      actorAccountId: admin._id,
      occurredAt: now,
      from: before,
      to: story.publicationStatus,
      result: `admin-former-author-${input.action}`,
      previousPublishedRevisionId: previous,
      rootRevisionId: String(root.revision._id),
    }
    await story.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: `former-author.story.${input.action}`,
          targetType: 'Story',
          targetId: story._id,
          targetVersion: story.version,
          result: 'accepted',
          reason: input.reason,
          occurredAt: now,
          dataDigest: digest({
            previousPublishedRevisionId: previous,
            publishedRevisionId: String(story.publishedRevisionId),
            rootRevisionId: String(root.revision._id),
          }),
        },
      ],
      { session },
    )
    return {
      story: { id: String(story._id), status: story.publicationStatus, version: story.version },
    }
  })
}
