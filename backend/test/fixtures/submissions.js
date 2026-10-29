import request from 'supertest'
import { expect } from 'vitest'
import { Category, EvidenceBatch, PublicationSubmission } from '../../src/models/index.js'
import { authenticatedAccount } from './accounts.js'

// Disposable test database only. Does not load .env or write to a shared database.
export const origin = 'http://localhost:5173'

export function apiClient(app) {
  return {
    get: (cookie, url) => request(app).get(url).set('Cookie', cookie),
    write: (cookie, url, body, method = 'post') =>
      request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(body),
  }
}

export async function submitStory(
  api,
  { author, title = 'Truyện chờ kiểm duyệt', description = 'Tóm tắt thật để gửi duyệt.' } = {},
) {
  author ??= await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'ky ao ' + crypto.randomUUID(),
    createdBy: author.account._id,
  })
  const created = await api.write(author.cookie, '/api/author/stories', {
    title,
    description,
    categoryIds: [String(category._id)],
  })
  expect(created.status).toBe(201)
  const storyId = created.body.story.id
  const prepared = (
    await api.get(author.cookie, `/api/author/submissions/prepare?storyId=${storyId}`)
  ).body
  const sent = await api.write(author.cookie, '/api/author/submissions', {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  })
  expect(sent.status).toBe(201)
  return { author, category, storyId, submissionId: sent.body.submission.id }
}

export async function submitChapter(
  api,
  {
    author,
    storyId,
    title = 'Chương chờ kiểm duyệt',
    paragraphs = ['Nội dung chương thật để kiểm duyệt.'],
  },
) {
  const created = await api.write(author.cookie, `/api/author/stories/${storyId}/chapters`, {
    title,
    paragraphs,
  })
  expect(created.status).toBe(201)
  const chapterId = created.body.chapter.id
  const prepared = (
    await api.get(
      author.cookie,
      `/api/author/submissions/prepare?storyId=${storyId}&chapterId=${chapterId}`,
    )
  ).body
  const sent = await api.write(author.cookie, '/api/author/submissions', {
    storyId,
    chapterId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
  })
  expect(sent.status).toBe(201)
  return { chapterId, submissionId: sent.body.submission.id }
}

// Simulates the evidence worker's terminal transition.
export async function markEvidenceReady(submissionId, { failedStage } = {}) {
  const submission = await PublicationSubmission.findById(submissionId)
  const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
  batch.set(
    failedStage
      ? { status: 'failed', failedStage }
      : { status: 'available-for-human-review', stage: 'llm' },
  )
  await batch.save()
  submission.status = 'pending-review'
  await submission.save()
  return {
    submission: await PublicationSubmission.findById(submissionId),
    batch: await EvidenceBatch.findById(batch._id),
  }
}

export async function claim(api, moderator, submissionId) {
  const { version } = await PublicationSubmission.findById(submissionId)
  return api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/claim`, {
    expectedVersion: version,
  })
}

export async function decide(
  api,
  moderator,
  submissionId,
  { decision = 'approve', feedback = '' } = {},
) {
  const submission = await PublicationSubmission.findById(submissionId)
  const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId)
  return api.write(moderator.cookie, `/api/moderator/submissions/${submissionId}/decision`, {
    decision,
    feedback,
    expectedVersion: submission.version,
    evidenceBatchId: String(batch._id),
    evidenceBatchVersion: batch.version,
  })
}

export async function approvedStory(api, moderator, options) {
  const submitted = await submitStory(api, options)
  await markEvidenceReady(submitted.submissionId)
  expect((await claim(api, moderator, submitted.submissionId)).status).toBe(200)
  expect((await decide(api, moderator, submitted.submissionId)).status).toBe(200)
  return submitted
}
