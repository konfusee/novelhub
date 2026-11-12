/**
 * Provider-neutral TTS adapter (decision-log #29). Narration code only sees:
 *   provider.name, provider.voiceId, provider.maxCharacters, provider.pollIntervalMs (optional)
 *   provider.submit({ text, callbackUrl }) -> { jobId }
 *   provider.poll(jobId) -> { state: 'processing' } | { state: 'completed', audioUrl }
 *                          | { state: 'failed', code }
 *   provider.download(audioUrl) -> Buffer (mp3)
 * Every failure is thrown as TtsProviderError so callers can record code + retryability.
 */
export class TtsProviderError extends Error {
  constructor(code, retryable, message = code) {
    super(message)
    this.name = 'TtsProviderError'
    this.code = code
    this.retryable = retryable
  }
}

export const MAX_AUDIO_BYTES = 200 * 1024 * 1024
const PROCESSING = new Set(['PROCESSING', 'PENDING', 'IN_PROGRESS', 'QUEUED', 'WAITING'])
const FAILED = new Set(['FAILED', 'FAILURE', 'ERROR'])

function vbeeProvider({ appId, token, apiUrl, timeoutMs }, voiceCode, fetchImpl) {
  const base = apiUrl.replace(/\/+$/, '')
  async function call(url, init = {}) {
    let response
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'App-Id': appId,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new TtsProviderError('provider_unreachable', true)
    }
    const body = await response.json().catch(() => null)
    if (!response.ok || body?.error) {
      const status = response.ok ? 400 : response.status
      if (status === 401 || status === 403)
        throw new TtsProviderError('provider_unauthorized', true)
      if (status === 429 || status >= 500) throw new TtsProviderError('provider_busy', true)
      throw new TtsProviderError('provider_rejected', false, body?.error?.message)
    }
    return body
  }

  return {
    name: 'vbee',
    voiceId: voiceCode,
    maxCharacters: 100000,
    async submit({ text, callbackUrl }) {
      const body = await call(`${base}/tts`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          voiceCode,
          mode: 'async',
          outputFormat: 'mp3',
          bitrate: 64,
          speed: 1.0,
          webhookUrl: callbackUrl,
        }),
      })
      const requestId = body?.request_id ?? body?.requestId
      if (typeof requestId !== 'string' || !requestId)
        throw new TtsProviderError('provider_invalid_response', true)
      return { jobId: requestId }
    },
    async poll(jobId) {
      const body = await call(`${base}/tts/requests/${encodeURIComponent(jobId)}`, {
        method: 'GET',
      })
      const status = String(body?.status ?? '').toUpperCase()
      if (status === 'COMPLETED' || status === 'SUCCESS') {
        const audioUrl = body.audio_link ?? body.audioLink
        if (typeof audioUrl !== 'string' || !/^https?:\/\//.test(audioUrl))
          throw new TtsProviderError('provider_invalid_response', true)
        return { state: 'completed', audioUrl }
      }
      if (FAILED.has(status)) return { state: 'failed', code: 'provider_failed' }
      if (PROCESSING.has(status)) return { state: 'processing' }
      throw new TtsProviderError('provider_invalid_response', true)
    },
    async download(audioUrl) {
      let response
      try {
        response = await fetchImpl(audioUrl, { signal: AbortSignal.timeout(timeoutMs * 6) })
      } catch {
        throw new TtsProviderError('provider_unreachable', true)
      }
      if (!response.ok) throw new TtsProviderError('audio_download_failed', true)
      const declared = Number(response.headers.get('content-length') ?? 0)
      if (declared > MAX_AUDIO_BYTES) throw new TtsProviderError('audio_too_large', false)
      if (!response.body?.getReader) {
        const bytes = Buffer.from(await response.arrayBuffer())
        if (!bytes.length) throw new TtsProviderError('audio_download_failed', true)
        if (bytes.length > MAX_AUDIO_BYTES) throw new TtsProviderError('audio_too_large', false)
        return bytes
      }
      const reader = response.body.getReader()
      const chunks = []
      let total = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          total += value.byteLength
          if (total > MAX_AUDIO_BYTES) {
            await reader.cancel()
            throw new TtsProviderError('audio_too_large', false)
          }
          chunks.push(Buffer.from(value))
        }
      } finally {
        reader.releaseLock?.()
      }
      if (!total) throw new TtsProviderError('audio_download_failed', true)
      return Buffer.concat(chunks, total)
    },
  }
}

/** Configured provider, or null when TTS is not set up (text reading is unaffected). */
export function createTtsProvider(config, fetchImpl = globalThis.fetch) {
  if (config.ttsProvider !== undefined) return config.ttsProvider
  const tts = config.tts
  return tts?.vbee ? vbeeProvider(tts.vbee, tts.voiceCode, fetchImpl) : null
}
