import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, unlink, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { AuditEvent, ContentRevision, MediaAsset, Story } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { lockAuthor, ownStory, editable } from './author-ownership.js'
import { HttpError } from '../../../middleware/errors.js'

export const MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024
const localRoot = fileURLToPath(new URL('../../../../uploads/media', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const keyPattern = /^[a-f\d-]{36}~(\d{1,5})x(\d{1,5})~([^/\\\p{Cc}]+\.webp)$/u
const busy = new Set()
export const mediaRoot = config => path.resolve(config.mediaStorageDir ?? localRoot)
function filePath(config, key) {
  if (!keyPattern.test(key ?? ''))
    throw new HttpError(404, 'media_unavailable', 'Tệp ảnh chưa sẵn sàng.')
  const resolved = path.resolve(mediaRoot(config), key)
  if (path.dirname(resolved) !== mediaRoot(config))
    throw new HttpError(404, 'media_unavailable', 'Tệp ảnh chưa sẵn sàng.')
  return resolved
}
function view(asset) {
  const parsed = keyPattern.exec(asset.objectKey ?? '')
  return {
    id: String(asset._id),
    version: asset.version,
    kind: asset.kind,
    name: parsed?.[3] ?? `Ảnh ${String(asset._id).slice(-6)}`,
    width: parsed ? Number(parsed[1]) : null,
    height: parsed ? Number(parsed[2]) : null,
    sizeBytes: asset.sizeBytes ?? null,
    contentType: asset.contentType ?? null,
    createdAt: asset.createdAt,
    storyId: asset.storyId ? String(asset.storyId) : null,
    url: asset.storageProvider === 'local' && parsed ? `/author/media/${asset._id}/content` : null,
    status: asset.status,
  }
}

export async function uploadAuthorMedia(config, account, input, bytes) {
  const owner = String(account._id)
  if (busy.has(owner) || busy.size >= 4)
    throw new HttpError(429, 'upload_busy', 'Một ảnh khác đang được xử lý. Vui lòng chờ.')
  busy.add(owner)
  let stored
  try {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MEDIA_UPLOAD_BYTES)
      throw new HttpError(400, 'invalid_image', 'Chọn ảnh PNG, JPEG hoặc WebP tối đa 10 MB.')
    let result
    try {
      const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 16000000 })
      const metadata = await image.metadata()
      if (
        !['png', 'jpeg', 'webp'].includes(metadata.format) ||
        (metadata.pages ?? 1) !== 1 ||
        metadata.width > 10000 ||
        metadata.height > 10000
      )
        throw new Error('Unsupported image')
      result = await image.autoOrient().webp({ quality: 90 }).toBuffer({ resolveWithObject: true })
    } catch {
      throw new HttpError(
        400,
        'invalid_image',
        'Ảnh không hợp lệ. Hỗ trợ PNG, JPEG, WebP tĩnh tối đa 16 triệu điểm ảnh.',
      )
    }
    if (result.data.length > MEDIA_UPLOAD_BYTES)
      throw new HttpError(400, 'image_too_large', 'Ảnh sau xử lý vượt quá 10 MB.')
    const name =
      Array.from(
        input.name
          .normalize('NFC')
          .replace(/[\\/<>:"|?*\p{Cc}]/gu, '_')
          .replace(/\.(png|jpe?g|webp)$/iu, ''),
      )
        .slice(0, 100)
        .join('')
        .replace(/[. ]+$/u, '') || 'image'
    const key = `${randomUUID()}~${result.info.width}x${result.info.height}~${name}.webp`
    await mkdir(mediaRoot(config), { recursive: true })
    const file = filePath(config, key)
    await writeFile(file, result.data, { flag: 'wx' })
    stored = file
    const asset = await withTransaction(async session => {
      await lockAuthor(account, session)
      if (input.storyId) editable(await ownStory(account, input.storyId, session))
      const [created] = await MediaAsset.create(
        [
          {
            ownerAccountId: account._id,
            storyId: input.storyId,
            kind: input.kind,
            storageProvider: 'local',
            objectKey: key,
            contentType: 'image/webp',
            sizeBytes: result.data.length,
            checksum: hash(result.data),
            availabilityDigest: hash(result.data),
            status: 'available',
            accessClass: 'private',
          },
        ],
        { session },
      )
      await AuditEvent.create(
        [
          {
            actorType: 'account',
            actorId: account._id,
            action: 'media.uploaded',
            targetType: 'MediaAsset',
            targetId: created._id,
            targetVersion: created.version,
            result: 'accepted',
            occurredAt: new Date(),
          },
        ],
        { session },
      )
      return created
    })
    stored = null
    return view(asset)
  } finally {
    busy.delete(owner)
    if (stored) await unlink(stored).catch(() => {})
  }
}

export async function readAuthorMedia(config, accountId, id) {
  const asset = await MediaAsset.findOne({
    _id: id,
    ownerAccountId: accountId,
    status: 'available',
    storageProvider: 'local',
    accessClass: 'private',
  })
    .select('+objectKey')
    .lean()
  if (!asset) throw new HttpError(404, 'not_found', 'Không tìm thấy ảnh.')
  try {
    const file = filePath(config, asset.objectKey)
    const info = await stat(file)
    if (info.size > MEDIA_UPLOAD_BYTES || info.size !== asset.sizeBytes)
      throw new Error('Size mismatch')
    const bytes = await readFile(file)
    if (hash(bytes) !== asset.checksum) throw new Error('Checksum mismatch')
    return bytes
  } catch {
    throw new HttpError(404, 'media_unavailable', 'Tệp ảnh chưa sẵn sàng.')
  }
}

/**
 * Marks story-scoped uploads that are no longer referenced by any revision or
 * the live story as deleted. Historical revisions remain authoritative, so a
 * replacement cover or an old chapter illustration is retained when it is
 * still part of an immutable package.
 */
export async function cleanupUnusedStoryMedia(config, account, storyId, session) {
  const assets = await MediaAsset.find({
    ownerAccountId: account._id,
    storyId,
    status: 'available',
  })
    .select('+objectKey revisionId chapterId rightsDeclarationId')
    .session(session ?? null)
    .lean()
  if (!assets.length) return []

  const revisions = await ContentRevision.find({ storyId })
    .select('mediaIds content.coverMediaId content.coverBannerMediaId')
    .session(session ?? null)
    .lean()
  const story = await Story.findById(storyId)
    .select('coverMediaId theme.coverBannerMediaId')
    .session(session ?? null)
    .lean()
  const referenced = new Set()
  for (const revision of revisions) {
    for (const id of revision.mediaIds ?? []) referenced.add(String(id))
    if (revision.content?.coverMediaId) referenced.add(String(revision.content.coverMediaId))
    if (revision.content?.coverBannerMediaId)
      referenced.add(String(revision.content.coverBannerMediaId))
  }
  if (story?.coverMediaId) referenced.add(String(story.coverMediaId))
  if (story?.theme?.coverBannerMediaId) referenced.add(String(story.theme.coverBannerMediaId))

  const candidates = assets.filter(
    asset =>
      !asset.revisionId &&
      !asset.chapterId &&
      !asset.rightsDeclarationId &&
      !referenced.has(String(asset._id)),
  )
  if (!candidates.length) return []
  const now = new Date()
  await MediaAsset.bulkWrite(
    candidates.map(asset => ({
      updateOne: {
        filter: { _id: asset._id, status: 'available', version: asset.version },
        update: { $set: { status: 'deleted', deletedAt: now }, $inc: { version: 1 } },
      },
    })),
    { session, ordered: true },
  )
  await AuditEvent.insertMany(
    candidates.map(asset => ({
      actorType: 'account',
      actorId: account._id,
      action: 'media.deleted',
      targetType: 'MediaAsset',
      targetId: asset._id,
      targetVersion: asset.version + 1,
      result: 'accepted',
      occurredAt: now,
      reason: 'Ảnh không còn được tham chiếu bởi nội dung của truyện.',
    })),
    { session, ordered: true },
  )
  return candidates.map(asset => asset.objectKey).filter(Boolean)
}

export async function removeMediaFiles(config, keys) {
  await Promise.all(
    [...new Set(keys ?? [])].map(key => unlink(filePath(config, key)).catch(() => {})),
  )
}
