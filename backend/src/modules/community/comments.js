import { HttpError } from '../../middleware/errors.js'
import { Account, Chapter, Comment, CommentLike } from '../../models/index.js'
import { readableChapter } from '../reading/access.js'
import { ownerWrite } from '../reading/owner-write.js'
import { publicName, publishedChapterById, requirePublishedStory } from './common.js'

export const COMMENT_PAGE_SIZE = 20

const commentNotFound = () => new HttpError(404, 'not_found', 'Không tìm thấy bình luận.')

/** Any viewer may list comments of a published story or published chapter. */
async function listableTarget(targetType, targetId) {
  if (targetType === 'story') await requirePublishedStory(targetId)
  else await publishedChapterById(targetId)
}

/** Writing needs the target readable by the signed-in account; locked chapters reject comments. */
async function writableTarget(targetType, targetId, account) {
  if (targetType === 'story') return requirePublishedStory(targetId)
  const chapter = await Chapter.findById(targetId).select('storyId').lean()
  if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương đã xuất bản.')
  try {
    await readableChapter({ storyId: String(chapter.storyId), chapterId: targetId, account })
  } catch (error) {
    if (error instanceof HttpError && [401, 403].includes(error.status))
      throw new HttpError(403, 'comment_locked', 'Chỉ có thể bình luận khi chương đã mở để đọc.')
    throw error
  }
}

async function viewContext(comments, viewer) {
  const [authors, likes] = await Promise.all([
    Account.find({ _id: { $in: comments.map(comment => comment.authorAccountId) } })
      .select('displayName status')
      .lean(),
    viewer
      ? CommentLike.find({
          accountId: viewer._id,
          commentId: { $in: comments.map(comment => comment._id) },
          status: 'active',
        })
          .select('commentId')
          .lean()
      : [],
  ])
  return {
    authors: new Map(authors.map(author => [String(author._id), author])),
    liked: new Set(likes.map(like => String(like.commentId))),
    viewerId: viewer ? String(viewer._id) : null,
  }
}

function commentView(comment, context, replies = []) {
  const authorId = String(comment.authorAccountId)
  const deleted = comment.status === 'soft-deleted'
  return {
    id: String(comment._id),
    body: deleted ? '' : comment.body,
    author: { id: authorId, displayName: publicName(context.authors.get(authorId)) },
    createdAt: comment.createdAt,
    edited: Boolean(comment.editedAt),
    deleted,
    likeCount: comment.likeCount ?? 0,
    liked: context.liked.has(String(comment._id)),
    mine: context.viewerId === authorId,
    parentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
    version: comment.version,
    replies,
  }
}

async function singleView(comment, viewer) {
  return commentView(comment, await viewContext([comment], viewer))
}

/**
 * Top-level comments newest first (20 per page) with all visible replies oldest first.
 * Hidden comments never appear; a soft-deleted top-level comment stays only as the
 * placeholder of a thread that still has visible replies.
 */
