import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Category, Comment, ContentRevision, Rating, Story } from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
const write = (method, path, cookie, body) =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body);
async function fixture() {
  const author = await authenticatedAccount('author');
  const reader = await authenticatedAccount();
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  });
  const story = await Story.create({
    title: 'SECRET draft',
    categoryIds: [category._id],
    authorAccountId: author.account._id,
    publicationStatus: 'published',
  });
  const revision = await ContentRevision.create({
    storyId: story._id,
    authorAccountId: author.account._id,
    contentType: 'story',
    revisionNumber: 1,
    formatVersion: 'story-v1',
    status: 'approved',
    content: { title: 'Public', categoryIds: [String(category._id)] },
  });
  story.publishedRevisionId = revision._id;
  await story.save();
  return { story, reader, author, base: `/api/community/stories/${story._id}` };
}
describe('persisted community', () => {
  it('saves replies under the correct visible root, rejects forged owners and nested replies', async () => {
    const { base, reader, author, story } = await fixture();
    expect(
      (await request(app).post(`${base}/comments`).set('Origin', origin).send({ body: 'Guest' }))
        .status,
    ).toBe(401);
    const root = await write('post', `${base}/comments`, reader.cookie, { body: 'Bình luận gốc' });
    expect(root.status).toBe(201);
    const reply = await write('post', `${base}/comments`, author.cookie, {
      body: 'Trả lời thật',
      parentId: root.body.id,
    });
    expect(reply.status).toBe(201);
    expect((await request(app).get(`${base}/comments`)).body).toMatchObject({
      total: 1,
      items: [{ id: root.body.id, replyCount: 1, body: 'Bình luận gốc' }],
    });
    const children = (await request(app).get(`${base}/comments?parentId=${root.body.id}`)).body;
    expect(children.items[0]).toMatchObject({ body: 'Trả lời thật', parentId: root.body.id });
    expect(JSON.stringify(children)).not.toContain(author.account.email);
    expect(
      (
        await write('post', `${base}/comments`, reader.cookie, {
          body: 'Nested',
          parentId: reply.body.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await write('post', `${base}/comments`, reader.cookie, {
          body: 'Forged',
          accountId: String(author.account._id),
        })
      ).status,
    ).toBe(400);
    await Comment.updateOne({ _id: root.body.id }, { $set: { status: 'hidden' } });
    expect((await request(app).get(`${base}/comments?parentId=${root.body.id}`)).status).toBe(404);
    expect((await request(app).get(`${base}/comments`)).body.total).toBe(0);
    expect(await Comment.countDocuments({ targetId: story._id })).toBe(2);
  });
  it('updates one rating per owner and exposes actual averages while rejecting invalid/publication inputs', async () => {
    const { base, reader, author, story } = await fixture();
    expect((await write('put', `${base}/rating`, reader.cookie, { value: 5 })).status).toBe(200);
    expect((await write('put', `${base}/rating`, reader.cookie, { value: 3 })).status).toBe(200);
    expect((await write('put', `${base}/rating`, author.cookie, { value: 5 })).status).toBe(200);
    expect(await Rating.countDocuments({ storyId: story._id })).toBe(2);
    expect((await request(app).get(`${base}/ratings`)).body.total).toBe(2);
    const detail = (await request(app).get(`/api/catalog/stories/${story._id}`)).body.story;
    expect(Number(detail.rating)).toBe(4);
    expect(detail.ratings).toBe(2);
    expect((await write('put', `${base}/rating`, reader.cookie, { value: 6 })).status).toBe(400);
    expect(
      (
        await write('put', `${base}/rating`, reader.cookie, {
          value: 1,
          accountId: String(author.account._id),
        })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).put(`${base}/rating`).set('Cookie', reader.cookie).send({ value: 1 }))
        .status,
    ).toBe(403);
    await Story.updateOne({ _id: story._id }, { $set: { publishedRevisionId: null } });
    expect((await request(app).get(`${base}/ratings`)).status).toBe(404);
    expect(
      (await write('post', `${base}/comments`, reader.cookie, { body: 'Private' })).status,
    ).toBe(404);
    expect((await write('put', `${base}/rating`, reader.cookie, { value: 1 })).status).toBe(404);
  });
  it('paginates roots separately from replies without dropping or leaking hidden posts', async () => {
    const { base, reader, story } = await fixture();
    for (let index = 0; index < 7; index += 1)
      await Comment.create({
        authorAccountId: reader.account._id,
        targetType: 'story',
        targetId: story._id,
        body: `Root ${index}`,
        status: index === 0 ? 'hidden' : 'visible',
      });
    const first = (await request(app).get(`${base}/comments`)).body;
    const second = (await request(app).get(`${base}/comments?page=2`)).body;
    expect(first.total).toBe(6);
    expect(first.items).toHaveLength(5);
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(6);
    expect(JSON.stringify([...first.items, ...second.items])).not.toContain('Root 0');
    expect((await request(app).get(`${base}/comments?page=0`)).status).toBe(400);
  });
});
