import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { AuditEvent, MediaAsset, ContentRevision, Story } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { lockAuthor, ownStory, editable } from './author-ownership.js';
import { HttpError } from '../middleware/errors.js';

export const MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const localRoot = fileURLToPath(new URL('../../uploads/media', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const keyPattern = /^[a-f\d-]{36}~(\d{1,5})x(\d{1,5})~([^/\\\p{Cc}]+\.webp)$/u;
const busy = new Set();
export const mediaRoot = (config) => path.resolve(config.mediaStorageDir ?? localRoot);
function filePath(config, key) {
  if (!keyPattern.test(key ?? ''))
    throw new HttpError(404, 'media_unavailable', 'Tệp ảnh chưa sẵn sàng.');
  const resolved = path.resolve(mediaRoot(config), key);
  if (path.dirname(resolved) !== mediaRoot(config))
    throw new HttpError(404, 'media_unavailable', 'Tệp ảnh chưa sẵn sàng.');
  return resolved;
}
function view(asset) {
  const parsed = keyPattern.exec(asset.objectKey ?? '');
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
  };
}

export async function authorMedia(accountId, cursor) {
  const filter = { ownerAccountId: accountId, status: 'available' };
  const items = await MediaAsset.find({ ...filter, ...(cursor ? { _id: { $lt: cursor } } : {}) })
    .select('+objectKey')
    .sort({ _id: -1 })
    .limit(51)
    .lean();
  const [stats] = await MediaAsset.aggregate([
    { $match: filter },
    { $group: { _id: null, bytes: { $sum: '$sizeBytes' }, count: { $sum: 1 } } },
  ]);
  const stories = await Story.find({
    authorAccountId: accountId,
    authoringFrozen: false,
    publicationStatus: { $nin: ['archived', 'submitted', 'under-review'] },
  })
    .select('title')
    .sort({ title: 1 })
    .lean();
  return {
    items: items.slice(0, 50).map(view),
    nextCursor: items.length > 50 ? String(items[49]._id) : null,
    stats: { bytes: stats?.bytes ?? 0, count: stats?.count ?? 0 },
    stories: stories.map((story) => ({ id: String(story._id), title: story.title })),
    maxUploadBytes: MEDIA_UPLOAD_BYTES,
  };
}

export async function uploadAuthorMedia(config, account, input, bytes) {
  const owner = String(account._id);
  if (busy.has(owner) || busy.size >= 4)
    throw new HttpError(429, 'upload_busy', 'Một ảnh khác đang được xử lý. Vui lòng chờ.');
  busy.add(owner);
  let stored;
  try {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MEDIA_UPLOAD_BYTES)
      throw new HttpError(400, 'invalid_image', 'Chọn ảnh PNG, JPEG hoặc WebP tối đa 10 MB.');
    let result;
    try {
      const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 16000000 });
      const metadata = await image.metadata();
      if (
        !['png', 'jpeg', 'webp'].includes(metadata.format) ||
        (metadata.pages ?? 1) !== 1 ||
        metadata.width > 10000 ||
        metadata.height > 10000
      )
        throw new Error('Unsupported image');
      result = await image.autoOrient().webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    } catch {
      throw new HttpError(
        400,
        'invalid_image',
        'Ảnh không hợp lệ. Hỗ trợ PNG, JPEG, WebP tĩnh tối đa 16 triệu điểm ảnh.',
      );
    }
    if (result.data.length > MEDIA_UPLOAD_BYTES)
      throw new HttpError(400, 'image_too_large', 'Ảnh sau xử lý vượt quá 10 MB.');
    const name =
      input.name
        .normalize('NFC')
        .replace(/[\\/<>:"|?*\p{Cc}]/gu, '_')
        .replace(/\.(png|jpe?g|webp)$/iu, '')
        .slice(0, 100)
        .replace(/[. ]+$/u, '') || 'image';
    const key = `${randomUUID()}~${result.info.width}x${result.info.height}~${name}.webp`;
    await mkdir(mediaRoot(config), { recursive: true });
    const file = filePath(config, key);
    await writeFile(file, result.data, { flag: 'wx' });
    stored = file;
    const asset = await withTransaction(async (session) => {
      await lockAuthor(account, session);
      if (input.storyId) editable(await ownStory(account, input.storyId, session));
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
      );
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
      );
      return created;
    });
    stored = null;
    return view(asset);
  } finally {
    busy.delete(owner);
    if (stored) await unlink(stored).catch(() => {});
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
    .lean();
  if (!asset) throw new HttpError(404, 'not_found', 'Không tìm thấy ảnh.');
  try {
    const file = filePath(config, asset.objectKey);
    const info = await stat(file);
    if (info.size > MEDIA_UPLOAD_BYTES || info.size !== asset.sizeBytes)
      throw new Error('Size mismatch');
    const bytes = await readFile(file);
    if (hash(bytes) !== asset.checksum) throw new Error('Checksum mismatch');
    return bytes;
  } catch {
    throw new HttpError(404, 'media_unavailable', 'Tệp ảnh chưa sẵn sàng.');
  }
}

