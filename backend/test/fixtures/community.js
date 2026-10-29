import { Category, Chapter, ContentRevision, Story } from '../../src/models/index.js'
import { authenticatedAccount } from './accounts.js'

// Disposable test database only. Builds a published story with published text chapters
// directly, so community tests do not depend on the submission/review pipeline.
export async function publishedStory({
  author,
  title = 'Truyện cộng đồng',
  description = 'Tóm tắt truyện cộng đồng.',
  chapters = [{ title: 'Chương một', paragraphs: ['Mở đầu câu chuyện.'] }],
} = {}) {
  author ??= await authenticatedAccount('author')
  const authorAccountId = author.account._id
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: `ky ao ${crypto.randomUUID()}`,
    createdBy: authorAccountId,
  })
  const story = new Story({
    authorAccountId,
    title,
    description,
    categoryIds: [category._id],
    publicationStatus: 'published',
    publishedAt: new Date(),
  })
  const revision = await ContentRevision.create({
    contentType: 'story',
    storyId: story._id,
    authorAccountId,
    revisionNumber: 1,
    formatVersion: 'story-v1',
    content: { title, description, categoryIds: [String(category._id)] },
    status: 'approved',
    immutableAt: new Date(),
  })
  story.set({
    draftRevisionId: revision._id,
    currentRevisionId: revision._id,
    publishedRevisionId: revision._id,
  })
  await story.save()
  const created = []
  for (const [index, chapter] of chapters.entries()) {
    const document = new Chapter({
      storyId: story._id,
      orderKey: index + 1,
      title: chapter.title,
      status: 'published',
      publishedAt: new Date(),
      firstReleasedAt: new Date(),
      ...(chapter.earlyAccess ? { earlyAccess: chapter.earlyAccess } : {}),
    })
    const chapterRevision = await ContentRevision.create({
      contentType: 'chapter',
      storyId: story._id,
      chapterId: document._id,
      authorAccountId,
      revisionNumber: 1,
      formatVersion: 'blocks-v1',
      content: {
        title: chapter.title,
        blocks: chapter.paragraphs.map(text => ({ type: 'paragraph', text })),
      },
      status: 'approved',
      immutableAt: new Date(),
    })
    document.set({
      draftRevisionId: chapterRevision._id,
      currentRevisionId: chapterRevision._id,
      publishedRevisionId: chapterRevision._id,
    })
    await document.save()
    created.push(String(document._id))
  }
  return { author, storyId: String(story._id), chapterIds: created, category }
}
