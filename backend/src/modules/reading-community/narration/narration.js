import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Chapter, ContentRevision, NarrationAsset } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { mediaRoot } from '../../authoring-publishing/author/author-media.js'
import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { readableChapter } from '../reading/access.js'
import { TtsProviderError } from './tts-provider.js'

// A worker owns a job for at most LEASE_MS; provider polls are spaced by the provider's
// pollIntervalMs (default POLL_INTERVAL_MS) and a job still not done after MAX_PROCESSING_MS
// is failed (retryable).
const LEASE_MS = 60_000
const POLL_INTERVAL_MS = 2_000
const MAX_PROCESSING_MS = 15 * 60_000
const MAX_ATTEMPTS = 3
const REQUEST_COOLDOWN_MS = 15_000
const requestCooldowns = new Map()
const TRANSIENT = new Set([
  'provider_unreachable',
  'provider_busy',
  'provider_invalid_response',
  'audio_download_failed',
])
const FAILURE_MESSAGES = {
  text_too_long: 'Chương quá dài để chuyển thành giọng nói.',
  empty_text: 'Chương không có nội dung để đọc.',
  provider_rejected: 'Dịch vụ giọng nói từ chối nội dung chương này.',
  audio_too_large: 'Tệp âm thanh tạo ra quá lớn.',
}
const DEFAULT_FAILURE = 'Tạo âm thanh thất bại. Vui lòng thử lại.'
const ID_KEY = /^narration[/\\][a-f\d]{24}\.mp3$/

export const narrationAudioPath = (config, key) => {
  if (!ID_KEY.test(key ?? ''))
    throw new HttpError(404, 'narration_unavailable', 'Âm thanh chưa sẵn sàng.')
  return path.join(mediaRoot(config), key)
}

function requireProvider(provider) {
  if (!provider) throw new HttpError(503, 'tts_unavailable', 'Chức năng nghe chưa sẵn sàng.')
  return provider
}

/** Reader-facing state; 'requested' and 'processing' are both "being generated". */
export function narrationView(asset, { storyId, chapterId }) {
  const status = !asset ? 'none' : asset.status === 'requested' ? 'processing' : asset.status
  return {
    status,
    audioUrl: status === 'available' ? `/reader/narration/${storyId}/${chapterId}/audio` : null,
    failure:
      status === 'failed'
        ? {
            code: asset.failureCode ?? 'tts_failed',
            message: FAILURE_MESSAGES[asset.failureCode] ?? DEFAULT_FAILURE,
            retryable: asset.retryable !== false,
          }
        : null,
    updatedAt: asset?.updatedAt ?? null,
  }
}

const current = (chapter, provider) =>
  NarrationAsset.findOne({ revisionId: chapter.publishedRevisionId, voiceId: provider.voiceId })

