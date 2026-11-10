import { HttpError } from '../../../middleware/errors.js'
import { Chapter, Comment, ContentReport, ContentRevision, Story } from '../../../models/index.js'
import { ownerWrite } from '../reading/owner-write.js'
import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { publishedChapterById, requirePublishedStory } from './common.js'

export const EXCERPT_LENGTH = 500

/** Frozen copy of what the reporter saw, plus the published revision it came from. */
async function targetSnapshot(targetType, targetId) {
  if (targetType === 'story') {
    const card = await requirePublishedStory(targetId)
    const story = await Story.findById(targetId).select('publishedRevisionId').lean()
    return {
      revisionId: story.publishedRevisionId,
      snapshot: {
        storyId: card.id,
        title: card.title,
        description: card.description,
        authorId: card.authorId,
      },
    }
  }
  if (targetType === 'chapter') {
    const { story, chapter } = await publishedChapterById(targetId)
    const revision = await ContentRevision.findOne({
      _id: chapter.publishedRevisionId,
      chapterId: chapter._id,
      contentType: 'chapter',
    })
      .select('content formatVersion')
      .lean()
    return {
      revisionId: chapter.publishedRevisionId,
      snapshot: {
        storyId: story.id,
        chapterId: String(chapter._id),
        title: revision?.content?.title ?? chapter.title,
        orderKey: chapter.orderKey,
        excerpt: chapterTextProjection(revision).join('\n').slice(0, EXCERPT_LENGTH),
        authorId: story.authorId,
      },
    }
  }
  const comment = await Comment.findOne({ _id: targetId, status: 'visible' }).lean()
  if (!comment) throw new HttpError(404, 'not_found', 'Không tìm thấy bình luận.')
  const storyId =
    comment.targetType === 'story'
      ? comment.targetId
      : (await Chapter.findById(comment.targetId).select('storyId').lean())?.storyId
  return {
    revisionId: undefined,
    snapshot: {
      commentId: String(comment._id),
      body: comment.body,
      authorId: String(comment.authorAccountId),
      targetType: comment.targetType,
      targetId: String(comment.targetId),
      storyId: storyId ? String(storyId) : null,
    },
  }
}

export async function submitReport(req, { targetType, targetId, reason, details }) {
  const { revisionId, snapshot } = await targetSnapshot(targetType, targetId)
  return ownerWrite(req, async (session, account) => {
    const duplicate = await ContentReport.exists({
      reporterAccountId: account._id,
      targetType,
      targetId,
      status: { $in: ['open', 'under-review'] },
    }).session(session)
    if (duplicate)
      throw new HttpError(409, 'already_reported', 'Bạn đã báo cáo nội dung này và đang chờ xử lý.')
    const [report] = await ContentReport.create(
      [
        {
          reporterAccountId: account._id,
          targetType,
          targetId,
          reason,
          ...(details ? { details } : {}),
          targetRevisionId: revisionId,
          targetSnapshot: snapshot,
          targetHash: digest(snapshot),
        },
      ],
      { session },
    )
    return { id: String(report._id), status: report.status }
  })
}
