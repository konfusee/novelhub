import { policy as policies } from '../../accounts-administration/service.js'
import {
  Chapter,
  ContentRevision,
  PolicyVersion,
  Story,
  AuditEvent,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { lockAuthor, ownStory, editable } from './author-ownership.js'
import { digest } from '../submissions/submission-digests.js'

function unreleasedOwnedRevision(chapter, revision, story) {
  return Boolean(
    !story.authoringFrozen &&
    !['submitted', 'under-review', 'archived'].includes(story.publicationStatus) &&
    !chapter.firstReleasedAt &&
    !chapter.publishedRevisionId &&
    !chapter.earlyAccess?.endsAt &&
    revision &&
    String(revision._id) === String(chapter.draftRevisionId ?? chapter.currentRevisionId) &&
    String(revision.chapterId) === String(chapter._id) &&
    String(revision.storyId) === String(story._id) &&
    String(revision.authorAccountId) === String(story.authorAccountId) &&
    revision.contentType === 'chapter',
  )
}
export function canConfigureEarlyAccess(chapter, revision, story) {
  return Boolean(
    unreleasedOwnedRevision(chapter, revision, story) &&
    chapter.status === 'draft' &&
    revision.status === 'editable' &&
    !revision.immutableAt,
  )
}
export function canDisableEarlyAccess(chapter, revision, story) {
  return Boolean(
    chapter.earlyAccess?.enabled &&
    (canConfigureEarlyAccess(chapter, revision, story) ||
      (unreleasedOwnedRevision(chapter, revision, story) &&
        ['approved', 'scheduled', 'due'].includes(chapter.status) &&
        revision.status === 'approved' &&
        revision.immutableAt)),
  )
}
async function state(account, storyId, chapterId, session) {
  const story = await ownStory(account, storyId, session)
  const chapter = await Chapter.findOne({ _id: chapterId, storyId: story._id }).session(
    session ?? null,
  )
  if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.')
  const revision = await ContentRevision.findById(
    chapter.draftRevisionId ?? chapter.currentRevisionId,
  ).session(session ?? null)
  const policy = await policies.getEffective({ session, required: false })
  return { story, chapter, revision, policy }
}
const policyView = policy =>
  policy &&
  [
    policy.priceMinCoins,
    policy.priceMaxCoins,
    policy.durationMinDays,
    policy.durationMaxDays,
  ].every(Number.isSafeInteger)
    ? {
        id: String(policy._id),
        version: policy.version,
        priceMinCoins: policy.priceMinCoins,
        priceMaxCoins: policy.priceMaxCoins,
        durationMinDays: policy.durationMinDays,
        durationMaxDays: policy.durationMaxDays,
      }
    : null
const settings = chapter =>
  chapter.earlyAccess?.enabled
    ? {
        enabled: true,
        coinPrice: chapter.earlyAccess.coinPrice,
        durationDays: chapter.earlyAccess.durationDays,
      }
    : { enabled: false, coinPrice: null, durationDays: null }
export async function prepareEarlyAccess(account, storyId, chapterId) {
  const { story, chapter, revision, policy } = await state(account, storyId, chapterId)
  return {
    chapterId: String(chapter._id),
    title: chapter.title,
    version: chapter.version,
    storyVersion: story.version,
    canEdit: canConfigureEarlyAccess(chapter, revision, story),
    canDisable: canDisableEarlyAccess(chapter, revision, story),
    policy: policyView(policy),
    settings: settings(chapter),
  }
}
export async function changeEarlyAccess(account, storyId, chapterId, input) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const { story, chapter, revision, policy } = await state(account, storyId, chapterId, session)
    editable(story)
    if (story.version !== input.expectedStoryVersion || chapter.version !== input.expectedVersion)
      throw new HttpError(409, 'stale_content', 'Truyện hoặc chương đã thay đổi. Hãy tải lại.')
    if (!(
      canConfigureEarlyAccess(chapter, revision, story) ||
      (!input.enabled && canDisableEarlyAccess(chapter, revision, story))
    ))
      throw new HttpError(
        409,
        'early_access_locked',
        'Chỉ thiết lập đọc sớm cho chương nháp chưa từng phát hành.',
      )
    const before = settings(chapter)
    if (input.enabled) {
      const bounds = policyView(policy)
      if (!bounds || bounds.id !== input.policyId || bounds.version !== input.expectedPolicyVersion)
        throw new HttpError(
          409,
          'policy_changed',
          'Chưa có policy hiện hành hoặc policy đã đổi. Hãy tải lại.',
        )
      if (
        input.coinPrice < bounds.priceMinCoins ||
        input.coinPrice > bounds.priceMaxCoins ||
        input.durationDays < bounds.durationMinDays ||
        input.durationDays > bounds.durationMaxDays
      )
        throw new HttpError(
          400,
          'invalid_early_access',
          'Giá hoặc thời hạn ngoài giới hạn policy hiện hành.',
        )
      const pinned = await PolicyVersion.findOneAndUpdate(
        { _id: policy._id, version: policy.version, status: 'effective' },
        { $inc: { version: 1 } },
        { session },
      )
      if (!pinned) throw new HttpError(409, 'policy_changed', 'Policy đã thay đổi. Hãy tải lại.')
      chapter.earlyAccess = {
        enabled: true,
        coinPrice: input.coinPrice,
        durationDays: input.durationDays,
        policyVersionId: policy._id,
      }
    } else chapter.earlyAccess = undefined
    const pinnedStory = await Story.findOneAndUpdate(
      { _id: story._id, version: story.version },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    )
    if (!pinnedStory) throw new HttpError(409, 'stale_content', 'Truyện đã thay đổi. Hãy tải lại.')
    await chapter.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'chapter.early-access-configured',
          targetType: 'chapter',
          targetId: chapter._id,
          targetVersion: chapter.version,
          result: 'accepted',
          reason: JSON.stringify({
            before,
            after: settings(chapter),
            policy: input.enabled ? policyView(policy) : null,
          }),
          occurredAt: new Date(),
          dataDigest: digest({
            before,
            after: settings(chapter),
            policyId: input.enabled ? input.policyId : null,
          }),
        },
      ],
      { session },
    )
    return {
      chapterId: String(chapter._id),
      version: chapter.version,
      storyVersion: pinnedStory.version,
      settings: settings(chapter),
    }
  })
}
