import { Account, Chapter, Comment, Story } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { ownerWrite } from '../../reading-community/reading/owner-write.js'

const DEFAULT_PAGE_SIZE = 5
const statuses = new Set(['visible', 'hidden', 'soft-deleted'])
const sorts = new Set(['newest', 'oldest', 'az'])

const normalizeSearch = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .trim()

async function ownedTargets(accountId, storyId) {
  const stories = await Story.find({
    authorAccountId: accountId,
    publicationStatus: 'published',
    publishedRevisionId: { $ne: null },
    ...(storyId ? { _id: storyId } : {}),
    'publicationTransition.result': { $ne: 'author-draft-deleted' },
  })
    .select('_id title')
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const chapters = await Chapter.find({
    storyId: { $in: stories.map(story => story._id) },
    status: 'published',
    publishedRevisionId: { $ne: null },
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
  // Keep an empty ownership set an explicit no-op query. MongoDB rejects `$or: []`.
  return { $or: filters.length ? filters : [{ targetId: null }] }
}

function publicAuthor(author) {
  if (!author || author.status !== 'active') return 'Tài khoản đã ngừng hoạt động'
  return author.displayName || 'Độc giả'
}

export async function authorCommentList(
  accountId,
  {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    storyId,
    chapterId,
    targetType,
    status,
    search = '',
    sort = 'newest',
  } = {},
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
  const roots = await Comment.find(base).sort({ createdAt: -1, _id: -1 }).lean()
  const authors = await Account.find({
    _id: { $in: roots.map(comment => comment.authorAccountId) },
  })
    .select('displayName status')
    .lean()
  const authorsById = new Map(authors.map(author => [String(author._id), author]))
  const storiesById = new Map(stories.map(story => [String(story._id), story]))
  const chaptersById = new Map(chapters.map(chapter => [String(chapter._id), chapter]))
  const searchable = comment => {
    const chapter =
      comment.targetType === 'chapter' ? chaptersById.get(String(comment.targetId)) : null
    const story =
      comment.targetType === 'story'
        ? storiesById.get(String(comment.targetId))
        : storiesById.get(String(chapter?.storyId))
    return normalizeSearch(
      [
        comment.body,
        authorsById.get(String(comment.authorAccountId))?.displayName,
        story?.title,
        chapter?.title,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
  const needle = normalizeSearch(search)
  const filteredRoots = needle
    ? roots.filter(comment => searchable(comment).includes(needle))
    : roots
  const viewForSort = comment => {
    const chapter =
      comment.targetType === 'chapter' ? chaptersById.get(String(comment.targetId)) : null
    const story =
      comment.targetType === 'story'
        ? storiesById.get(String(comment.targetId))
        : storiesById.get(String(chapter?.storyId))
    return normalizeSearch(
      [
        authorsById.get(String(comment.authorAccountId))?.displayName,
        story?.title,
        chapter?.title,
        comment.body,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
  if (sorts.has(sort) && sort === 'oldest')
    filteredRoots.sort(
      (a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id)),
    )
  if (sorts.has(sort) && sort === 'az')
    filteredRoots.sort(
      (a, b) =>
        viewForSort(a).localeCompare(viewForSort(b), 'vi') ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )
  const total = filteredRoots.length
  const pagedRoots = filteredRoots.slice((page - 1) * pageSize, page * pageSize)
  const replies = await Comment.find({
    parentCommentId: { $in: pagedRoots.map(comment => comment._id) },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()
  const all = [...pagedRoots, ...replies]
  const allAuthors = await Account.find({
    _id: { $in: all.map(comment => comment.authorAccountId) },
  })
    .select('displayName status')
    .lean()
  const allAuthorsById = new Map(allAuthors.map(author => [String(author._id), author]))
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
      author: publicAuthor(allAuthorsById.get(String(comment.authorAccountId))),
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
    items: pagedRoots.map(root => ({
      ...view(root),
      replies: repliesByParent.get(String(root._id)) ?? [],
    })),
    stories: allStories.map(story => ({ id: String(story._id), title: story.title })),
    chapters: allChapters.map(chapter => ({
      id: String(chapter._id),
      storyId: String(chapter.storyId),
      title: chapter.title,
      number: chapter.orderKey,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
    search: String(search ?? ''),
    sort: sorts.has(sort) ? sort : 'newest',
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
