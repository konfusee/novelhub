import { Account, Chapter, Comment, ContentRevision, Story } from '../../../models/index.js'
import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { publicName } from '../../reading-community/community/common.js'
import { EXCERPT_LENGTH } from '../../reading-community/community/reports.js'

/**
 * The story, chapter or comment behind a content report (SDS ReportTargets): allowed-action
 * matrix, current state beside the stored snapshot, and the restriction an action applies.
 */

/** BR-NEW-S02: the actions a Moderator may take for each target type. */
export const ALLOWED_REPORT_ACTIONS = {
  story: ['dismiss', 'unpublish-story', 'warn-author'],
  chapter: ['dismiss', 'unpublish-chapter', 'unpublish-story', 'warn-author'],
  comment: ['dismiss', 'hide-comment'],
}
/** Actions that restrict content and therefore need the page's second confirmation. */
export const RESTRICTING_ACTIONS = ['hide-comment', 'unpublish-chapter', 'unpublish-story']

const LIST_TITLE_LENGTH = 80
const clip = (text, length = EXCERPT_LENGTH) => (text ?? '').slice(0, length)
const sameId = (left, right) => Boolean(left && right) && String(left) === String(right)
const idOrNull = value => (value ? String(value) : null)

/** The snapshot captured when the report was filed, normalised for display; never altered. */
export function reportSnapshot(report) {
  const stored = report.targetSnapshot ?? {}
  return {
    targetType: report.targetType,
    title: stored.title ?? '',
    excerpt: stored.excerpt ?? stored.description ?? stored.body ?? '',
    authorAccountId: idOrNull(stored.authorId),
    revisionId: idOrNull(report.targetRevisionId),
    digest: report.targetHash ?? null,
    capturedAt: report.submittedAt,
  }
}

/** Title of the target in lists: the snapshot title, or the start of a reported comment. */
export function snapshotTitle(report) {
  const stored = report.targetSnapshot ?? {}
  return stored.title || clip(stored.body, LIST_TITLE_LENGTH)
}

async function ownerName(accountId, session) {
  if (!accountId) return ''
  const owner = await Account.findById(accountId)
    .select('displayName status')
    .session(session)
    .lean()
  return publicName(owner)
}

async function currentComment(report, session) {
  const comment = await Comment.findById(report.targetId)
    .select('authorAccountId body status targetType targetId')
    .session(session)
    .lean()
  if (!comment || comment.status === 'soft-deleted') return null
  const chapter =
    comment.targetType === 'chapter'
      ? await Chapter.findById(comment.targetId).select('storyId').session(session).lean()
      : null
  return {
    state:
      comment.status === 'hidden'
        ? 'hidden'
        : comment.body !== report.targetSnapshot?.body
          ? 'changed'
          : 'visible',
    title: '',
    excerpt: clip(comment.body),
    ownerAccountId: comment.authorAccountId,
    storyId: idOrNull(comment.targetType === 'story' ? comment.targetId : chapter?.storyId),
    chapterId: comment.targetType === 'chapter' ? String(comment.targetId) : null,
  }
}

async function currentChapter(report, session) {
  const chapter = await Chapter.findById(report.targetId)
    .select('storyId title status publishedRevisionId')
    .session(session)
    .lean()
  if (!chapter) return null
  const [story, revision] = await Promise.all([
    Story.findById(chapter.storyId)
      .select('authorAccountId title publicationStatus')
      .session(session)
      .lean(),
    chapter.publishedRevisionId
      ? ContentRevision.findById(chapter.publishedRevisionId)
          .select('content formatVersion')
          .session(session)
          .lean()
      : null,
  ])
  if (!story) return null
  const published = chapter.status === 'published' && story.publicationStatus === 'published'
  return {
    state: !published
      ? 'unpublished'
      : !sameId(chapter.publishedRevisionId, report.targetRevisionId)
        ? 'changed'
        : 'visible',
    title: revision?.content?.title ?? chapter.title,
    excerpt: revision ? clip(chapterTextProjection(revision).join('\n')) : '',
    ownerAccountId: story.authorAccountId,
    storyId: String(chapter.storyId),
    storyTitle: story.title,
    chapterId: String(chapter._id),
  }
}

async function currentStory(report, session) {
  const story = await Story.findById(report.targetId)
    .select('authorAccountId title description publicationStatus publishedRevisionId')
    .session(session)
    .lean()
  if (!story) return null
  return {
    state:
      story.publicationStatus !== 'published'
        ? 'unpublished'
        : !sameId(story.publishedRevisionId, report.targetRevisionId)
          ? 'changed'
          : 'visible',
    title: story.title,
    excerpt: clip(story.description),
    ownerAccountId: story.authorAccountId,
    storyId: String(story._id),
    chapterId: null,
  }
}

const CURRENT = { comment: currentComment, chapter: currentChapter, story: currentStory }

/**
 * Re-reads the target: deleted, hidden (comment), unpublished (story, chapter or a chapter of an
 * unpublished story), changed (visible but differing from the snapshot) or visible (UC-MOD-05 AF4).
 * A chapter target also carries its parent story's title (storyTitle).
 */
export async function currentTarget(report, session = null) {
  const current = await CURRENT[report.targetType](report, session)
  if (!current)
    return {
      state: 'deleted',
      title: '',
      excerpt: '',
      ownerAccountId: null,
      ownerName: '',
      storyId: null,
      chapterId: null,
    }
  return {
    ...current,
    ownerAccountId: String(current.ownerAccountId),
    ownerName: await ownerName(current.ownerAccountId, session),
  }
}

/**
 * The document an action applies to: the comment for hide-comment, the chapter for
 * unpublish-chapter, the story (the parent story of a chapter report) for unpublish-story and
 * warn-author; null when it no longer exists.
 */
export async function actionTarget(report, action, session) {
  if (action === 'hide-comment')
    return Comment.findOne({ _id: report.targetId, status: { $ne: 'soft-deleted' } })
      .session(session)
      .lean()
  if (action === 'unpublish-chapter')
    return Chapter.findById(report.targetId).session(session).lean()
  const storyId =
    report.targetType === 'chapter'
      ? (await Chapter.findById(report.targetId).select('storyId').session(session).lean())?.storyId
      : report.targetId
  return storyId ? Story.findById(storyId).session(session).lean() : null
}

const transition = (account, now) => ({
  actorAccountId: account._id,
  occurredAt: now,
  from: 'published',
  to: 'unpublished',
  result: 'moderator-report-unpublished',
})

/**
 * Restricts the target with a conditional update (visible comment → hidden, published chapter or
 * story → unpublished). Returns true only when a document changed; false when it was already
 * restricted (UC-MOD-06 AF3).
 */
export async function restrictTarget(target, action, account, now, session) {
  const unpublished = transition(account, now)
  const [Model, filter, restricted] =
    action === 'hide-comment'
      ? [Comment, { status: 'visible' }, { status: 'hidden' }]
      : action === 'unpublish-chapter'
        ? [
            Chapter,
            { status: 'published' },
            { status: 'unpublished', publicationTransition: unpublished },
          ]
        : [
            Story,
            { publicationStatus: 'published' },
            {
              publicationStatus: 'unpublished',
              publicationTransition: target.publishedRevisionId
                ? { ...unpublished, revisionId: String(target.publishedRevisionId) }
                : unpublished,
            },
          ]
  const result = await Model.updateOne(
    { _id: target._id, ...filter },
    { $set: restricted, $inc: { version: 1 } },
    { session },
  )
  return result.modifiedCount === 1
}
