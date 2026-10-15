import { Router } from 'express';
import { z } from 'zod';
import {
  Account,
  Chapter,
  ContentRevision,
  Comment,
  Follow,
  Notification,
  ReadingProgress,
  Story,
  UnlockEntitlement,
} from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';

const id = z.string().regex(/^[a-f\d]{24}$/i);
const profileInput = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    bio: z.string().trim().max(1000),
    fontSize: z.enum(['small', 'medium', 'large', 'x-large']),
  })
  .strict();
const validate = (schema, value) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.');
  return parsed.data;
};
async function ownerWrite(req, work) {
  return withTransaction(async (session) => {
    const account = await Account.findOneAndUpdate(
      {
        _id: req.account._id,
        status: 'active',
        credentialVersion: req.account.credentialVersion,
        authorizationEpoch: req.account.authorizationEpoch,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!account) throw new HttpError(403, 'forbidden', 'Tài khoản không còn hoạt động.');
    return work(session, account);
  });
}
const profile = (account) => ({
  displayName: account.displayName,
  bio: account.profile?.bio ?? '',
  fontSize: account.preferences?.fontSize ?? 'medium',
});
export function createReaderDataRouter(config) {
  const router = Router();
  router.use('/reader', requireAuth(config));
  router.param('id', (_req, _res, next, value) => {
    if (!id.safeParse(value).success)
      return next(new HttpError(400, 'validation_error', 'ID không hợp lệ.'));
    next();
  });
  router.get('/reader/profile', (req, res) => res.json({ profile: profile(req.account) }));
  router.get('/reader/progress/:id', async (req, res, next) => {
    try {
      const progress = await ReadingProgress.findOne({
        accountId: req.account._id,
        chapterId: req.params.id,
        mode: 'text',
      })
        .select('position revisionId')
        .lean();
      res.json({ position: progress?.position ?? 0, revisionId: progress?.revisionId ?? null });
    } catch (error) {
      next(error);
    }
  });
  router.put('/reader/progress/:id', async (req, res, next) => {
    try {
      const input = validate(
        z.object({ position: z.number().min(0).max(1), revisionId: id }).strict(),
        req.body,
      );
      await ownerWrite(req, async (session) => {
        const chapter = await Chapter.findOne({
          _id: req.params.id,
          status: 'published',
          publishedRevisionId: input.revisionId,
        })
          .session(session)
          .lean();
        if (
          !chapter ||
          !(await Story.exists({
            _id: chapter.storyId,
            publicationStatus: 'published',
            publishedRevisionId: { $ne: null },
          }).session(session)) ||
          !(await ContentRevision.exists({
            _id: input.revisionId,
            storyId: chapter.storyId,
            chapterId: chapter._id,
            contentType: 'chapter',
            status: { $in: ['approved', 'immutable'] },
          }).session(session))
        )
          throw new HttpError(404, 'not_found', 'Không tìm thấy chương đã xuất bản.');
        if (
          chapter.earlyAccess?.enabled &&
          (!chapter.earlyAccess.endsAt || chapter.earlyAccess.endsAt > new Date())
        ) {
          const entitlement = await UnlockEntitlement.exists({
            accountId: req.account._id,
            chapterId: chapter._id,
            publishedRevisionId: chapter.publishedRevisionId,
            status: 'active',
            expiresAt: { $gt: new Date() },
          }).session(session);
          if (!chapter.earlyAccess.endsAt || !entitlement)
            throw new HttpError(403, 'chapter_locked', 'Chương chưa được mở khóa.');
        }
        const now = new Date();
        await ReadingProgress.updateOne(
          {
            accountId: req.account._id,
            chapterId: chapter._id,
            storyId: chapter.storyId,
            mode: 'text',
          },
          {
            $set: {
              position: input.position,
              revisionId: chapter.publishedRevisionId,
              lastReadAt: now,
              completedAt: input.position >= 1 ? now : null,
            },
          },
          { session, upsert: true, runValidators: true },
        );
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  router.put('/reader/profile', async (req, res, next) => {
    try {
      const input = validate(profileInput, req.body);
      const account = await ownerWrite(req, async (session, account) => {
        account.displayName = input.displayName;
        account.set('profile.bio', input.bio);
        account.set('preferences.fontSize', input.fontSize);
        await account.save({ session });
        return account;
      });
      res.json({ profile: profile(account) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/notifications', async (req, res, next) => {
    try {
      const parsed = validate(
        z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
        req.query,
      );
      const items = await Notification.find({
        recipientAccountId: req.account._id,
        deliveryState: { $ne: 'deleted' },
      })
        .sort({ createdAt: -1, _id: -1 })
        .skip((parsed.page - 1) * 50)
        .limit(51)
        .lean();
      res.json({
        items: items.slice(0, 50).map((item) => ({
          id: String(item._id),
          title: item.eventType,
          description: typeof item.payload?.reason === 'string' ? item.payload.reason : '',
          status: item.payload?.status ?? '',
          read: Boolean(item.readAt),
          createdAt: item.createdAt,
        })),
        hasMore: items.length > 50,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/reader/notifications/read-all', async (req, res, next) => {
    try {
      await ownerWrite(req, (session) =>
        Notification.updateMany(
          { recipientAccountId: req.account._id, deliveryState: { $ne: 'deleted' }, readAt: null },
          { $set: { readAt: new Date() }, $inc: { version: 1 } },
          { session },
        ),
      );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  router.put('/reader/notifications/:id', async (req, res, next) => {
    try {
      const input = validate(z.object({ read: z.boolean() }).strict(), req.body);
      await ownerWrite(req, async (session) => {
        const result = await Notification.updateOne(
          {
            _id: req.params.id,
            recipientAccountId: req.account._id,
            deliveryState: { $ne: 'deleted' },
          },
          { $set: { readAt: input.read ? new Date() : null }, $inc: { version: 1 } },
          { session },
        );
        if (!result.matchedCount)
          throw new HttpError(404, 'not_found', 'Không tìm thấy thông báo.');
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  router.delete('/reader/notifications/:id', async (req, res, next) => {
    try {
      await ownerWrite(req, async (session) => {
        const result = await Notification.updateOne(
          {
            _id: req.params.id,
            recipientAccountId: req.account._id,
            deliveryState: { $ne: 'deleted' },
          },
          { $set: { deliveryState: 'deleted' }, $inc: { version: 1 } },
          { session },
        );
        if (!result.matchedCount)
          throw new HttpError(404, 'not_found', 'Không tìm thấy thông báo.');
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/follows/:id', async (req, res, next) => {
    try {
      res.json({
        following: Boolean(
          await Follow.exists({
            accountId: req.account._id,
            storyId: req.params.id,
            status: 'active',
          }),
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  router.put('/reader/follows/:id', async (req, res, next) => {
    try {
      const input = validate(z.object({ following: z.boolean() }).strict(), req.body);
      await ownerWrite(req, async (session) => {
        if (
          !(await Story.exists({
            _id: req.params.id,
            publicationStatus: 'published',
            publishedRevisionId: { $ne: null },
          }).session(session))
        )
          throw new HttpError(404, 'not_found', 'Không tìm thấy truyện đã xuất bản.');
        await Follow.updateOne(
          { accountId: req.account._id, storyId: req.params.id },
          {
            $set: {
              status: input.following ? 'active' : 'removed',
              removedAt: input.following ? null : new Date(),
            },
          },
          { session, upsert: true, runValidators: true },
        );
      });
      res.json(input);
    } catch (error) {
      next(error);
    }
  });
  router.get('/community/stories/:id/comments', async (req, res, next) => {
    try {
      if (
        !(await Story.exists({
          _id: req.params.id,
          publicationStatus: 'published',
          publishedRevisionId: { $ne: null },
        }))
      )
        throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
      const items = await Comment.find({
        targetType: 'story',
        targetId: req.params.id,
        status: 'visible',
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(50)
        .populate('authorAccountId', 'displayName status')
        .select('body authorAccountId createdAt')
        .lean();
      res.json({
        items: items.map((item) => ({
          id: String(item._id),
          title:
            item.authorAccountId?.status === 'active'
              ? item.authorAccountId.displayName
              : 'Tài khoản đã ngừng hoạt động',
          description: item.body,
          updatedAt: item.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/community/stories/:id/comments', requireAuth(config), async (req, res, next) => {
    try {
      const input = validate(
        z.object({ body: z.string().trim().min(3).max(2000) }).strict(),
        req.body,
      );
      await ownerWrite(req, async (session) => {
        if (
          !(await Story.exists({
            _id: req.params.id,
            publicationStatus: 'published',
            publishedRevisionId: { $ne: null },
          }).session(session))
        )
          throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
        await Comment.create(
          [
            {
              authorAccountId: req.account._id,
              targetType: 'story',
              targetId: req.params.id,
              body: input.body,
            },
          ],
          { session },
        );
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