export async function listComments(targetType, targetId, page, viewer) {
  await listableTarget(targetType, targetId)
  const target = { targetType, targetId }
  const threadsWithReplies = await Comment.distinct('parentCommentId', {
    ...target,
    status: 'visible',
    parentCommentId: { $ne: null },
  })
  const filter = {
    ...target,
    parentCommentId: null,
    $or: [{ status: 'visible' }, { status: 'soft-deleted', _id: { $in: threadsWithReplies } }],
  }
  const [total, roots] = await Promise.all([
    Comment.countDocuments(filter),
    Comment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * COMMENT_PAGE_SIZE)
      .limit(COMMENT_PAGE_SIZE)
      .lean(),
  ])
  const replies = await Comment.find({
    parentCommentId: { $in: roots.map(root => root._id) },
    status: 'visible',
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()
  const context = await viewContext([...roots, ...replies], viewer)
  const repliesByParent = new Map()
  for (const reply of replies) {
    const key = String(reply.parentCommentId)
    repliesByParent.set(key, [...(repliesByParent.get(key) ?? []), commentView(reply, context)])
  }
  return {
    items: roots.map(root => commentView(root, context, repliesByParent.get(String(root._id)))),
    total,
    page,
    pageSize: COMMENT_PAGE_SIZE,
  }
}

export async function createComment(req, targetType, targetId, { body, parentId }) {
  await writableTarget(targetType, targetId, req.account)
  const comment = await ownerWrite(req, async (session, account) => {
    if (parentId) {
      const parent = await Comment.findOne({
        _id: parentId,
        targetType,
        targetId,
        status: 'visible',
        parentCommentId: null,
      })
        .select('_id')
        .session(session)
        .lean()
      if (!parent)
        throw new HttpError(
          400,
          'invalid_parent',
          'Chỉ có thể trả lời một bình luận gốc còn hiển thị.',
        )
    }
    const [created] = await Comment.create(
      [
        {
          authorAccountId: account._id,
          targetType,
          targetId,
          ...(parentId ? { parentCommentId: parentId } : {}),
          body,
        },
      ],
      { session },
    )
    return created.toObject()
  })
  return singleView(comment, req.account)
}

async function ownVisibleComment(session, account, commentId) {
  const comment = await Comment.findById(commentId).session(session)
  if (!comment) throw commentNotFound()
  if (String(comment.authorAccountId) !== String(account._id) || comment.status !== 'visible')
    throw new HttpError(403, 'forbidden', 'Bạn chỉ có thể sửa bình luận đang hiển thị của mình.')
  return comment
}

export async function editComment(req, commentId, { body, expectedVersion }, now = new Date()) {
  const comment = await ownerWrite(req, async (session, account) => {
    const comment = await ownVisibleComment(session, account, commentId)
    if (comment.version !== expectedVersion)
      throw new HttpError(409, 'stale_comment', 'Bình luận đã thay đổi. Hãy tải lại.')
    if (comment.body !== body) {
      comment.body = body
      comment.editedAt = now
      await comment.save({ session })
    }
    return comment.toObject()
  })
  return singleView(comment, req.account)
}

/** Soft delete keeps the record for audit and reports; repeating it is a no-op. */
export async function deleteComment(req, commentId) {
  await ownerWrite(req, async (session, account) => {
    const comment = await Comment.findById(commentId).session(session)
    if (!comment) throw commentNotFound()
    if (String(comment.authorAccountId) !== String(account._id))
      throw new HttpError(403, 'forbidden', 'Bạn chỉ có thể xóa bình luận của mình.')
    if (comment.status === 'soft-deleted') return
    if (comment.status !== 'visible')
      throw new HttpError(403, 'forbidden', 'Bình luận này không thể xóa.')
    comment.status = 'soft-deleted'
    await comment.save({ session })
  })
}

/** Idempotent like toggle; the counter moves only when the like state actually changes. */
export async function likeComment(req, commentId, liked, now = new Date()) {
  return ownerWrite(req, async (session, account) => {
    const comment = await Comment.findOne({ _id: commentId, status: 'visible' })
      .select('likeCount')
      .session(session)
      .lean()
    if (!comment) throw commentNotFound()
    const like = await CommentLike.findOne({ accountId: account._id, commentId }).session(session)
    const wasLiked = like?.status === 'active'
    if (liked === wasLiked) return { liked, likeCount: comment.likeCount ?? 0 }
    if (!like) await CommentLike.create([{ accountId: account._id, commentId }], { session })
    else {
      like.status = liked ? 'active' : 'removed'
      like.removedAt = liked ? undefined : now
      await like.save({ session })
    }
    const updated = await Comment.findOneAndUpdate(
      { _id: commentId },
      { $inc: { likeCount: liked ? 1 : -1 } },
      { session, returnDocument: 'after', projection: { likeCount: 1 } },
    ).lean()
    return { liked, likeCount: updated.likeCount }
  })
}
