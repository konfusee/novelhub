import { createHash } from 'node:crypto'
import { MediaAsset, AuditEvent } from '../../../models/index.js'
import { readAuthorMedia } from './author-media.js'
import { chapterMediaIds } from '../content/rich-chapter-document.js'
import { HttpError } from '../../../middleware/errors.js'

// Runs within the chapter save transaction, after the owner account lock.
export async function pinChapterImages(config, account, storyId, document, session) {
  return chapterImageSnapshot(config, account, storyId, document, session, true)
}

export async function inspectChapterImages(config, account, storyId, document, session) {
  return chapterImageSnapshot(config, account, storyId, document, session, false)
}

async function chapterImageSnapshot(config, account, storyId, document, session, pin) {
  const ids = chapterMediaIds(document)
  if (!ids.length) return { mediaIds: [] }
  const manifest = await imageManifest(
    config,
    account,
    storyId,
    ids.map(mediaId => ({ mediaId })),
    session,
    pin,
  )
  return {
    mediaIds: ids,
    mediaDigest: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    validation: { mediaManifestVersion: 'chapter-images-v1', mediaManifest: manifest },
  }
}

/**
 * Manifest entries, in the given order, of the owner's available private images checked against
 * their stored bytes. An entry with a `role` (story cover or banner) must be an asset of that kind
 * scoped to the story; other entries may also be unscoped. With `pin`, runs inside the caller's
 * transaction and bumps each asset version so a concurrent cleanup cannot delete it.
 */
export async function imageManifest(config, account, storyId, items, session, pin) {
  const ids = items.map(item => item.mediaId)
  const assets = await MediaAsset.find({
    _id: { $in: ids },
    ownerAccountId: account._id,
    status: 'available',
    accessClass: 'private',
    storageProvider: 'local',
  }).session(session ?? null)
  if (assets.length !== ids.length)
    throw new HttpError(
      409,
      'media_unavailable',
      'Một ảnh không còn sẵn sàng trong kho ảnh riêng của bạn.',
    )
  const manifest = []
  for (const { mediaId, role } of items) {
    const asset = assets.find(item => String(item._id) === mediaId)
    if (role && asset.kind !== role)
      throw new HttpError(409, 'media_unavailable', 'Ảnh bìa hoặc banner không đúng loại ảnh.')
    if ((role || asset.storyId) && String(asset.storyId) !== String(storyId))
      throw new HttpError(
        409,
        'media_wrong_story',
        'Ảnh đang được xếp vào truyện khác. Hãy chọn ảnh đúng truyện hoặc chưa gán truyện.',
      )
    const bytes = await readAuthorMedia(config, account._id, asset._id)
    // Check the transaction snapshot as well as the metadata used by the file reader.
    const checksum = createHash('sha256').update(bytes).digest('hex')
    if (
      checksum !== asset.checksum ||
      bytes.length !== asset.sizeBytes ||
      asset.contentType !== 'image/webp'
    )
      throw new HttpError(
        409,
        'media_changed',
        'Tệp ảnh đã thay đổi. Hãy tải lại ảnh trong bản nháp.',
      )
    manifest.push({
      mediaId,
      ...(role ? { role } : {}),
      checksum,
      sizeBytes: bytes.length,
      contentType: asset.contentType,
      storageProvider: asset.storageProvider,
    })
    if (!pin) continue
    const result = await MediaAsset.updateOne(
      { _id: asset._id, version: asset.version },
      { $inc: { version: 1 } },
      { session },
    )
    if (result.modifiedCount !== 1)
      throw new HttpError(409, 'stale_content', 'Ảnh đã thay đổi. Hãy tải lại ảnh trong bản nháp.')
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'media.attached',
          targetType: 'MediaAsset',
          targetId: asset._id,
          targetVersion: asset.version + 1,
          result: 'accepted',
          occurredAt: new Date(),
        },
      ],
      { session },
    )
  }
  return manifest
}