async function fail(asset, code, retryable) {
  return NarrationAsset.findOneAndUpdate(
    { _id: asset._id, status: { $in: ['requested', 'processing'] } },
    {
      $set: { status: 'failed', failureCode: code, retryable, leaseExpiresAt: null },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' },
  ).then(updated => updated ?? NarrationAsset.findById(asset._id))
}

async function chapterText(chapter) {
  const revision = await ContentRevision.findOne({
    _id: chapter.publishedRevisionId,
    chapterId: chapter._id,
    contentType: 'chapter',
  })
    .select('content formatVersion')
    .lean()
  const title = revision?.content?.title?.trim()
  const paragraphs = chapterTextProjection(revision)
    .map(text => text.trim())
    .filter(Boolean)
  return [title, ...paragraphs].filter(Boolean).join('\n')
}

/** Claims a 'requested' asset and submits it to the provider (one submit per claim). */
async function submit(config, provider, chapter, asset) {
  const now = new Date()
  const claimed = await NarrationAsset.findOneAndUpdate(
    { _id: asset._id, status: 'requested' },
    {
      $set: { status: 'processing', leaseExpiresAt: new Date(now.getTime() + LEASE_MS) },
      $unset: { providerRequestId: 1 },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!claimed) return NarrationAsset.findById(asset._id)
  const text = await chapterText(chapter)
  if (!text) return fail(claimed, 'empty_text', false)
  if (text.length > provider.maxCharacters) return fail(claimed, 'text_too_long', false)
  try {
    const { jobId } = await provider.submit({ text, callbackUrl: config.tts?.callbackUrl })
    return NarrationAsset.findOneAndUpdate(
      { _id: claimed._id, status: 'processing' },
      {
        $set: { providerRequestId: jobId, checkedAt: new Date(), leaseExpiresAt: null },
        $inc: { attempts: 1, version: 1 },
      },
      { returnDocument: 'after' },
    )
  } catch (error) {
    if (!(error instanceof TtsProviderError)) throw error
    return fail(claimed, error.code, error.retryable)
  }
}

async function store(config, asset, bytes) {
  const key = `narration/${asset._id}.mp3`
  const target = narrationAudioPath(config, key)
  await mkdir(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, bytes)
  await rename(temp, target)
  return key
}

/**
 * Moves a pending job forward: submits a 'requested' job, or polls a 'processing' job and
 * stores the finished audio locally (provider links expire within minutes).
 */
async function advance(config, provider, chapter, asset, { force = false } = {}) {
  if (!asset || !['requested', 'processing'].includes(asset.status)) return asset
  if (asset.status === 'requested') return submit(config, provider, chapter, asset)
  const now = new Date()
  const leaseFree = !asset.leaseExpiresAt || asset.leaseExpiresAt < now
  if (!asset.providerRequestId) return leaseFree ? fail(asset, 'submit_interrupted', true) : asset
  if (now - (asset.requestedAt ?? asset.updatedAt) > MAX_PROCESSING_MS)
    return fail(asset, 'provider_timeout', true)
  const interval = provider.pollIntervalMs ?? POLL_INTERVAL_MS
  if (!force && asset.checkedAt && now - asset.checkedAt < interval) return asset
  const claimed = await NarrationAsset.findOneAndUpdate(
    {
      _id: asset._id,
      status: 'processing',
      providerRequestId: asset.providerRequestId,
      $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lt: now } }],
    },
    {
      $set: { leaseExpiresAt: new Date(now.getTime() + LEASE_MS), checkedAt: now },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!claimed) return NarrationAsset.findById(asset._id)
  const release = () =>
    NarrationAsset.findOneAndUpdate(
      { _id: claimed._id, status: 'processing' },
      { $set: { leaseExpiresAt: null }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    )
  try {
    const result = await provider.poll(claimed.providerRequestId)
    if (result.state === 'processing') return release()
    if (result.state === 'failed') return fail(claimed, result.code ?? 'provider_failed', true)
    const bytes = await provider.download(result.audioUrl)
    const key = await store(config, claimed, bytes)
    return NarrationAsset.findOneAndUpdate(
      { _id: claimed._id, status: 'processing' },
      {
        $set: {
          status: 'available',
          audioReference: key,
          sizeBytes: bytes.length,
          completedAt: new Date(),
          leaseExpiresAt: null,
          failureCode: null,
          retryable: null,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    )
  } catch (error) {
    if (!(error instanceof TtsProviderError)) {
      await release()
      throw error
    }
    return TRANSIENT.has(error.code) ? release() : fail(claimed, error.code, error.retryable)
  }
}

/** Narration state of the chapter's live revision; also advances a pending job. */
export async function narrationStatus({ config, provider, account, storyId, chapterId }) {
  const { chapter } = await readableChapter({ storyId, chapterId, account })
  requireProvider(provider)
  const asset = await advance(config, provider, chapter, await current(chapter, provider))
  return narrationView(asset, { storyId, chapterId })
}

/**
 * First play creates the narration for (published revision, voice); a failed one is
 * retried. Concurrent first plays share one asset through the unique index.
 */
export async function requestNarration({ config, provider, account, storyId, chapterId }) {
  const { chapter } = await readableChapter({ storyId, chapterId, account })
  requireProvider(provider)
  const cooldownKey = `${account._id}:${storyId}:${chapterId}`
  const lastRequestedAt = requestCooldowns.get(cooldownKey) ?? 0
  if (Date.now() - lastRequestedAt < REQUEST_COOLDOWN_MS) {
    const existing = await current(chapter, provider)
    if (existing) return narrationView(existing, { storyId, chapterId })
  }
  requestCooldowns.set(cooldownKey, Date.now())
  if (requestCooldowns.size > 10_000) {
    const cutoff = Date.now() - REQUEST_COOLDOWN_MS
    for (const [key, value] of requestCooldowns) if (value < cutoff) requestCooldowns.delete(key)
  }
  const key = { revisionId: chapter.publishedRevisionId, voiceId: provider.voiceId }
  let asset = await current(chapter, provider)
  if (!asset) {
    try {
      await NarrationAsset.create({
        ...key,
        chapterId: chapter._id,
        language: 'vi',
        provider: provider.name,
        status: 'requested',
        requestedAt: new Date(),
      })
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
    asset = await current(chapter, provider)
  } else if (asset.status === 'failed') {
    if (asset.retryable === false || (asset.attempts ?? 0) >= MAX_ATTEMPTS)
      throw new HttpError(409, 'narration_retry_exhausted', 'Không thể thử tạo lại âm thanh này.')
    asset =
      (await NarrationAsset.findOneAndUpdate(
        { _id: asset._id, status: 'failed' },
        {
          $set: {
            status: 'requested',
            provider: provider.name,
            requestedAt: new Date(),
            failureCode: null,
            retryable: null,
            leaseExpiresAt: null,
          },
          $unset: { providerRequestId: 1 },
          $inc: { version: 1 },
        },
        { returnDocument: 'after' },
      )) ?? (await current(chapter, provider))
  }
  asset = await advance(config, provider, chapter, asset)
  return narrationView(asset, { storyId, chapterId })
}

/** Absolute path of an available narration file, after re-checking text access. */
export async function narrationFile({ config, provider, account, storyId, chapterId }) {
  const { chapter } = await readableChapter({ storyId, chapterId, account })
  requireProvider(provider)
  const asset = await NarrationAsset.findOne({
    revisionId: chapter.publishedRevisionId,
    voiceId: provider.voiceId,
    status: 'available',
  })
    .select('+audioReference')
    .lean()
  if (!asset) throw new HttpError(404, 'narration_unavailable', 'Âm thanh chưa sẵn sàng.')
  const file = narrationAudioPath(config, asset.audioReference)
  try {
    const info = await stat(file)
    if (!info.isFile() || info.size <= 0) throw new Error('invalid audio file')
  } catch {
    await NarrationAsset.updateOne(
      { _id: asset._id, status: 'available' },
      {
        $set: { status: 'failed', failureCode: 'audio_missing', retryable: true },
        $inc: { version: 1 },
      },
    )
    throw new HttpError(404, 'narration_unavailable', 'Âm thanh chưa sẵn sàng.')
  }
  return file
}

/**
 * Provider callback: the payload is untrusted, so it only triggers a poll of the referenced
 * job with our own credentials.
 */
export async function narrationCallback({ config, provider, requestId }) {
  if (!provider) return
  const asset = await NarrationAsset.findOne({
    providerRequestId: requestId,
    provider: provider.name,
    status: 'processing',
  })
  if (!asset) return
  const chapter = await Chapter.findById(asset.chapterId).lean()
  if (chapter) await advance(config, provider, chapter, asset, { force: true })
}
