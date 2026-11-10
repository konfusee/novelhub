import { Chapter, ContentRevision, Story } from '../../../models/index.js'
import { chapterTextProjection } from '../content/rich-chapter-document.js'

export async function authorDrafts(accountId) {
  const stories = await Story.find({
    authorAccountId: accountId,
    authoringFrozen: false,
    publicationStatus: { $nin: ['submitted', 'under-review', 'archived'] },
  })
    .sort({ updatedAt: -1 })
    .lean()
  const chapters = await Chapter.find({
    storyId: { $in: stories.map(story => story._id) },
    status: 'draft',
  })
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const revisions = await ContentRevision.find({
    _id: { $in: chapters.map(chapter => chapter.draftRevisionId).filter(Boolean) },
    authorAccountId: accountId,
    contentType: 'chapter',
    status: 'editable',
  }).lean()
  const items = chapters.flatMap((chapter, order) => {
    const revision = revisions.find(
      item =>
        item._id.equals(chapter.draftRevisionId) &&
        item.chapterId?.equals(chapter._id) &&
        item.storyId.equals(chapter.storyId),
    )
    if (!revision) return []
    const paragraphs = chapterTextProjection(revision)
    return [
      {
        id: String(chapter._id),
        storyId: String(chapter.storyId),
        story: stories.find(story => story._id.equals(chapter.storyId)).title,
        title: revision.content?.title ?? chapter.title,
        words: paragraphs.reduce((sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0), 0),
        excerpt: paragraphs.join('\n\n').slice(0, 400),
        updatedAt: chapter.updatedAt,
        version: chapter.version,
        order,
        type: 'Chapter Draft',
        meta: 'Stored',
        tone: 'green',
      },
    ]
  })
  const history = await ContentRevision.find({
    chapterId: { $in: items.map(item => item.id) },
    authorAccountId: accountId,
    contentType: 'chapter',
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(4)
    .select('storyId chapterId content.title revisionNumber createdAt')
    .lean()
  return {
    items,
    stories: stories.map(story => ({ id: String(story._id), title: story.title })),
    history: history.map(revision => ({
      id: String(revision._id),
      storyId: String(revision.storyId),
      chapterId: String(revision.chapterId),
      title: revision.content?.title ?? '',
      number: revision.revisionNumber,
      createdAt: revision.createdAt,
    })),
    storage: null,
  }
}
