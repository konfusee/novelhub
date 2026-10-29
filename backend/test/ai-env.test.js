import { testConfig, testEnv } from './config.js'
import { describe, expect, it } from 'vitest'
import { loadEnv, toAppConfig } from '../src/config/env.js'
const base = { ...testEnv, MONGODB_URI: 'mongodb://localhost/novelhub', NODE_ENV: 'test' }
const defaults = {
  openai: undefined,
  openaiKeySource: 'unset',
  embeddingModel: 'text-embedding-3-small',
  reviewModel: 'gpt-6-luna',
  reviewReasoningEffort: 'low',
  timeoutMs: 60000,
  intervalSeconds: 30,
  similarityTopK: 5,
  vectorSearchIndex: 'embedding_vectors',
  workerEnabled: false,
  budgetUsd: 3,
  budgetWindowStart: null,
}
describe('AI environment', () => {
  it('defaults every AI setting from .env.example without enabling OpenAI or the worker', () => {
    expect(testConfig().ai).toEqual(defaults)
  })
  it('treats blank AI values as their defaults', () => {
    const env = loadEnv({
      ...base,
      OPENAI_EMBEDDING_MODEL: '',
      SIMILARITY_TOP_K: '',
      AI_EVIDENCE_INTERVAL_SECONDS: '',
      VECTOR_SEARCH_INDEX: '',
      AI_EVIDENCE_WORKER_ENABLED: '',
      AI_BUDGET_USD: '',
      AI_BUDGET_WINDOW_START: '',
    })
    expect(toAppConfig(env).ai).toEqual(defaults)
  })
  it('enables the OpenAI client config only with an explicit key', () => {
    const { ai } = toAppConfig(loadEnv({ ...base, OPENAI_API_KEY: 'sk-test' }))
    expect(ai.openai).toEqual({ apiKey: 'sk-test' })
    expect(ai.openaiKeySource).toBe('shell')
  })
  it('rejects invalid AI settings', () => {
    expect(() => loadEnv({ ...base, SIMILARITY_TOP_K: '0' })).toThrow(/SIMILARITY_TOP_K/)
    expect(() => loadEnv({ ...base, OPENAI_REVIEW_REASONING_EFFORT: 'extreme' })).toThrow(
      /OPENAI_REVIEW_REASONING_EFFORT/,
    )
    expect(() => loadEnv({ ...base, VECTOR_SEARCH_INDEX: 'bad name' })).toThrow(
      /VECTOR_SEARCH_INDEX/,
    )
    expect(() => loadEnv({ ...base, AI_EVIDENCE_WORKER_ENABLED: 'yes' })).toThrow(
      /AI_EVIDENCE_WORKER_ENABLED/,
    )
    expect(() => loadEnv({ ...base, AI_BUDGET_WINDOW_START: 'soon' })).toThrow(
      /AI_BUDGET_WINDOW_START/,
    )
  })
  it('reads the worker flag and the budget window', () => {
    const { ai } = toAppConfig(
      loadEnv({
        ...base,
        AI_EVIDENCE_WORKER_ENABLED: 'true',
        AI_BUDGET_USD: '1.5',
        AI_BUDGET_WINDOW_START: '2026-10-29',
      }),
    )
    expect(ai.workerEnabled).toBe(true)
    expect(ai.budgetUsd).toBe(1.5)
    expect(ai.budgetWindowStart.toISOString()).toBe('2026-10-29T00:00:00.000Z')
  })
})