export async function deleteAuthorMedia(account, id, expectedVersion) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    const asset = await MediaAsset.findOne({
      _id: id,
      ownerAccountId: account._id,
      status: 'available',
    }).session(session);
    if (!asset) throw new HttpError(404, 'not_found', 'Không tìm thấy ảnh.');
    if (asset.version !== expectedVersion)
      throw new HttpError(409, 'stale_content', 'Ảnh đã thay đổi. Hãy tải lại thư viện.');
    await assertUnused(asset, session);
    asset.status = 'deleted';
    asset.deletedAt = new Date();
    await asset.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'media.deleted',
          targetType: 'MediaAsset',
          targetId: asset._id,
          targetVersion: asset.version,
          result: 'accepted',
          occurredAt: new Date(),
        },
      ],
      { session },
    );
    return { id: String(asset._id) };
  });
}

async function assertUnused(asset, session) {
  const revision = await ContentRevision.exists({ mediaIds: asset._id }).session(session);
  const story = await Story.exists({
    $or: [{ coverMediaId: asset._id }, { 'theme.coverBannerMediaId': asset._id }],
  }).session(session);
  if (revision || story || asset.revisionId || asset.chapterId || asset.rightsDeclarationId)
    throw new HttpError(
      409,
      'media_in_use',
      'Ảnh đang được sử dụng hoặc đã gắn quyền nội dung, không thể thay đổi.',
    );
}

export async function organizeAuthorMedia(account, input) {
  return withTransaction(async (session) => {
    await lockAuthor(account, session);
    if (input.storyId) editable(await ownStory(account, input.storyId, session));
    const assets = await MediaAsset.find({
      _id: { $in: input.items.map((item) => item.id) },
      ownerAccountId: account._id,
      status: 'available',
    }).session(session);
    if (assets.length !== input.items.length)
      throw new HttpError(404, 'not_found', 'Một ảnh không còn trong thư viện của bạn.');
    const expected = new Map(
      input.items.map((item) => [item.id.toLowerCase(), item.expectedVersion]),
    );
    const checkedStories = new Set();
    let changed = 0;
    for (const asset of assets) {
      if (asset.version !== expected.get(String(asset._id)))
        throw new HttpError(
          409,
          'stale_content',
          'Ảnh đã thay đổi. Hãy tải lại thư viện trước khi sắp xếp.',
        );
      await assertUnused(asset, session);
      if (asset.storyId && !checkedStories.has(String(asset.storyId))) {
        editable(await ownStory(account, asset.storyId, session));
        checkedStories.add(String(asset.storyId));
      }
      if ((asset.storyId ? String(asset.storyId) : null) === input.storyId) continue;
      asset.storyId = input.storyId ?? undefined;
      await asset.save({ session });
      await AuditEvent.create(
        [
          {
            actorType: 'account',
            actorId: account._id,
            action: 'media.organized',
            targetType: 'MediaAsset',
            targetId: asset._id,
            targetVersion: asset.version,
            result: 'accepted',
            occurredAt: new Date(),
          },
        ],
        { session },
      );
      changed += 1;
    }
    return {
      changed,
      items: assets.map((asset) => ({ id: String(asset._id), version: asset.version })),
    };
  });
}
