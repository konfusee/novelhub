import { createHash } from 'node:crypto'
import { MediaAsset, AuditEvent } from '../models/index.js'
import { readAuthorMedia } from './author-media.js'
import { chapterMediaIds } from './rich-chapter-document.js'
import { HttpError } from '../middleware/errors.js'

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
      'Một ảnh không còn sẵn sàng trong thư viện của bạn.',
    )
  const manifest = []
  for (const id of ids) {
    const asset = assets.find(item => String(item._id) === id)
    if (asset.storyId && String(asset.storyId) !== String(storyId))
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
      throw new HttpError(409, 'media_changed', 'Tệp ảnh đã thay đổi. Hãy tải lại thư viện.')
    manifest.push({
      mediaId: id,
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
      throw new HttpError(409, 'stale_content', 'Ảnh đã thay đổi. Hãy tải lại thư viện.')
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
  return {
    mediaIds: ids,
    mediaDigest: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    validation: { mediaManifestVersion: 'chapter-images-v1', mediaManifest: manifest },
  }
}
