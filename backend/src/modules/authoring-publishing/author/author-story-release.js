import {
  AuditEvent,
  Category,
  EvidenceBatch,
  MediaAsset,
  PublicationSubmission,
  RightsDeclaration,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { lockAuthor, ownStory } from './author-ownership.js'
import { loadSubmittedPackage } from './author-submitted-package.js'
import { digest } from '../submissions/submission-digests.js'
import { terminalEvidenceReady } from '../../moderation-ai/review-evidence.js'

export function canReleaseStoryVersion(story, revisionId) {
  const unpublished = story.publicationStatus === 'unpublished'
  const authorWithdrew = story.publicationTransition?.result === 'author-story-unpublished'
  const restoring =
    unpublished &&
    authorWithdrew &&
    !story.draftRevisionId &&
    String(story.publishedRevisionId) === String(revisionId)
  return Boolean(
    revisionId &&
    !story.authoringFrozen &&
    ['approved', 'published', 'unpublished'].includes(story.publicationStatus) &&
    (!unpublished || authorWithdrew) &&
    (restoring || String(story.publishedRevisionId) !== String(revisionId)),
  )
}

async function releaseState(account, storyId, session) {
  const story = await ownStory(account, storyId, session)
  const revisionId = story.draftRevisionId ?? story.currentRevisionId
  const submission = revisionId
    ? await PublicationSubmission.findOne({
        storyId: story._id,
        revisionId,
        chapterId: null,
        authorAccountId: account._id,
      })
        .session(session ?? null)
        .lean()
    : null
  let snapshot = null
  if (submission) {
    try {
      snapshot = await loadSubmittedPackage(account, submission._id, session)
    } catch (error) {
      if (!(error instanceof HttpError) || ![404, 409].includes(error.status)) throw error
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
    : null
  const evidenceReady = terminalEvidenceReady(batch)
  const ids = snapshot?.revision.content.categoryIds ?? []
  const active = ids.length
    ? await Category.countDocuments({ _id: { $in: ids }, status: 'active' }).session(
        session ?? null,
      )
    : 0
  const storyMediaIds = [story.coverMediaId, story.theme?.coverBannerMediaId].filter(Boolean)
  const storyMedia = storyMediaIds.length
    ? await MediaAsset.find({
        _id: { $in: storyMediaIds },
        ownerAccountId: account._id,
        storyId: story._id,
        status: 'available',
      })
        .select('_id kind')
        .session(session ?? null)
        .lean()
    : []
  const checks = [
    {
      code: 'approval',
      ok: Boolean(
        snapshot &&
        submission.status === 'approved' &&
        ['approved', 'immutable'].includes(snapshot.revision.status),
      ),
    },
    { code: 'integrity', ok: Boolean(snapshot) },
    { code: 'evidence', ok: Boolean(evidenceReady) },
    { code: 'rights', ok: snapshot?.rights.status === 'asserted' },
    {
      code: 'categories',
      ok: ids.length > 0 && new Set(ids).size === ids.length && active === ids.length,
    },
    {
      code: 'media',
      ok:
        storyMedia.length === storyMediaIds.length &&
        (!story.coverMediaId ||
          storyMedia.some(
            item => String(item._id) === String(story.coverMediaId) && item.kind === 'cover',
          )) &&
        (!story.theme?.coverBannerMediaId ||
          storyMedia.some(
            item =>
              String(item._id) === String(story.theme.coverBannerMediaId) && item.kind === 'banner',
          )),
    },
    {
      code: 'editable',
      ok: canReleaseStoryVersion(story, revisionId),
    },
  ]
  return { story, submission, snapshot, checks }
}

export async function prepareStoryRelease(account, storyId) {
  const state = await releaseState(account, storyId)
  return {
    target: {
      storyId: String(state.story._id),
      version: state.story.version,
      revisionId: state.snapshot ? String(state.snapshot.revision._id) : null,
      submissionId: state.submission ? String(state.submission._id) : null,
      title: state.snapshot?.revision.content.title ?? state.story.title,
      restoring:
        state.story.publicationStatus === 'unpublished' &&
        String(state.story.publishedRevisionId) === String(state.snapshot?.revision._id),
    },
    ready: state.checks.every(check => check.ok),
    checks: state.checks,
  }
}

export async function publishStory(account, storyId, input) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const state = await releaseState(account, storyId, session)
    const { story, submission, snapshot, checks } = state
    if (
      !snapshot ||
      String(snapshot.revision._id) !== input.revisionId ||
      String(submission._id) !== input.submissionId
    )
      throw new HttpError(409, 'stale_content', 'Gói đã duyệt đã thay đổi. Hãy kiểm tra lại.')
    if (
      story.publicationStatus === 'published' &&
      String(story.publishedRevisionId) === input.revisionId &&
      story.publicationTransition?.submissionId === input.submissionId &&
      checks.filter(check => check.code !== 'editable').every(check => check.ok)
    )
      return { id: String(story._id), status: 'published', version: story.version, replayed: true }
    if (story.version !== input.expectedVersion)
      throw new HttpError(
        409,
        'stale_content',
        'Truyện đã thay đổi. Hãy tải lại trước khi phát hành.',
      )
    if (!checks.every(check => check.ok))
      throw new HttpError(
        409,
        'release_not_ready',
        'Thông tin truyện chưa đủ điều kiện phát hành.',
        { checks },
      )
    for (const [Model, row, status] of [
      [PublicationSubmission, submission, 'approved'],
      [RightsDeclaration, snapshot.rights, 'asserted'],
    ]) {
      const pinned = await Model.updateOne(
        { _id: row._id, version: row.version, status },
        { $inc: { version: 1 } },
        { session },
      )
      if (pinned.modifiedCount !== 1)
        throw new HttpError(
          409,
          'stale_content',
          'Kết quả duyệt hoặc quyền nội dung đã thay đổi. Hãy kiểm tra lại.',
        )
    }
    const now = new Date()
    const before = story.publicationStatus
    const previousPublishedRevisionId = story.publishedRevisionId
      ? String(story.publishedRevisionId)
      : null
    story.title = snapshot.revision.content.title
    story.description = snapshot.revision.content.description
    story.categoryIds = snapshot.revision.content.categoryIds
    story.publicationStatus = 'published'
    story.publishedRevisionId = snapshot.revision._id
    story.currentRevisionId = snapshot.revision._id
    story.draftRevisionId = undefined
    story.publishedAt = story.publishedAt ?? now
    story.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from: before,
      to: 'published',
      result: 'author-story-published',
      revisionId: input.revisionId,
      submissionId: input.submissionId,
      previousPublishedRevisionId,
    }
    await story.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'story.published',
          targetType: 'Story',
          targetId: story._id,
          targetVersion: story.version,
          result: 'accepted',
          occurredAt: now,
          dataDigest: digest({
            revisionId: input.revisionId,
            submissionId: input.submissionId,
            packageDigest: snapshot.revision.packageDigest,
            previousPublishedRevisionId,
          }),
        },
      ],
      { session },
    )
    return {
      id: String(story._id),
      status: story.publicationStatus,
      version: story.version,
      replayed: false,
    }
  })
}
