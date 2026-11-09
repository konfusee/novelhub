import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  ContentRevision,
  EmbeddingArtifact,
  EvidenceBatch,
  LlmReview,
  ProcessingAttempt,
  PublicationSubmission,
  SimilarityFinding,
} from '../src/models/index.js'
import {
  prepareRevisionEmbeddings,
  processEvidenceBatches,
  startEvidenceWorker,
} from '../src/modules/moderation-ai/ai/evidence-worker.js'
import { StageError } from '../src/modules/moderation-ai/ai/stage-error.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import {
  apiClient,
  approvedStory,
  claim,
  origin,
  submitChapter,
  submitStory,
} from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

// Injected doubles only: no test calls OpenAI or $vectorSearch.
useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const DIMENSIONS = 8
const vectorFor = text => {
  const v = Array.from({ length: DIMENSIONS }, (_, i) =>
    [...text].reduce((s, c, j) => s + (((c.codePointAt(0) + j) % (i + 3)) + 1), 0),
  )
  const norm = Math.hypot(...v)
  return v.map(x => x / norm)
}
// Exact search over stored artifacts, shaped like the production $vectorSearch projection.
async function honestFindSimilar({ queries, eligibleRevisionIds, model, chunkingVersion, limit }) {
  const artifacts = await EmbeddingArtifact.find({
    revisionId: { $in: eligibleRevisionIds },
    model,
    chunkingVersion,
  }).lean()
  return queries.map(query => ({
    queryPassageId: query.passageId,
    hits: artifacts
      .map(artifact => ({
        artifact,
        cos: artifact.vector.reduce((sum, x, i) => sum + x * query.vector[i], 0),
      }))
      .sort((a, b) => b.cos - a.cos)
      .slice(0, limit)
      .map(({ artifact, cos }) => ({
        artifactId: String(artifact._id),
        revisionId: String(artifact.revisionId),
        passageId: artifact.passageId,
        authorAccountId: String(artifact.authorAccountId),
        score: Math.min(1, Math.max(0, (1 + cos) / 2)),
      })),
  }))
}
const doubles = (overrides = {}) => ({
  embed: vi.fn(async texts => ({
    vectors: texts.map(vectorFor),
    dimensions: DIMENSIONS,
    provider: 'test',
    metadata: { usage: { prompt_tokens: texts.length, total_tokens: texts.length } },
  })),
  review: vi.fn(async () => ({
    output: {
      summary: 'Tóm tắt kiểm thử',
      riskLevel: 'low',
      riskReasons: ['Không thấy rủi ro rõ ràng.'],
      suggestions: ['Giữ nguyên.'],
      findingAssessments: [],
    },
    provider: 'test',
    metadata: { usage: { input_tokens: 1, output_tokens: 1 } },
  })),
  findSimilar: vi.fn(honestFindSimilar),
  ...overrides,
})
const configWith = ai =>
  testConfig({
    cookieName: 'novelhub_session',
    corsOrigin: origin,
    ai: { ...testConfig().ai, ...ai },
  })

const PARAGRAPHS = [
  'Gió thổi qua thung lũng, mang theo mùi hương của những cánh đồng lúa chín vàng.',
  'Cô gái đứng trên đồi, nhìn về phía ngôi làng nhỏ nơi cô đã lớn lên.',
]
const batchOf = async submissionId =>
  EvidenceBatch.findById(
    (await PublicationSubmission.findById(submissionId)).currentEvidenceBatchId,
  )
const statusOf = async submissionId => (await PublicationSubmission.findById(submissionId)).status
const revisionOf = async submissionId =>
  (await PublicationSubmission.findById(submissionId)).revisionId
const attemptsOf = batchId => ProcessingAttempt.find({ batchId }).sort({ createdAt: 1, _id: 1 })
async function chapterBy(moderator, { title, paragraphs = PARAGRAPHS } = {}) {
  const author = await authenticatedAccount('author')
  const { storyId } = await approvedStory(api, moderator, { author })
  const chapter = await submitChapter(api, { author, storyId, title, paragraphs })
  return { author, storyId, ...chapter }
}

