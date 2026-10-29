import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpenAIProvider } from '../src/modules/ai/openai-provider.js'
import { resolveAiProviders } from '../src/modules/ai/providers.js'
import { testConfig } from './config.js'

// Never uses vi.mock('openai'): the real SDK parses every recorded HTTP shape.
const calls = []
const fakeFetch = respond => async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const body = JSON.parse(await request.text())
  calls.push({ url: request.url, body, headers: request.headers })
  const { status = 200, json } = respond(request.url, body)
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
const ai = { ...testConfig().ai, openai: { apiKey: 'sk-test' } }
const embeddingsResponse = {
  object: 'list',
  model: 'text-embedding-3-small',
  data: [
    { object: 'embedding', index: 1, embedding: [0, 1] },
    { object: 'embedding', index: 0, embedding: [1, 0] },
  ],
  usage: { prompt_tokens: 4, total_tokens: 4 },
}
const responseWith = fields => ({
  id: 'resp_1',
  object: 'response',
  status: 'completed',
  model: 'gpt-6-luna',
  output: [],
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    output_tokens_details: { reasoning_tokens: 2 },
  },
  ...fields,
})
const message = content => [
  { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content },
]
const reviewArgs = {
  instructions: 'i',
  input: '{}',
  schemaName: 's',
  schema: {},
  maxOutputTokens: 6000,
}

