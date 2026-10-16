import { MediaAsset, AuditEvent } from '../models/index.js';
import { readAuthorMedia } from './author-media.js';
import { chapterMediaIds } from './rich-chapter-document.js';
import { HttpError } from '../middleware/errors.js';

// Runs within the chapter save transaction, after the owner account lock.
export async function pinChapterImages(config, account, storyId, document, session) {
  const ids = chapterMediaIds(document);
  if (!ids.length) return [];
  const assets = await MediaAsset.find({
    _id: { $in: ids },
    ownerAccountId: account._id,
    status: 'available',
    accessClass: 'private',
    storageProvider: 'local',
  }).session(session);
  if (assets.length !== ids.length)
    throw new HttpError(
      409,
      'media_unavailable',
      'Một ảnh không còn sẵn sàng trong thư viện của bạn.',
    );
  for (const asset of assets) {
    if (asset.storyId && String(asset.storyId) !== String(storyId))
      throw new HttpError(
        409,
        'media_wrong_story',
        'Ảnh đang được xếp vào truyện khác. Hãy chọn ảnh đúng truyện hoặc chưa gán truyện.',
      );
    await readAuthorMedia(config, account._id, asset._id);
    const result = await MediaAsset.updateOne(
      { _id: asset._id, version: asset.version },
      { $inc: { version: 1 } },
      { session },
    );
    if (result.modifiedCount !== 1)
      throw new HttpError(409, 'stale_content', 'Ảnh đã thay đổi. Hãy tải lại thư viện.');
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
    );
  }
  return ids;
}
