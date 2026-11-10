import { createHash } from 'node:crypto'
import { AuditEvent, Chapter, ContentRevision } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { lockAuthor, ownStory } from './author-ownership.js'
import { draftLifecycle } from './author-story-lifecycle.js'

export function canReorderDraftChapters(chapters, revisions, lifecycle) {
  if (!lifecycle.canArchive || chapters.length < 2 || chapters.length > 1000) return false
  const sources = new Map(revisions.map(revision => [String(revision._id), revision]))
  return (
    chapters.every(chapter => {
      const source = sources.get(String(chapter.draftRevisionId ?? chapter.currentRevisionId))
      return (
        chapter.status === 'draft' &&
        Number.isSafeInteger(chapter.orderKey) &&
        source &&
        String(source.chapterId) === String(chapter._id) &&
        source.status === 'editable' &&
        !source.immutableAt
      )
    }) &&
    Number.isSafeInteger(
      Math.max(chapters.length, ...chapters.map(chapter => chapter.orderKey)) + chapters.length + 1,
    )
  )
}

export async function reorderDraftChapters(account, storyId, input) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const story = await ownStory(account, storyId, session)
    if (story.version !== input.expectedVersion)
      throw new HttpError(
        409,
        'stale_content',
        'Truyện đã thay đổi. Hãy tải lại trước khi sắp xếp.',
      )
    const lifecycle = await draftLifecycle(story, session)
    const chapters = await Chapter.find({
      storyId: story._id,
      'publicationTransition.result': { $ne: 'author-draft-deleted' },
    })
      .sort({ orderKey: 1 })
      .limit(1001)
      .session(session)
    const revisions = await ContentRevision.find({
      _id: {
        $in: chapters
          .map(chapter => chapter.draftRevisionId ?? chapter.currentRevisionId)
          .filter(Boolean),
      },
      storyId: story._id,
      authorAccountId: account._id,
      contentType: 'chapter',
    })
      .select('chapterId status immutableAt')
      .session(session)
      .lean()
    if (!canReorderDraftChapters(chapters, revisions, lifecycle))
      throw new HttpError(
        409,
        'reorder_not_allowed',
        'Chỉ sắp xếp chương nháp riêng tư, chưa phát hành và không có gói đang chờ duyệt.',
      )
    const byId = new Map(chapters.map(chapter => [String(chapter._id), chapter]))
    if (
      input.chapters.length !== chapters.length ||
      input.chapters.some(
        item => !byId.has(item.id) || byId.get(item.id).version !== item.expectedVersion,
      )
    )
      throw new HttpError(
        409,
        'stale_chapters',
        'Danh sách chương đã thay đổi. Hãy tải lại trước khi sắp xếp.',
      )
    const before = chapters.map(chapter => String(chapter._id))
    const after = input.chapters.map(item => item.id)
    const ordered = after.map(id => byId.get(id))
    const changed = ordered.some((chapter, index) => chapter.orderKey !== index + 1)
    if (changed) {
      // Stage outside both existing keys and final 1..N keys to avoid the unique
      // storyId/orderKey index during swaps. Every write stays in the transaction.
      const temporary = Math.max(chapters.length, ...chapters.map(chapter => chapter.orderKey)) + 1
      for (const phase of [0, 1]) {
        const result = await Chapter.bulkWrite(
          ordered.map((chapter, index) => ({
            updateOne: {
              filter: { _id: chapter._id, storyId: story._id, version: chapter.version + phase },
              update: {
                $set: { orderKey: phase === 0 ? temporary + index : index + 1 },
                $inc: { version: 1 },
              },
            },
          })),
          { session, ordered: true },
        )
        if (result.matchedCount !== ordered.length)
          throw new HttpError(
            409,
            'stale_chapters',
            'Chương đã thay đổi. Hãy tải lại trước khi sắp xếp.',
          )
      }
      for (const [index, chapter] of ordered.entries()) {
        chapter.orderKey = index + 1
        chapter.version += 2
      }
      story.increment()
      await story.save({ session })
      const reason = JSON.stringify({ before, after })
      await AuditEvent.create(
        [
          {
            actorType: 'account',
            actorId: account._id,
            action: 'story.chapters-reordered',
            targetType: 'Story',
            targetId: story._id,
            targetVersion: story.version,
            result: 'accepted',
            occurredAt: new Date(),
            reason,
            dataDigest: createHash('sha256').update(reason).digest('hex'),
          },
        ],
        { session },
      )
    }
    return {
      story: { id: String(story._id), version: story.version },
      chapters: ordered.map(chapter => ({
        id: String(chapter._id),
        number: chapter.orderKey,
        version: chapter.version,
      })),
    }
  })
}