describe('evidence worker', () => {
  it('runs embedding, comparison and LLM for a chapter and hands it to moderators', async () => {
    const moderator = await authenticatedAccount('moderator')
    const b = await chapterBy(moderator, { title: 'Chương của B' })
    const a = await chapterBy(moderator, { title: 'Chương của A' })
    const d = doubles()
    await processEvidenceBatches(configWith(d), { now: new Date() })
    const batch = await batchOf(a.submissionId)
    expect(batch.status).toBe('available-for-human-review')
    expect(batch.stage).toBe('llm')
    expect(batch.activeLeaseId).toBeUndefined()
    expect(batch.outputSchemaVersion).toBe('novelhub-review-criteria-v1')
    expect(await statusOf(a.submissionId)).toBe('pending-review')
    const findings = await SimilarityFinding.find({ batchId: batch._id })
    expect(findings.length).toBeGreaterThanOrEqual(1)
    for (const finding of findings) {
      expect(String(finding.sourceChapterId)).toBe(b.chapterId)
      expect(String(finding.sourceAuthorAccountId)).toBe(String(b.author.account._id))
      expect(finding.score).toBeGreaterThanOrEqual(0)
      expect(finding.score).toBeLessThanOrEqual(1)
      expect(finding.matchedSnippets[0].sourceText.length).toBeGreaterThan(0)
    }
    const reviews = await LlmReview.find({ batchId: batch._id })
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toMatchObject({
      status: 'succeeded',
      summary: 'Tóm tắt kiểm thử',
      riskLevel: 'low',
    })
    expect(reviews[0].reviewedChars).toBe(reviews[0].totalChars)
    const attempts = await attemptsOf(batch._id)
    expect(attempts.map(attempt => attempt.status)).toEqual(['succeeded', 'succeeded', 'succeeded'])
    expect(attempts.map(attempt => attempt.attemptKey).sort()).toEqual(
      [batch._id + ':comparison:1', batch._id + ':embedding:1', batch._id + ':llm:1'].sort(),
    )
    const detail = await api.get(moderator.cookie, `/api/moderator/submissions/${a.submissionId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.evidence.findings[0].sourceChapterTitle).toBe('Chương của B')
    expect(detail.body.evidence.llmReview.summary).toBe('Tóm tắt kiểm thử')
  })

  it("excludes the submitter's own chapters and cancelled sources", async () => {
    const moderator = await authenticatedAccount('moderator')
    const a1 = await chapterBy(moderator, { title: 'A thứ nhất' })
    const a2 = await submitChapter(api, {
      author: a1.author,
      storyId: a1.storyId,
      title: 'A thứ hai',
      paragraphs: PARAGRAPHS,
    })
    const c = await chapterBy(moderator, { title: 'Chương C' })
    await PublicationSubmission.updateOne(
      { _id: c.submissionId, status: 'validated' },
      { $set: { status: 'cancelled' }, $inc: { version: 1 } },
    )
    const d = doubles()
    await processEvidenceBatches(configWith(d), { now: new Date() })
    expect(
      await SimilarityFinding.countDocuments({ batchId: (await batchOf(a2.submissionId))._id }),
    ).toBe(0)
    const excluded = (await Promise.all([a1, a2, c].map(row => revisionOf(row.submissionId)))).map(
      String,
    )
    expect(d.findSimilar).toHaveBeenCalled()
    for (const [args] of d.findSimilar.mock.calls) {
      const ids = args.eligibleRevisionIds.map(String)
      for (const id of excluded) expect(ids).not.toContain(id)
    }
  })

  it('sends an empty discovery to the LLM', async () => {
    const moderator = await authenticatedAccount('moderator')
    const a = await chapterBy(moderator)
    const d = doubles()
    await processEvidenceBatches(configWith(d), { now: new Date() })
    const batch = await batchOf(a.submissionId)
    expect(await SimilarityFinding.countDocuments({ batchId: batch._id })).toBe(0)
    expect(d.review).toHaveBeenCalledTimes(1)
    expect(JSON.parse(d.review.mock.calls[0][0].input).findings).toEqual([])
    expect(batch.status).toBe('available-for-human-review')
  })

  it('runs story-metadata submissions without vector comparison', async () => {
    const { submissionId } = await submitStory(api)
    const d = doubles()
    await processEvidenceBatches(configWith(d), { now: new Date() })
    expect(d.findSimilar).not.toHaveBeenCalled()
    const batch = await batchOf(submissionId)
    const comparison = await ProcessingAttempt.findOne({ batchId: batch._id, stage: 'comparison' })
    expect(comparison.status).toBe('succeeded')
    expect(comparison.responseMetadata.skipped).toBe('story-metadata')
    expect(d.review).toHaveBeenCalledTimes(1)
    expect(await statusOf(submissionId)).toBe('pending-review')
  })

  it('fails embedding to manual review when OpenAI is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-from-shell')
    const moderator = await authenticatedAccount('moderator')
    const { submissionId } = await submitStory(api)
    await processEvidenceBatches(configWith({}), { now: new Date() })
    const batch = await batchOf(submissionId)
    expect(batch.status).toBe('failed')
    expect(batch.failedStage).toBe('embedding')
    expect(batch.activeLeaseId).toBeUndefined()
    expect(await statusOf(submissionId)).toBe('pending-review')
    const [attempt] = await attemptsOf(batch._id)
    expect(attempt.failureCode).toBe('provider-unconfigured')
    expect((await claim(api, moderator, submissionId)).status).toBe(200)
  })

  it('fails comparison when the vector index is unavailable', async () => {
    const moderator = await authenticatedAccount('moderator')
    const a = await chapterBy(moderator)
    const d = doubles({
      findSimilar: vi.fn(async () => {
        throw new StageError('vector-index-unavailable')
      }),
    })
    await processEvidenceBatches(configWith(d), { now: new Date() })
    const batch = await batchOf(a.submissionId)
    expect(batch.status).toBe('failed')
    expect(batch.failedStage).toBe('comparison')
    expect(await SimilarityFinding.countDocuments({ batchId: batch._id })).toBe(0)
    expect(d.review).not.toHaveBeenCalled()
    expect(await statusOf(a.submissionId)).toBe('pending-review')
  })

  it('retries retryable provider errors with backoff and fails after three attempts', async () => {
    const { submissionId } = await submitStory(api)
    const d = doubles({
      embed: vi.fn(async () => {
        throw new StageError('provider-rate-limited', { retryable: true })
      }),
    })
    const config = configWith(d)
    const t0 = Date.now()
    const batchId = (await batchOf(submissionId))._id
    await processEvidenceBatches(config, { now: new Date(t0) })
    let attempts = await attemptsOf(batchId)
    expect(attempts).toHaveLength(1)
    expect(attempts[0].status).toBe('failed')
    expect((await batchOf(submissionId)).status).toBe('pending')
    expect(await statusOf(submissionId)).toBe('validated')
    await processEvidenceBatches(config, { now: new Date(t0 + 30000) })
    expect(await attemptsOf(batchId)).toHaveLength(1)
    await processEvidenceBatches(config, { now: new Date(t0 + 61000) })
    attempts = await attemptsOf(batchId)
    expect(attempts).toHaveLength(2)
    expect(attempts[1].status).toBe('failed')
    expect(String(attempts[1].retryOf)).toBe(String(attempts[0]._id))
    await processEvidenceBatches(config, { now: new Date(t0 + 61000 + 121000) })
    attempts = await attemptsOf(batchId)
    expect(attempts).toHaveLength(3)
    expect(attempts[2].status).toBe('failed')
    const batch = await batchOf(submissionId)
    expect(batch.status).toBe('failed')
    expect(batch.failedStage).toBe('embedding')
    expect(await statusOf(submissionId)).toBe('pending-review')
  })

  it('recovers a stale lease and finishes with a new attempt', async () => {
    const { submissionId } = await submitStory(api)
    const batch = await batchOf(submissionId)
    const t0 = Date.now()
    const stale = await ProcessingAttempt.create({
      batchId: batch._id,
      revisionId: batch.revisionId,
      stage: 'embedding',
      attemptKey: batch._id + ':embedding:1',
      leaseId: 'stale-lease',
      claimVersion: 1,
      leaseExpiresAt: new Date(t0 - 1000),
      provider: 'openai',
      status: 'started',
    })
    await EvidenceBatch.updateOne({ _id: batch._id }, { $set: { activeLeaseId: 'stale-lease' } })
    await processEvidenceBatches(configWith(doubles()), { now: new Date(t0) })
    const old = await ProcessingAttempt.findById(stale._id)
    expect(old.status).toBe('stale')
    expect(old.staleAt).toBeInstanceOf(Date)
    const retry = await ProcessingAttempt.findOne({ attemptKey: batch._id + ':embedding:2' })
    expect(retry.status).toBe('succeeded')
    expect((await batchOf(submissionId)).status).toBe('available-for-human-review')
  })

  it('lets exactly one of two concurrent sweeps claim a stage', async () => {
    const { submissionId } = await submitStory(api)
    const base = doubles()
    const d = doubles({
      embed: vi.fn(async texts => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return base.embed(texts)
      }),
    })
    const config = configWith(d)
    const now = new Date()
    await Promise.all([
      processEvidenceBatches(config, { now }),
      processEvidenceBatches(config, { now }),
    ])
    expect(d.embed).toHaveBeenCalledTimes(1)
    expect(d.review).toHaveBeenCalledTimes(1)
    const batch = await batchOf(submissionId)
    const attempts = await attemptsOf(batch._id)
    expect(attempts.map(attempt => attempt.stage).sort()).toEqual([
      'comparison',
      'embedding',
      'llm',
    ])
    expect(batch.status).toBe('available-for-human-review')
  })

  it('reuses stored embeddings instead of re-embedding a revision', async () => {
    const { submissionId } = await submitStory(api)
    const batch = await batchOf(submissionId)
    const revision = await ContentRevision.findById(batch.revisionId).lean()
    const first = doubles()
    const prepared = await prepareRevisionEmbeddings({
      revision,
      batchId: batch._id,
      authorAccountId: revision.authorAccountId,
      eligibilityStatus: 'submitted',
      ai: configWith(first).ai,
      embed: first.embed,
    })
    await EmbeddingArtifact.insertMany(prepared.docs)
    const d = doubles()
    await processEvidenceBatches(configWith(d), { now: new Date() })
    expect(d.embed).not.toHaveBeenCalled()
    const embedding = await ProcessingAttempt.findOne({ batchId: batch._id, stage: 'embedding' })
    expect(embedding.status).toBe('succeeded')
    expect(embedding.responseMetadata.reused).toBeGreaterThan(0)
  })

  it('fails the LLM stage on refusal and keeps real partial evidence', async () => {
    const moderator = await authenticatedAccount('moderator')
    await chapterBy(moderator, { title: 'Chương nguồn' })
    const a = await chapterBy(moderator, { title: 'Chương bị từ chối' })
    const d = doubles({
      review: vi.fn(async () => {
        throw new StageError('llm-refusal')
      }),
    })
    await processEvidenceBatches(configWith(d), { now: new Date() })
    const batch = await batchOf(a.submissionId)
    expect(batch.status).toBe('failed')
    expect(batch.failedStage).toBe('llm')
    expect(await SimilarityFinding.countDocuments({ batchId: batch._id })).toBeGreaterThan(0)
    expect(await LlmReview.countDocuments({ batchId: batch._id })).toBe(0)
    expect(await statusOf(a.submissionId)).toBe('pending-review')
  })

  it('ignores submissions that are no longer validated', async () => {
    const moderator = await authenticatedAccount('moderator')
    const a = await chapterBy(moderator)
    await PublicationSubmission.updateOne(
      { _id: a.submissionId, status: 'validated' },
      { $set: { status: 'cancelled' }, $inc: { version: 1 } },
    )
    const d = doubles()
    await processEvidenceBatches(configWith(d), { now: new Date() })
    expect(d.embed).not.toHaveBeenCalled()
    expect((await batchOf(a.submissionId)).status).toBe('pending')
  })

  it('starts a worker that sweeps immediately and stops cleanly', async () => {
    const { submissionId } = await submitStory(api)
    const stop = startEvidenceWorker(
      configWith(doubles()),
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      { intervalMs: 60000 },
    )
    await vi.waitFor(async () => expect(await statusOf(submissionId)).toBe('pending-review'), {
      timeout: 10000,
    })
    await expect(stop()).resolves.toBeUndefined()
  })
})
