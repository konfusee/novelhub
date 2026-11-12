import request from 'supertest'
import { expect } from 'vitest'
import {
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  PublicationSubmission,
  Story,
} from '../../src/models/index.js'
import { authenticatedAccount } from './accounts.js'

// Disposable test database only. Human approvals are simulated as isolated fixtures.
export const origin = 'http://localhost:5173'

export function readingClient(app) {
  const write = (cookie, url, body, method = 'post') =>
    request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(body)
  const get = (cookie, url) => {
    const call = request(app).get(url)
    return cookie ? call.set('Cookie', cookie) : call
  }

  async function approve(submissionId) {
    const submission = await PublicationSubmission.findById(submissionId)
    submission.status = 'approved'
    await submission.save()
    const revision = await ContentRevision.findById(submission.revisionId)
    revision.status = 'approved'
    await revision.save()
    const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
    batch.status = 'available-for-human-review'
    batch.stage = 'llm'
    await batch.save()
    if (submission.chapterId) {
      const chapter = await Chapter.findById(submission.chapterId)
      if (chapter.status !== 'published') chapter.status = 'approved'
      await chapter.save()
    } else {
      const story = await Story.findById(submission.storyId)
      story.publicationStatus = 'approved'
      story.authoringFrozen = false
      await story.save()
    }
    return { submission, revision }
  }

  async function releaseChapter(author, storyId, chapterId) {
    const endpoint = `/api/author/stories/${storyId}/chapters/${chapterId}/release`
    const { target } = (await get(author.cookie, endpoint)).body
    const released = await write(author.cookie, endpoint, {
      revisionId: target.revisionId,
      submissionId: target.submissionId,
      expectedVersion: target.version,
      expectedStoryVersion: target.storyVersion,
    })
    expect(released.status).toBe(201)
  }

  async function submitChapter(author, storyId, chapterId) {
    const prepared = (
      await get(
        author.cookie,
        `/api/author/submissions/prepare?storyId=${storyId}&chapterId=${chapterId}`,
      )
    ).body
    const sent = await write(author.cookie, '/api/author/submissions', {
      storyId,
      chapterId,
      revisionId: prepared.target.revisionId,
      expectedVersion: prepared.target.version,
    })
    expect(sent.status).toBe(201)
    await approve(sent.body.submission.id)
  }

  /** Published story released by a fresh Author; returns ids and the Author. */
  async function publishStory({ title = 'Truyện đọc thử', author, authorName, category } = {}) {
    author ??= await authenticatedAccount('author', authorName ? { displayName: authorName } : {})
    category ??= await Category.create({
      name: `Kỳ ảo ${crypto.randomUUID()}`,
      normalizedName: `ky ao ${crypto.randomUUID()}`,
      createdBy: author.account._id,
    })
    const created = await write(author.cookie, '/api/author/stories', {
      title,
      description: 'Mô tả truyện thật.',
      categoryId: String(category._id),
    })
    expect(created.status).toBe(201)
    const storyId = created.body.story.id
    const prep = (await get(author.cookie, `/api/author/submissions/prepare?storyId=${storyId}`))
      .body
    const sent = await write(author.cookie, '/api/author/submissions', {
      storyId,
      revisionId: prep.target.revisionId,
      expectedVersion: prep.target.version,
      rights: { asserted: true, basis: 'original', sourceLicenceNote: '' },
    })
    expect(sent.status).toBe(201)
    const { submission, revision } = await approve(sent.body.submission.id)
    const story = await Story.findById(storyId)
    const released = await write(author.cookie, `/api/author/stories/${storyId}/release`, {
      revisionId: String(revision._id),
      submissionId: String(submission._id),
      expectedVersion: story.version,
    })
    expect(released.status).toBe(201)
    return { author, storyId, category }
  }

  /** Creates, approves and releases one chapter; returns its id. */
  async function publishChapter(author, storyId, title = 'Chương', paragraphs = ['Nội dung.']) {
    const created = await write(author.cookie, `/api/author/stories/${storyId}/chapters`, {
      title,
      paragraphs,
    })
    expect(created.status).toBe(201)
    const chapterId = created.body.chapter.id
    await submitChapter(author, storyId, chapterId)
    await releaseChapter(author, storyId, chapterId)
    return chapterId
  }

  /** Revises a published chapter through the revise workflow and re-releases it. */
  async function republishRevision(author, storyId, chapterId, paragraphs) {
    const live = await Chapter.findById(chapterId)
    const submission = await PublicationSubmission.findOne({
      chapterId,
      revisionId: live.publishedRevisionId,
    })
    const revised = await write(author.cookie, `/api/author/submissions/${submission._id}/revise`, {
      expectedVersion: submission.version,
    })
    expect(revised.status).toBe(201)
    const editorUrl = `/api/author/stories/${storyId}/chapters/${chapterId}`
    const editor = (await get(author.cookie, editorUrl)).body.chapter
    const saved = await write(
      author.cookie,
      editorUrl,
      { expectedVersion: editor.version, title: editor.title, paragraphs },
      'put',
    )
    expect(saved.status).toBe(200)
    await submitChapter(author, storyId, chapterId)
    await releaseChapter(author, storyId, chapterId)
  }

  return { get, write, publishStory, publishChapter, republishRevision }
}
