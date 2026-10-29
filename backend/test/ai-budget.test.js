import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, EmbeddingArtifact, ProcessingAttempt } from '../src/models/index.js'
import {
  MAX_REVIEW_FINDINGS,
  SNIPPET_CHARS,
  spentUsd,
  worstCaseBacklogUsd,
  worstCaseEmbeddingUsd,
  worstCaseReviewUsd,
} from '../src/modules/ai/budget.js'
import { costUsd, estimateTokens } from '../src/modules/ai/pricing.js'
import {
  MAX_REVIEW_OUTPUT_TOKENS,
  MAX_REVIEW_TEXT_CHARS,
  REVIEW_INSTRUCTIONS,
} from '../src/modules/ai/review-criteria.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { apiClient, approvedStory, origin, submitChapter } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const config = testConfig({ cookieName: 'novelhub_session', corsOrigin: origin })
const api = apiClient(createApp(config))
const withAi = ai => ({ ...config, ai: { ...config.ai, ...ai } })
const id = () => new mongoose.Types.ObjectId()

describe('AI budget', () => {
  it('prices known models and refuses unknown ones', () => {
    expect(costUsd('text-embedding-3-small', { prompt_tokens: 1000000 })).toBe(0.02)
    expect(costUsd('gpt-6-luna', { input_tokens: 1000000, output_tokens: 1000000 })).toBeCloseTo(
      0.6,
      10,
    )
    expect(costUsd('unknown-model', {})).toBeNull()
  })

  it('sums worker attempts and backfill artifacts since the budget window', async () => {
    const batchId = id()
    const revisionId = id()
    await ProcessingAttempt.create([
      {
        batchId,
        revisionId,
        stage: 'embedding',
        attemptKey: batchId + ':embedding:1',
        status: 'succeeded',
        responseMetadata: { costUsd: 0.01 },
      },
      {
        batchId,
        revisionId,
        stage: 'llm',
        attemptKey: batchId + ':llm:1',
        status: 'failed',
        responseMetadata: { costUsd: 0.02 },
      },
    ])
    await EmbeddingArtifact.create({
      revisionId: id(),
      source: 'backfill',
      model: 'text-embedding-3-small',
      dimensions: 2,
      passageId: 'p0000',
      chunkingVersion: 'v1',
      vector: [1, 0],
      costUsd: 0.005,
    })
    expect(await spentUsd(config)).toBeCloseTo(0.035, 10)
    expect(await spentUsd(withAi({ budgetWindowStart: new Date(Date.now() + 3600000) }))).toBe(0)
  })

  it('computes worst-case stage costs from the real limits', () => {
    const inputChars =
      MAX_REVIEW_TEXT_CHARS +
      MAX_REVIEW_FINDINGS * 2 * SNIPPET_CHARS +
      REVIEW_INSTRUCTIONS.length +
      4000
    expect(worstCaseReviewUsd(config, 1000000)).toBe(
      (estimateTokens(inputChars) * 0.1 + MAX_REVIEW_OUTPUT_TOKENS * 0.5) / 1e6,
    )
    expect(worstCaseEmbeddingUsd(config, 2000)).toBe((1000 * 0.02) / 1e6)
    const unknown = withAi({ embeddingModel: 'unknown-model', reviewModel: 'unknown-model' })
    expect(worstCaseReviewUsd(unknown, 1000)).toBeNull()
    expect(worstCaseEmbeddingUsd(unknown, 1000)).toBeNull()
  })

  it('estimates the worst-case backlog of validated submissions', async () => {
    const moderator = await authenticatedAccount('moderator')
    for (let i = 0; i < 3; i += 1) {
      const author = await authenticatedAccount('author')
      const { storyId } = await approvedStory(api, moderator, { author })
      await submitChapter(api, { author, storyId, paragraphs: ['Đoạn văn số ' + i + '.'] })
      if (i === 2) await Account.updateOne({ _id: author.account._id }, { status: 'suspended' })
    }
    const backlog = await worstCaseBacklogUsd(config)
    expect(backlog.submissions).toBe(2)
    expect(backlog.usd).toBeGreaterThan(0)
  })
})
