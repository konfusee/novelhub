import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Account,
  Notification,
  Story,
  Category,
  ContentRevision,
  Wallet,
} from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';

useTestDatabase();
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
const write = (method, path, cookie, body) =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body);
describe('real reader and staff data', () => {
  it('persists profile fields, never changes email and rejects forged owner/private fields', async () => {
    const user = await authenticatedAccount();
    const other = await authenticatedAccount();
    const body = { displayName: 'Tên thật', bio: 'Giới thiệu thật', fontSize: 'large' };
    expect((await write('put', '/api/reader/profile', user.cookie, body)).status).toBe(200);
    expect(
      (await request(app).get('/api/reader/profile').set('Cookie', user.cookie)).body.profile,
    ).toEqual(body);
    expect(
      (await request(app).get('/api/reader/profile').set('Cookie', other.cookie)).body.profile.bio,
    ).toBe('');
    expect(
      (
        await write('put', '/api/reader/profile', user.cookie, {
          ...body,
          email: 'forged@test.local',
        })
      ).status,
    ).toBe(400);
    expect((await Account.findById(user.account._id)).email).toBe(user.account.email);
    expect((await request(app).get('/api/reader/profile')).status).toBe(401);
  });
  it('reads, marks and soft-deletes only own actual notifications', async () => {
    const user = await authenticatedAccount();
    const other = await authenticatedAccount();
    const mine = await Notification.create({
      recipientAccountId: user.account._id,
      eventType: 'author-application.decided',
      sourceEventKey: 'mine',
      payload: { reason: 'Lý do thật', status: 'rejected', secret: 'not-serialized' },
    });
    const theirs = await Notification.create({
      recipientAccountId: other.account._id,
      eventType: 'private',
      sourceEventKey: 'theirs',
    });
    const list = await request(app).get('/api/reader/notifications').set('Cookie', user.cookie);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].description).toBe('Lý do thật');
    expect(JSON.stringify(list.body)).not.toContain('not-serialized');
    expect(
      (await write('put', `/api/reader/notifications/${theirs._id}`, user.cookie, { read: true }))
        .status,
    ).toBe(404);
    expect(
      (await write('post', '/api/reader/notifications/read-all', user.cookie, {})).status,
    ).toBe(200);
    expect((await Notification.findById(mine._id)).readAt).toBeTruthy();
    expect((await Notification.findById(theirs._id)).readAt).toBeFalsy();
    expect(
      (await write('delete', `/api/reader/notifications/${mine._id}`, user.cookie)).status,
    ).toBe(204);
    expect(
      (await request(app).get('/api/reader/notifications').set('Cookie', user.cookie)).body.items,
    ).toEqual([]);
    expect((await Notification.findById(mine._id)).deliveryState).toBe('deleted');
  });
  it('takes wallet balances from MongoDB and isolates accounts and staff routes', async () => {
    const user = await authenticatedAccount();
    const other = await authenticatedAccount();
    await Wallet.create({
      ownerType: 'account',
      ownerId: user.account._id,
      purpose: 'reader-coins',
      availableBalance: 123,
    });
    const own = await request(app).get('/api/workspace/reader/balance').set('Cookie', user.cookie);
    expect(own.body.items[0].description).toBe('123 xu');
    expect(
      (await request(app).get('/api/workspace/reader/balance').set('Cookie', other.cookie)).body
        .items[0].description,
    ).toBe('0 xu');
    for (const path of [
      '/workspace/admin/users',
      '/workspace/admin/roles',
      '/workspace/admin/policies',
      '/workspace/admin/audit',
      '/workspace/moderator/submissions',
      '/workspace/moderator/reports',
      '/workspace/author/earnings',
      '/workspace/author/media',
    ]) {
      expect(
        (
          await request(app)
            .get('/api' + path)
            .set('Cookie', user.cookie)
        ).status,
      ).toBe(403);
      expect((await request(app).get('/api' + path)).status).toBe(401);
    }
  });
  it('saves follows and comments against a real published story, without trusting client owners', async () => {
    const author = await authenticatedAccount('author');
    const reader = await authenticatedAccount();
    const other = await authenticatedAccount();
    const category = await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'kỳ ảo',
      createdBy: author.account._id,
    });
    const story = await Story.create({
      title: 'Private draft title',
      categoryIds: [category._id],
      authorAccountId: author.account._id,
      publicationStatus: 'published',
    });
    const revision = await ContentRevision.create({
      storyId: story._id,
      contentType: 'story',
      authorAccountId: author.account._id,
      revisionNumber: 1,
      formatVersion: 'story-v1',
      status: 'approved',
      content: { title: 'Published story', categoryIds: [String(category._id)] },
    });
    story.publishedRevisionId = revision._id;
    await story.save();
    const followPath = `/api/reader/follows/${story._id}`;
    expect((await write('put', followPath, reader.cookie, { following: true })).status).toBe(200);
    expect(
      (await request(app).get('/api/workspace/reader/library').set('Cookie', reader.cookie)).body
        .items[0].title,
    ).toBe('Published story');
    expect(
      (await request(app).get('/api/workspace/reader/library').set('Cookie', other.cookie)).body
        .items,
    ).toEqual([]);
    const commentPath = `/api/community/stories/${story._id}/comments`;
    expect(
      (await write('post', commentPath, reader.cookie, { body: 'Bình luận thật' })).status,
    ).toBe(201);
    expect((await request(app).get(commentPath)).body.items[0].description).toBe('Bình luận thật');
    expect(
      (
        await write('post', commentPath, reader.cookie, {
          body: 'Bình luận giả',
          accountId: String(other.account._id),
        })
      ).status,
    ).toBe(400);
  });
});
