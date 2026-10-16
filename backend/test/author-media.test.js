import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { AuditEvent, MediaAsset, Story, Category } from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
let root, app, png;
const origin = 'http://localhost:5173';
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'novelhub-media-test-'));
  app = createApp(
    testConfig({ cookieName: 'novelhub_session', corsOrigin: origin, mediaStorageDir: root }),
  );
  png = await sharp({ create: { width: 80, height: 120, channels: 4, background: '#308070' } })
    .png()
    .toBuffer();
});
afterAll(async () => {
  if (root && path.basename(root).startsWith('novelhub-media-test-'))
    await rm(root, { recursive: true, force: true });
});
const upload = (cookie, query = {}, bytes = png) =>
  request(app)
    .post('/api/author/media')
    .query({ name: 'Bìa truyện.png', ...query })
    .set('Cookie', cookie)
    .set('Origin', origin)
    .set('Content-Type', 'application/octet-stream')
    .send(bytes);
const get = (cookie, url = '/api/author/media') => request(app).get(url).set('Cookie', cookie);
const remove = (cookie, asset, version = asset.version) =>
  request(app)
    .post(`/api/author/media/${asset.id}/delete`)
    .set('Cookie', cookie)
    .set('Origin', origin)
    .send({ expectedVersion: version });
it('stores decoded image bytes and MongoDB metadata, lists real totals and serves owner-only WebP', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const response = await upload(author.cookie, { kind: 'cover' });
  expect(response.status).toBe(201);
  const { asset } = response.body;
  expect(asset).toMatchObject({
    kind: 'cover',
    name: 'Bìa truyện.webp',
    width: 80,
    height: 120,
    contentType: 'image/webp',
    version: 0,
  });
  expect(asset).not.toHaveProperty('objectKey');
  const row = await MediaAsset.findById(asset.id).select('+objectKey');
  const bytes = await readFile(path.join(root, row.objectKey));
  expect((await sharp(bytes).metadata()).format).toBe('webp');
  const listed = await get(author.cookie);
  expect(listed.body.stats).toEqual({ bytes: bytes.length, count: 1 });
  expect(listed.body.items[0]).toEqual(asset);
  const image = await get(author.cookie, `/api${asset.url}`);
  expect(image.status).toBe(200);
  expect(image.headers['cache-control']).toBe('private, no-store');
  expect(image.body).toEqual(bytes);
  expect((await get(other.cookie)).body.items).toEqual([]);
  expect((await get(other.cookie, `/api${asset.url}`)).status).toBe(404);
  expect((await request(app).get(`/api${asset.url}`)).status).toBe(401);
  expect(await AuditEvent.countDocuments({ action: 'media.uploaded' })).toBe(1);
});
it('rejects unauthorized, forged, empty, animated/unsupported and oversized uploads', async () => {
  const author = await authenticatedAccount('author');
  const reader = await authenticatedAccount();
  expect((await upload(reader.cookie)).status).toBe(403);
  expect((await upload(author.cookie, {}, Buffer.from('<svg></svg>'))).status).toBe(400);
  expect((await upload(author.cookie, {}, Buffer.alloc(0))).status).toBe(400);
  expect((await upload(author.cookie, {}, Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
  expect(
    (
      await request(app)
        .post('/api/author/media?name=a.png')
        .set('Cookie', author.cookie)
        .set('Origin', 'https://elsewhere.test')
        .set('Content-Type', 'application/octet-stream')
        .send(png)
    ).status,
  ).toBe(403);
  expect(await MediaAsset.countDocuments()).toBe(0);
});
it('rolls back metadata and removes written files when ownership or audit validation fails', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: other.account._id,
  });
  const story = await Story.create({
    authorAccountId: other.account._id,
    title: 'Khác',
    description: 'Tóm tắt',
    categoryIds: [category._id],
  });
  const before = await readdir(root);
  expect((await upload(author.cookie, { storyId: String(story._id) })).status).toBe(404);
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Audit unavailable'));
  try {
    expect((await upload(author.cookie)).status).toBe(500);
  } finally {
    spy.mockRestore();
  }
  expect(await MediaAsset.countDocuments()).toBe(0);
  expect(await readdir(root)).toEqual(before);
});
it('checks versions and references before soft deletion, preserving bytes and audit history', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const { asset } = (await upload(author.cookie)).body;
  expect((await remove(other.cookie, asset)).status).toBe(404);
  expect((await remove(author.cookie, asset, 7)).status).toBe(409);
  await MediaAsset.updateOne({ _id: asset.id }, { $set: { revisionId: other.account._id } });
  expect((await remove(author.cookie, asset)).body.error.code).toBe('media_in_use');
  await MediaAsset.updateOne({ _id: asset.id }, { $unset: { revisionId: 1 } });
  expect((await remove(author.cookie, asset)).status).toBe(200);
  const row = await MediaAsset.findById(asset.id).select('+objectKey');
  expect(row.status).toBe('deleted');
  expect((await readFile(path.join(root, row.objectKey))).length).toBeGreaterThan(0);
  expect((await get(author.cookie)).body.stats).toEqual({ bytes: 0, count: 0 });
  expect((await get(author.cookie, `/api${asset.url}`)).status).toBe(404);
  expect(await AuditEvent.countDocuments({ action: 'media.deleted' })).toBe(1);
});
it('does not serve altered stored bytes', async () => {
  const author = await authenticatedAccount('author');
  const { asset } = (await upload(author.cookie)).body;
  const row = await MediaAsset.findById(asset.id).select('+objectKey');
  await writeFile(path.join(root, row.objectKey), Buffer.alloc(row.sizeBytes));
  expect((await get(author.cookie, `/api${asset.url}`)).body.error.code).toBe('media_unavailable');
});
it('paginates without leaking other accounts and reports totals across all pages', async () => {
  const author = await authenticatedAccount('author');
  await MediaAsset.insertMany(
    Array.from({ length: 52 }, () => ({
      ownerAccountId: author.account._id,
      kind: 'image',
      status: 'available',
      sizeBytes: 2,
    })),
  );
  const first = (await get(author.cookie)).body;
  const second = (await get(author.cookie, `/api/author/media?cursor=${first.nextCursor}`)).body;
  expect(first.items).toHaveLength(50);
  expect(second.items).toHaveLength(2);
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(52);
  expect(first.stats).toEqual({ bytes: 104, count: 52 });
  expect(second.nextCursor).toBeNull();
  expect((await get(author.cookie, '/api/author/media?cursor=bad')).status).toBe(400);
});
const organize = (cookie, assets, storyId = null) =>
  request(app)
    .post('/api/author/media/organize')
    .set('Cookie', cookie)
    .set('Origin', origin)
    .send({
      storyId,
      items: assets.map((asset) => ({ id: asset.id, expectedVersion: asset.version })),
    });
