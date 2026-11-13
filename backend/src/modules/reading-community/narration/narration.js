import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { Chapter, ContentRevision, NarrationAsset } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { mediaRoot } from '../../authoring-publishing/author/author-media.js'
import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { readableChapter } from '../reading/access.js'
import { MAX_AUDIO_BYTES, TtsProviderError } from './tts-provider.js'

// A worker owns a job for at most LEASE_MS; provider polls are spaced by the provider's
// pollIntervalMs (default POLL_INTERVAL_MS) and a job still not done after MAX_PROCESSING_MS
// is failed (retryable).
const LEASE_MS = 60_000
const POLL_INTERVAL_MS = 2_000
const MAX_PROCESSING_MS = 15 * 60_000
// Cost limits: provider submits per (revision, voice) before a retry is refused, and the
// day boundary (Vietnam time) of the optional platform-wide daily character budget.
export const MAX_ATTEMPTS = 3
const VN_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000
const TRANSIENT = new Set([
  'provider_unreachable',
  'provider_busy',
  'provider_invalid_response',
  'audio_download_failed',
])
// Submit errors where the provider did not create (or bill) a job.
const REFUSED = new Set(['provider_rejected', 'provider_quota', 'provider_unauthorized'])
const FAILURE_MESSAGES = {
  text_too_long: 'Chương quá dài để chuyển thành giọng nói.',
  empty_text: 'Chương không có nội dung để đọc.',
  provider_rejected: 'Dịch vụ giọng nói từ chối nội dung chương này.',
  provider_quota: 'Dịch vụ giọng nói đã hết hạn mức ký tự. Vui lòng thử lại sau.',
  audio_too_large: 'Tệp âm thanh tạo ra quá lớn.',
  audio_missing: 'Tệp âm thanh đã bị mất. Vui lòng tạo lại.',
}
const EXHAUSTED_MESSAGE = `Đã thử tạo âm thanh ${MAX_ATTEMPTS} lần không thành công. Vui lòng báo quản trị viên.`
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

const exhausted = asset => (asset.attempts ?? 0) >= MAX_ATTEMPTS
/** A failed narration may be submitted again: not a permanent failure, attempts left. */
const canRetry = asset => asset.retryable !== false && !exhausted(asset)

