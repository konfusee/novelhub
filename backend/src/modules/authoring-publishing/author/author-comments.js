import { Account, Chapter, Comment, Story } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { ownerWrite } from '../../reading-community/reading/owner-write.js'

const PAGE_SIZE = 20
const statuses = new Set(['visible', 'hidden', 'soft-deleted'])

async function ownedTargets(accountId, storyId) {
  const stories = await Story.find({
    authorAccountId: accountId,
    ...(storyId ? { _id: storyId } : {}),
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  })
    .select('_id title')
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const chapters = await Chapter.find({
    storyId: { $in: stories.map(story => story._id) },
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  })
    .select('_id storyId title orderKey')
    .sort({ orderKey: 1, _id: 1 })
    .lean()
  return { stories, chapters }
}

function targetFilter(stories, chapters, targetType, chapterId) {
  const filters = []
  if (!chapterId && (!targetType || targetType === 'story'))
    filters.push({ targetType: 'story', targetId: { $in: stories.map(story => story._id) } })
  if (chapterId || !targetType || targetType === 'chapter')
    filters.push({ targetType: 'chapter', targetId: { $in: chapters.map(chapter => chapter._id) } })
  return { $or: filters }
}

function publicAuthor(author) {
  if (!author || author.status !== 'active') return 'Tài khoản đã ngừng hoạt động'
  return author.displayName || 'Độc giả'
}

export async function authorCommentList(
  accountId,
  { page = 1, storyId, chapterId, targetType, status } = {},
) {
  const { stories: allStories, chapters: allChapters } = await ownedTargets(accountId)
  const stories = storyId
    ? allStories.filter(story => String(story._id) === String(storyId))
    : allStories
  const chapters = allChapters.filter(
    chapter =>
      (!storyId || stories.some(story => story._id.equals(chapter.storyId))) &&
      (!chapterId || String(chapter._id) === String(chapterId)),
  )
  const base = targetFilter(stories, chapters, targetType, chapterId)
  if (status && statuses.has(status)) base.status = status
  base.parentCommentId = null
  const [total, roots] = await Promise.all([
    Comment.countDocuments(base),
    Comment.find(base)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ])
  const replies = await Comment.find({
    parentCommentId: { $in: roots.map(comment => comment._id) },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()
  const all = [...roots, ...replies]
  const authors = await Account.find({ _id: { $in: all.map(comment => comment.authorAccountId) } })
    .select('displayName status')
    .lean()
  const authorsById = new Map(authors.map(author => [String(author._id), author]))
  const storiesById = new Map(stories.map(story => [String(story._id), story]))
  const chaptersById = new Map(chapters.map(chapter => [String(chapter._id), chapter]))
  const view = comment => {
    const story =
      comment.targetType === 'story'
        ? storiesById.get(String(comment.targetId))
        : storiesById.get(String(chaptersById.get(String(comment.targetId))?.storyId))
    const chapter =
      comment.targetType === 'chapter' ? chaptersById.get(String(comment.targetId)) : null
    return {
      id: String(comment._id),
      body: comment.body,
      status: comment.status,
      author: publicAuthor(authorsById.get(String(comment.authorAccountId))),
      authorId: String(comment.authorAccountId),
      createdAt: comment.createdAt,
      edited: Boolean(comment.editedAt),
      likeCount: comment.likeCount ?? 0,
      version: comment.version,
      targetType: comment.targetType,
      targetId: String(comment.targetId),
      storyId: story ? String(story._id) : null,
      storyTitle: story?.title ?? '—',
      chapterId: chapter ? String(chapter._id) : null,
      chapterTitle: chapter?.title ?? null,
    }
  }
  const repliesByParent = new Map()
  for (const reply of replies) {
    const key = String(reply.parentCommentId)
    repliesByParent.set(key, [...(repliesByParent.get(key) ?? []), view(reply)])
  }
  return {
    items: roots.map(root => ({
      ...view(root),
      replies: repliesByParent.get(String(root._id)) ?? [],
    })),
    stories: allStories.map(story => ({ id: String(story._id), title: story.title })),
    chapters: allChapters.map(chapter => ({
      id: String(chapter._id),
      storyId: String(chapter.storyId),
      title: chapter.title,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  }
}

async function ownedComment(session, accountId, commentId) {
  const comment = await Comment.findById(commentId).session(session).lean()
  if (!comment) throw new HttpError(404, 'not_found', 'Không tìm thấy bình luận.')
  const { stories, chapters } = await ownedTargets(accountId)
  const owned =
    (comment.targetType === 'story' && stories.some(story => story._id.equals(comment.targetId))) ||
    (comment.targetType === 'chapter' &&
      chapters.some(chapter => chapter._id.equals(comment.targetId)))
  if (!owned) throw new HttpError(403, 'forbidden', 'Bạn không có quyền quản lý bình luận này.')
  return comment
}

export async function changeAuthorCommentStatus(req, commentId, status) {
  return ownerWrite(req, async (session, account) => {
    const comment = await ownedComment(session, account._id, commentId)
    await Comment.updateOne({ _id: comment._id }, { $set: { status } }).session(session)
    return { id: String(comment._id), status }
  })
}

export async function replyToAuthorComment(req, commentId, body) {
  return ownerWrite(req, async (session, account) => {
    const parent = await ownedComment(session, account._id, commentId)
    if (parent.parentCommentId || parent.status !== 'visible')
      throw new HttpError(400, 'invalid_parent', 'Chỉ có thể trả lời bình luận gốc đang hiển thị.')
    const [reply] = await Comment.create(
      [
        {
          authorAccountId: account._id,
          targetType: parent.targetType,
          targetId: parent.targetId,
          parentCommentId: parent._id,
          body,
        },
      ],
      { session },
    )
    return { id: String(reply._id), status: reply.status }
  })
}