const makeStory = async (owner, name = 'Truyện nhận ảnh') => {
  const category = await Category.create({
    name: `Loại ${crypto.randomUUID()}`,
    normalizedName: crypto.randomUUID(),
    createdBy: owner.account._id,
  });
  return Story.create({
    authorAccountId: owner.account._id,
    title: name,
    description: 'Tóm tắt',
    categoryIds: [category._id],
  });
};
it('organizes private images atomically, persists versions and supports removing the story grouping', async () => {
  const author = await authenticatedAccount('author');
  const story = await makeStory(author);
  const assets = [
    (await upload(author.cookie)).body.asset,
    (await upload(author.cookie)).body.asset,
  ];
  const result = await organize(author.cookie, assets, String(story._id));
  expect(result.status).toBe(200);
  expect(result.body.changed).toBe(2);
  expect(result.body.items.map((item) => item.version)).toEqual([1, 1]);
  let listed = (await get(author.cookie)).body;
  expect(listed.items.every((item) => item.storyId === String(story._id))).toBe(true);
  expect(await AuditEvent.countDocuments({ action: 'media.organized' })).toBe(2);
  expect((await organize(author.cookie, listed.items)).status).toBe(200);
  listed = (await get(author.cookie)).body;
  expect(listed.items.every((item) => item.storyId === null && item.version === 2)).toBe(true);
  expect((await organize(author.cookie, listed.items)).body.changed).toBe(0);
});
it('rejects foreign destinations, duplicate ids, stale batches and locked source stories without partial changes', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const story = await makeStory(author);
  const foreign = await makeStory(other);
  const assets = [
    (await upload(author.cookie)).body.asset,
    (await upload(author.cookie)).body.asset,
  ];
  expect((await organize(author.cookie, assets, String(foreign._id))).status).toBe(404);
  expect((await organize(author.cookie, [assets[0], assets[0]], String(story._id))).status).toBe(
    400,
  );
  expect(
    (await organize(author.cookie, [assets[0], { ...assets[1], version: 77 }], String(story._id)))
      .status,
  ).toBe(409);
  expect(
    (await get(author.cookie)).body.items.every(
      (item) => item.storyId === null && item.version === 0,
    ),
  ).toBe(true);
  expect(await AuditEvent.countDocuments({ action: 'media.organized' })).toBe(0);
  story.authoringFrozen = true;
  await story.save();
  expect((await organize(author.cookie, assets, String(story._id))).body.error.code).toBe(
    'content_frozen',
  );
  story.authoringFrozen = false;
  await story.save();
  await organize(author.cookie, assets, String(story._id));
  story.authoringFrozen = true;
  await story.save();
  expect(
    (await organize(author.cookie, (await get(author.cookie)).body.items)).body.error.code,
  ).toBe('content_frozen');
});
it('blocks regrouping referenced media and rolls back when audit cannot be written', async () => {
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const story = await makeStory(author);
  const asset = (await upload(author.cookie)).body.asset;
  expect((await organize(other.cookie, [asset], String(story._id))).status).toBe(404);
  await MediaAsset.updateOne(
    { _id: asset.id },
    { $set: { rightsDeclarationId: other.account._id } },
  );
  expect((await organize(author.cookie, [asset], String(story._id))).body.error.code).toBe(
    'media_in_use',
  );
  await MediaAsset.updateOne({ _id: asset.id }, { $unset: { rightsDeclarationId: 1 } });
  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Audit unavailable'));
  try {
    expect((await organize(author.cookie, [asset], String(story._id))).status).toBe(500);
  } finally {
    spy.mockRestore();
  }
  const unchanged = await MediaAsset.findById(asset.id);
  expect(unchanged.storyId).toBeUndefined();
  expect(unchanged.version).toBe(0);
});