beforeEach(() => {
  calls.length = 0
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('OpenAI adapter', () => {
  it('sends one embeddings request and returns vectors in input order', async () => {
    const provider = createOpenAIProvider(ai, {
      fetch: fakeFetch(() => ({ json: embeddingsResponse })),
    })
    const result = await provider.embed(['a', 'b'])
    expect(result.vectors).toEqual([
      [1, 0],
      [0, 1],
    ])
    expect(result.dimensions).toBe(2)
    expect(calls).toHaveLength(1)
    expect(calls[0].url.endsWith('/embeddings')).toBe(true)
    expect(calls[0].body).toEqual({
      model: 'text-embedding-3-small',
      input: ['a', 'b'],
      encoding_format: 'float',
    })
  })

  it('requests strict JSON without storing the response and parses the output', async () => {
    const provider = createOpenAIProvider(ai, {
      fetch: fakeFetch(() => ({
        json: responseWith({
          output: message([
            {
              type: 'output_text',
              text: JSON.stringify({ summary: 'Tóm tắt' }),
              annotations: [],
            },
          ]),
        }),
      })),
    })
    const result = await provider.review(reviewArgs)
    expect(calls[0].url.endsWith('/responses')).toBe(true)
    expect(calls[0].body).toMatchObject({
      store: false,
      max_output_tokens: 6000,
      reasoning: { effort: 'low' },
      model: 'gpt-6-luna',
      text: { format: { type: 'json_schema', strict: true } },
    })
    expect(result.output.summary).toBe('Tóm tắt')
    expect(result.metadata.usage.input_tokens).toBe(10)
  })

  it('turns a refusal into a non-retryable llm-refusal failure', async () => {
    const provider = createOpenAIProvider(ai, {
      fetch: fakeFetch(() => ({
        json: responseWith({
          output: message([{ type: 'refusal', refusal: 'Không thể hỗ trợ.' }]),
        }),
      })),
    })
    await expect(provider.review(reviewArgs)).rejects.toMatchObject({
      code: 'llm-refusal',
      retryable: false,
    })
  })

  it('turns incomplete output into a non-retryable llm-incomplete failure', async () => {
    const provider = createOpenAIProvider(ai, {
      fetch: fakeFetch(() => ({
        json: responseWith({
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output: [],
        }),
      })),
    })
    await expect(provider.review(reviewArgs)).rejects.toMatchObject({
      code: 'llm-incomplete',
      retryable: false,
    })
  })

  it('maps rate limits to retryable and quota or auth errors to terminal failures with no SDK retry', async () => {
    const cases = [
      {
        status: 429,
        error: { message: 'slow', type: 'requests', code: 'rate_limit_exceeded' },
        code: 'provider-rate-limited',
        retryable: true,
      },
      {
        status: 429,
        error: { message: 'quota', type: 'insufficient_quota', code: 'insufficient_quota' },
        code: 'provider-quota',
        retryable: false,
      },
      {
        status: 500,
        error: { message: 'down', type: 'server_error', code: null },
        code: 'provider-unavailable',
        retryable: true,
      },
      {
        status: 401,
        error: { message: 'bad key', type: 'invalid_request_error', code: 'invalid_api_key' },
        code: 'provider-rejected',
        retryable: false,
      },
    ]
    for (const { status, error, code, retryable } of cases) {
      calls.length = 0
      const provider = createOpenAIProvider(ai, {
        fetch: fakeFetch(() => ({ status, json: { error } })),
      })
      await expect(provider.embed(['a'])).rejects.toMatchObject({ code, retryable })
      expect(calls).toHaveLength(1)
    }
  })

  it('never falls back to the OPENAI_API_KEY environment variable', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-from-shell')
    const providers = resolveAiProviders(testConfig().ai)
    await expect(providers.embed(['x'])).rejects.toMatchObject({ code: 'provider-unconfigured' })
    await expect(providers.review({})).rejects.toMatchObject({ code: 'provider-unconfigured' })
  })

  it('ignores base URL, organization and project from the shell', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'http://attacker.invalid/v1')
    vi.stubEnv('OPENAI_ORG_ID', 'org-shell')
    vi.stubEnv('OPENAI_PROJECT_ID', 'proj-shell')
    const provider = createOpenAIProvider(ai, {
      fetch: fakeFetch(() => ({
        json: {
          ...embeddingsResponse,
          data: [{ object: 'embedding', index: 0, embedding: [1, 0] }],
        },
      })),
    })
    await provider.embed(['a'])
    expect(calls[0].url.startsWith('https://api.openai.com/v1/')).toBe(true)
    expect(calls[0].headers.get('openai-organization')).toBeNull()
    expect(calls[0].headers.get('openai-project')).toBeNull()
  })

  it('refuses OPENAI_CUSTOM_HEADERS from the shell before any request', async () => {
    const respond = fakeFetch(() => ({ json: embeddingsResponse }))
    vi.stubEnv('OPENAI_CUSTOM_HEADERS', 'Authorization: Bearer sk-from-shell')
    let thrown
    try {
      createOpenAIProvider(ai, { fetch: respond })
    } catch (error) {
      thrown = error
    }
    expect(thrown?.message).toMatch(/OPENAI_CUSTOM_HEADERS must not be set/)
    expect(thrown.message).not.toContain('sk-from-shell')
    expect(() => resolveAiProviders(ai)).toThrow(/OPENAI_CUSTOM_HEADERS/)
    expect(calls).toHaveLength(0)
    vi.stubEnv('OPENAI_CUSTOM_HEADERS', '  ')
    const provider = createOpenAIProvider(ai, { fetch: respond })
    await provider.embed(['a', 'b'])
    expect(calls).toHaveLength(1)
    expect(calls[0].headers.get('authorization')).toBe('Bearer sk-test')
  })

  it('keeps the billed usage when an embeddings response has the wrong vector count', async () => {
    const provider = createOpenAIProvider(ai, {
      fetch: fakeFetch(() => ({
        json: {
          ...embeddingsResponse,
          data: [{ object: 'embedding', index: 0, embedding: [1, 0] }],
          usage: { prompt_tokens: 7, total_tokens: 7 },
        },
      })),
    })
    await expect(provider.embed(['a', 'b'])).rejects.toMatchObject({
      code: 'embedding-count-mismatch',
      retryable: false,
      metadata: { model: 'text-embedding-3-small', usage: { prompt_tokens: 7, total_tokens: 7 } },
    })
    expect(calls).toHaveLength(1)
  })
})
