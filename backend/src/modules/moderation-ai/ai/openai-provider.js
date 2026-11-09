import OpenAI from 'openai'
import { StageError } from './stage-error.js'

const QUOTA_CODES = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'project_spend_limit_exceeded',
  'organization_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
])

/** Classifies an SDK error. Timeouts, connection errors, rate limits and 5xx are retryable. */
export function mapOpenAIError(error) {
  if (error instanceof StageError) return error
  if (error instanceof OpenAI.APIConnectionTimeoutError)
    return new StageError('provider-timeout', { retryable: true, cause: error })
  if (error instanceof OpenAI.APIConnectionError)
    return new StageError('provider-connection', { retryable: true, cause: error })
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return QUOTA_CODES.has(error.code ?? error.error?.code)
        ? new StageError('provider-quota', { cause: error })
        : new StageError('provider-rate-limited', { retryable: true, cause: error })
    }
    if (error.status >= 500)
      return new StageError('provider-unavailable', { retryable: true, cause: error })
    return new StageError('provider-rejected', { cause: error })
  }
  return new StageError('provider-error', { cause: error })
}

/**
 * OpenAI embeddings and Responses adapter. The key, base URL, organization and project are
 * explicit so nothing in the shell environment can redirect or re-attribute a request; SDK
 * retries are off because the evidence worker owns retries and their cost.
 */
export function createOpenAIProvider(ai, { fetch } = {}) {
  // The SDK applies OPENAI_CUSTOM_HEADERS after the auth and project headers, so they could
  // replace the configured credentials. Refuse to start; never echo the value.
  if (process.env.OPENAI_CUSTOM_HEADERS?.trim())
    throw new Error('OPENAI_CUSTOM_HEADERS must not be set for the NovelHub OpenAI client')
  const client = new OpenAI({
    apiKey: ai.openai.apiKey,
    // The SDK would otherwise read OPENAI_ADMIN_KEY and send it instead of the configured key.
    adminAPIKey: null,
    baseURL: 'https://api.openai.com/v1',
    organization: null,
    project: null,
    timeout: ai.timeoutMs,
    maxRetries: 0,
    ...(fetch ? { fetch } : {}),
  })
  return {
    async embed(texts) {
      try {
        const response = await client.embeddings.create({
          model: ai.embeddingModel,
          input: texts,
          encoding_format: 'float',
        })
        const vectors = [...response.data]
          .sort((a, b) => a.index - b.index)
          .map(item => item.embedding)
        // The response was billed; keep its usage so the attempt records the cost.
        if (vectors.length !== texts.length)
          throw new StageError('embedding-count-mismatch', {
            metadata: { model: response.model, usage: response.usage },
          })
        return {
          vectors,
          dimensions: vectors[0]?.length ?? 0,
          provider: 'openai',
          metadata: { model: response.model, usage: response.usage },
        }
      } catch (error) {
        throw mapOpenAIError(error)
      }
    },
    async review({ instructions, input, schemaName, schema, maxOutputTokens }) {
      try {
        const response = await client.responses.create({
          model: ai.reviewModel,
          input: [
            { role: 'developer', content: instructions },
            { role: 'user', content: input },
          ],
          text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
          reasoning: { effort: ai.reviewReasoningEffort },
          max_output_tokens: maxOutputTokens,
          store: false,
        })
        const metadata = {
          model: response.model,
          responseId: response.id,
          requestId: response._request_id,
          usage: response.usage,
        }
        if (response.status === 'incomplete') throw new StageError('llm-incomplete', { metadata })
        const parts = (response.output ?? [])
          .filter(item => item.type === 'message')
          .flatMap(item => item.content ?? [])
        if (parts.some(part => part.type === 'refusal'))
          throw new StageError('llm-refusal', { metadata })
        const text = parts
          .filter(part => part.type === 'output_text')
          .map(part => part.text)
          .join('')
        let output
        try {
          output = JSON.parse(text)
        } catch (error) {
          throw new StageError('llm-output-invalid', { metadata, cause: error })
        }
        return { output, provider: 'openai', metadata }
      } catch (error) {
        throw mapOpenAIError(error)
      }
    },
  }
}