/** Reader-facing state; 'requested' and 'processing' are both "being generated". */
export function narrationView(asset, { storyId, chapterId }) {
  const status = !asset ? 'none' : asset.status === 'requested' ? 'processing' : asset.status
  const retryable = status === 'failed' && canRetry(asset)
  return {
    status,
    audioUrl: status === 'available' ? `/reader/narration/${storyId}/${chapterId}/audio` : null,
    failure:
      status === 'failed'
        ? {
            code: asset.failureCode ?? 'tts_failed',
            message:
              asset.retryable !== false && !retryable
                ? EXHAUSTED_MESSAGE
                : (FAILURE_MESSAGES[asset.failureCode] ?? DEFAULT_FAILURE),
            retryable,
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
  // Vbee answers "Invalid syntax" for text without a single letter or digit.
  if (!/[\p{L}\p{N}]/u.test(text)) return fail(claimed, 'empty_text', false)
  if (text.length > provider.maxCharacters) return fail(claimed, 'text_too_long', false)
  // A submit counts as an attempt and toward the daily budget, since it may be billed even
  // when the job then fails. A request the provider refused was never created, so it is not.
  const billed = {
    $push: { submissions: { at: new Date(), characters: text.length } },
    $inc: { attempts: 1, version: 1 },
  }
  try {
    const { jobId } = await provider.submit({ text, callbackUrl: config.tts?.callbackUrl })
    return NarrationAsset.findOneAndUpdate(
      { _id: claimed._id, status: 'processing' },
      {
        ...billed,
        $set: { providerRequestId: jobId, checkedAt: new Date(), leaseExpiresAt: null },
      },
      { returnDocument: 'after' },
    )
  } catch (error) {
    if (!(error instanceof TtsProviderError)) throw error
    config.logger?.warn(
      { chapterId: String(chapter._id), code: error.code, reason: error.message },
      'narration submit failed',
    )
    if (!REFUSED.has(error.code))
      await NarrationAsset.updateOne({ _id: claimed._id, status: 'processing' }, billed)
    return fail(claimed, error.code, error.retryable)
  }
}

/** Streams the provider audio to local storage, refusing more than MAX_AUDIO_BYTES. */
async function store(config, asset, chunks) {
  const key = `narration/${asset._id}.mp3`
  const target = narrationAudioPath(config, key)
  await mkdir(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const file = await open(temp, 'w')
  let size = 0
  try {
    try {
      for await (const chunk of chunks) {
        size += chunk.length
        if (size > MAX_AUDIO_BYTES) throw new TtsProviderError('audio_too_large', false)
        await file.write(chunk)
      }
    } catch (error) {
      if (error instanceof TtsProviderError) throw error
      throw new TtsProviderError('audio_download_failed', true)
    }
    if (!size) throw new TtsProviderError('audio_download_failed', true)
    await file.close()
    await rename(temp, target)
  } catch (error) {
    await file.close().catch(() => {})
    await rm(temp, { force: true })
    throw error
  }
  return { key, size }
}

/**
 * Deletes the stored audio of the chapter's other narrations (older revisions or another
 * voice): they can no longer be served, since playback always uses the live revision.
 */
async function pruneSuperseded(config, asset) {
  const stale = await NarrationAsset.find({
    chapterId: asset.chapterId,
    _id: { $ne: asset._id },
    status: 'available',
  })
    .select('+audioReference')
    .lean()
  for (const old of stale) {
    const updated = await NarrationAsset.findOneAndUpdate(
      { _id: old._id, status: 'available' },
      {
        $set: { status: 'failed', failureCode: 'superseded', retryable: false },
        $unset: { audioReference: 1 },
        $inc: { version: 1 },
      },
    )
    if (updated && old.audioReference)
      await rm(narrationAudioPath(config, old.audioReference), { force: true }).catch(() => {})
  }
}

/** An 'available' narration whose file is gone becomes a retryable failure (fresh attempts). */
async function markMissing(asset) {
  return NarrationAsset.findOneAndUpdate(
    { _id: asset._id, status: 'available' },
    {
      $set: { status: 'failed', failureCode: 'audio_missing', retryable: true, attempts: 0 },
      $unset: { audioReference: 1 },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' },
  ).then(updated => updated ?? NarrationAsset.findById(asset._id))
}

const fileMissing = (config, reference) =>
  stat(narrationAudioPath(config, reference)).then(
    () => false,
    error => {
      if (error?.code === 'ENOENT' || error instanceof HttpError) return true
      throw error
    },
  )

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
    const { key, size } = await store(config, claimed, await provider.download(result.audioUrl))
    const stored = await NarrationAsset.findOneAndUpdate(
      { _id: claimed._id, status: 'processing' },
      {
        $set: {
          status: 'available',
          audioReference: key,
          sizeBytes: size,
          completedAt: new Date(),
          leaseExpiresAt: null,
          failureCode: null,
          retryable: null,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    )
    if (stored) await pruneSuperseded(config, stored)
    return stored
  } catch (error) {
    if (!(error instanceof TtsProviderError)) {
      await release()
      throw error
    }
    return TRANSIENT.has(error.code) ? release() : fail(claimed, error.code, error.retryable)
  }
}

/**
 * Narration state of the chapter's live revision; also advances a pending job and turns an
 * available narration whose file disappeared into a retryable failure.
 */
export async function narrationStatus({ config, provider, account, storyId, chapterId }) {
  const { chapter } = await readableChapter({ storyId, chapterId, account })
  requireProvider(provider)
  let asset = await advance(config, provider, chapter, await current(chapter, provider))
  if (asset?.status === 'available') {
    const stored = await NarrationAsset.findById(asset._id).select('+audioReference').lean()
    if (stored && (await fileMissing(config, stored.audioReference)))
      asset = await markMissing(asset)
  }
  return narrationView(asset, { storyId, chapterId })
}

const vietnamDayStart = now =>
  new Date(Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS)

/**
 * Cost guards before a new provider job is started for this account: at most
 * `maxActiveJobsPerAccount` narrations being generated at once for one account, and the
 * optional platform-wide daily character budget.
 */
async function guardNewJob(config, account, chapter) {
  const now = new Date()
  const maxActive = config.tts?.maxActiveJobsPerAccount ?? 0
  if (maxActive) {
    const active = await NarrationAsset.countDocuments({
      requestedBy: account._id,
      status: { $in: ['requested', 'processing'] },
      requestedAt: { $gt: new Date(now.getTime() - MAX_PROCESSING_MS) },
    })
    if (active >= maxActive)
      throw new HttpError(
        429,
        'narration_busy',
        'Bạn đang tạo âm thanh cho chương khác. Vui lòng chờ chương đó xong rồi thử lại.',
      )
  }
  const limit = config.tts?.dailyCharacterLimit ?? 0
  if (limit) {
    const since = vietnamDayStart(now)
    const [usage] = await NarrationAsset.aggregate([
      { $match: { 'submissions.at': { $gte: since } } },
      { $unwind: '$submissions' },
      { $match: { 'submissions.at': { $gte: since } } },
      { $group: { _id: null, characters: { $sum: '$submissions.characters' } } },
    ])
    if ((usage?.characters ?? 0) + (await chapterText(chapter)).length > limit)
      throw new HttpError(
        429,
        'tts_daily_limit',
        'Hệ thống đã dùng hết hạn mức tạo âm thanh hôm nay. Vui lòng thử lại vào ngày mai.',
      )
  }
}

/**
 * First play creates the narration for (published revision, voice); a failed one is
 * retried while it is retryable and has attempts left. Concurrent first plays share one
 * asset through the unique index. Starting a provider job passes `guardNewJob` first.
 */
export async function requestNarration({ config, provider, account, storyId, chapterId }) {
  const { chapter } = await readableChapter({ storyId, chapterId, account })
  requireProvider(provider)
  const key = { revisionId: chapter.publishedRevisionId, voiceId: provider.voiceId }
  let asset = await current(chapter, provider)
  if (!asset) {
    await guardNewJob(config, account, chapter)
    try {
      await NarrationAsset.create({
        ...key,
        chapterId: chapter._id,
        language: 'vi',
        provider: provider.name,
        status: 'requested',
        requestedBy: account._id,
        requestedAt: new Date(),
      })
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
    asset = await current(chapter, provider)
  } else if (asset.status === 'failed' && canRetry(asset)) {
    await guardNewJob(config, account, chapter)
    asset =
      (await NarrationAsset.findOneAndUpdate(
        { _id: asset._id, status: 'failed' },
        {
          $set: {
            status: 'requested',
            provider: provider.name,
            requestedBy: account._id,
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
  if (await fileMissing(config, asset.audioReference)) {
    await markMissing(asset)
    throw new HttpError(404, 'narration_unavailable', 'Âm thanh chưa sẵn sàng.')
  }
  return narrationAudioPath(config, asset.audioReference)
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
