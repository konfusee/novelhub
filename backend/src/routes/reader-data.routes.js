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
  Rating,
  Story,
  UnlockEntitlement,
  Wallet,
  StatisticsEvent,
} from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';
import { readerLibrary, readerHistory } from '../modules/reader-collections.js';
import { readerHome, readerFollowing } from '../modules/reader-home.js';

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
function notificationView(item) {
  const text = (value, max = 4000) => (typeof value === 'string' ? value.slice(0, max) : '');
  const decided = item.eventType === 'author-application.decided';
  const candidate = item.eventType.replace(/^reference\./, '').split('.')[0];
  const type =
    decided || item.eventType === 'publication.decided'
      ? 'author'
      : ['story', 'author', 'comment', 'system'].includes(candidate)
        ? candidate
        : 'system';
  const labels = {
    story: 'Cập nhật truyện',
    author: 'Tác giả',
    comment: 'Bình luận & phản hồi',
    system: 'Hệ thống',
  };
  const href =
    item.eventType === 'publication.decided'
      ? '/author/submissions'
      : decided
        ? '/author/apply'
        : /^[a-f\d]{24}$/i.test(item.payload?.storyId ?? '')
          ? `/stories/${item.payload.storyId}`
          : type === 'system'
            ? '/reader/wallet'
            : '/reader/library';
  const title = decided
    ? item.payload?.status === 'approved'
      ? 'Đơn đăng ký tác giả đã được duyệt'
      : 'Đã có kết quả xét duyệt đăng ký tác giả'
    : text(item.payload?.title, 300) || 'Thông báo mới';
  const description = text(item.payload?.body) || text(item.payload?.reason);
  return {
    id: String(item._id),
    title,
    description,
    body: description,
    status: text(item.payload?.status, 40),
    read: Boolean(item.readAt),
    unread: !item.readAt,
    createdAt: item.createdAt,
    type,
    label: `${text(item.payload?.label, 80) || labels[type]}${item.eventType.startsWith('reference.') ? ' · Tham khảo' : ''}`,
    href,
    action: decided
      ? 'Xem kết quả'
      : href.startsWith('/stories/')
        ? 'Xem truyện'
        : type === 'system'
          ? 'Xem ví'
          : 'Xem thư viện',
  };
}
export function createReaderDataRouter(config) {
  const router = Router();
  router.use('/reader', requireAuth(config));
  router.param('id', (_req, _res, next, value) => {
    if (!id.safeParse(value).success)
      return next(new HttpError(400, 'validation_error', 'ID không hợp lệ.'));
    next();
  });
  router.get('/reader/profile', (req, res) => res.json({ profile: profile(req.account) }));
  router.get('/reader/balance', async (req, res, next) => {
    try {
      const wallets = await Wallet.find({
        ownerType: 'account',
        ownerId: req.account._id,
        purpose: { $in: ['reader-coins', 'author-earnings'] },
      })
        .select('purpose availableBalance')
        .lean();
      const balance = (purpose) =>
        Number(wallets.find((item) => item.purpose === purpose)?.availableBalance ?? 0);
      res.json({
        readerCoins: balance('reader-coins'),
        authorEarnings: balance('author-earnings'),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/home', async (req, res, next) => {
    try {
      const { picksPage } = validate(
        z.object({ picksPage: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
        req.query,
      );
      res.json(await readerHome(req.account._id, picksPage));
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/following', async (req, res, next) => {
    try {
      res.json(await readerFollowing(req.account._id));
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/library', async (req, res, next) => {
    try {
      res.json(await readerLibrary(req.account._id));
    } catch (error) {
      next(error);
    }
  });
  router.get('/reader/history', async (req, res, next) => {
    try {
      res.json(await readerHistory(req.account._id));
    } catch (error) {
      next(error);
    }
  });
  router.delete('/reader/history', async (req, res, next) => {
    try {
      await ownerWrite(req, (session) =>
        ReadingProgress.updateMany(
          { accountId: req.account._id },
          { $unset: { lastReadAt: 1 } },
          { session },
        ),
      );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
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
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
        const viewerKey = String(req.account._id);
        // Account writes are serialized by ownerWrite. Append once per account/chapter/day,
        // matching the existing statistics unique index without mutating an append-only event.
        const viewed = await StatisticsEvent.exists({
          chapterId: chapter._id,
          day,
          eventType: 'view',
          viewerType: 'account',
          viewerKey,
        }).session(session);
        if (!viewed)
          await StatisticsEvent.create(
            [
              {
                sourceEventKey: `view:account:${viewerKey}:${chapter._id}:${day}`,
                eventType: 'view',
                day,
                viewerType: 'account',
                viewerKey,
                storyId: chapter.storyId,
                chapterId: chapter._id,
                occurredAt: now,
              },
            ],
            { session },
          );
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
  router.get('/reader/notifications/unread-count', async (req, res, next) => {
    try {
      res.json({
        count: await Notification.countDocuments({
          recipientAccountId: req.account._id,
          deliveryState: { $ne: 'deleted' },
          readAt: null,
        }),
      });
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
        items: items.slice(0, 50).map(notificationView),
        hasMore: items.length > 50,
        unreadCount: await Notification.countDocuments({
          recipientAccountId: req.account._id,
          deliveryState: { $ne: 'deleted' },
          readAt: null,
        }),
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
  router.post('/reader/notifications/:id/restore', async (req, res, next) => {
    try {
      await ownerWrite(req, async (session) => {
        const result = await Notification.updateOne(
          { _id: req.params.id, recipientAccountId: req.account._id, deliveryState: 'deleted' },
          { $set: { deliveryState: 'available' }, $inc: { version: 1 } },
          { session },
        );
        if (!result.matchedCount)
          throw new HttpError(404, 'not_found', 'Không tìm thấy thông báo đã xóa.');
      });
      res.json({ ok: true });
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

  const publicStory = async (storyId, session) => {
    const story = await Story.findOne({
      _id: storyId,
      publicationStatus: 'published',
      publishedRevisionId: { $ne: null },
    })
      .session(session ?? null)
      .lean();
    const revision =
      story &&
      (await ContentRevision.findOne({
        _id: story.publishedRevisionId,
        storyId: story._id,
        authorAccountId: story.authorAccountId,
        contentType: 'story',
        status: { $in: ['approved', 'immutable'] },
        'content.title': { $type: 'string', $ne: '' },
      })
        .session(session ?? null)
        .lean());
    if (!revision) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
  };
  const parentFor = async (storyId, parentId, session) => {
    if (!parentId) return;
    const parent = await Comment.findOne({
      _id: parentId,
      targetType: 'story',
      targetId: storyId,
      parentCommentId: null,
      status: 'visible',
    }).session(session ?? null);
    if (!parent) throw new HttpError(404, 'not_found', 'Không tìm thấy bình luận gốc.');
  };
  const communityPage = z
    .object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
      parentId: id.optional(),
    })
    .strict();
  const authorName = (account) =>
    account?.status === 'anonymized'
      ? 'Deleted user'
      : account?.status === 'active'
        ? account.displayName
        : 'Tài khoản đã ngừng hoạt động';
  router.get('/community/stories/:id/comments', async (req, res, next) => {
    try {
      const { page, parentId } = validate(communityPage, req.query);
      await publicStory(req.params.id);
      await parentFor(req.params.id, parentId);
      const filter = {
        targetType: 'story',
        targetId: req.params.id,
        status: 'visible',
        parentCommentId: parentId ?? null,
      };
      const pageSize = parentId ? 20 : 5;
      const [total, rows] = await Promise.all([
        Comment.countDocuments(filter),
        Comment.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .populate('authorAccountId', 'displayName status')
          .lean(),
      ]);
      const counts =
        parentId || !rows.length
          ? []
          : await Comment.aggregate([
              {
                $match: {
                  targetType: 'story',
                  targetId: rows[0].targetId,
                  status: 'visible',
                  parentCommentId: { $in: rows.map((row) => row._id) },
                },
              },
              { $group: { _id: '$parentCommentId', count: { $sum: 1 } } },
            ]);
      res.json({
        total,
        page,
        pageSize,
        items: rows.map((row) => ({
          id: String(row._id),
          author: authorName(row.authorAccountId),
          body: row.body,
          createdAt: row.createdAt,
          parentId: row.parentCommentId ? String(row.parentCommentId) : null,
          replyCount: counts.find((count) => count._id.equals(row._id))?.count ?? 0,
          // Existing read-only consumers use these aliases.
          title: authorName(row.authorAccountId),
          description: row.body,
          updatedAt: row.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/community/stories/:id/comments', requireAuth(config), async (req, res, next) => {
    try {
      const input = validate(
        z.object({ body: z.string().trim().min(3).max(2000), parentId: id.optional() }).strict(),
        req.body,
      );
      let comment;
      await ownerWrite(req, async (session) => {
        await publicStory(req.params.id, session);
        await parentFor(req.params.id, input.parentId, session);
        [comment] = await Comment.create(
          [
            {
              authorAccountId: req.account._id,
              targetType: 'story',
              targetId: req.params.id,
              body: input.body,
              ...(input.parentId ? { parentCommentId: input.parentId } : {}),
            },
          ],
          { session },
        );
      });
      res.status(201).json({ ok: true, id: String(comment._id) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/community/stories/:id/ratings', async (req, res, next) => {
    try {
      const { page } = validate(
        z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
        req.query,
      );
      await publicStory(req.params.id);
      const filter = { storyId: req.params.id, status: 'active' };
      const [total, rows] = await Promise.all([
        Rating.countDocuments(filter),
        Rating.find(filter)
          .sort({ updatedAt: -1, _id: -1 })
          .skip((page - 1) * 5)
          .limit(5)
          .populate('accountId', 'displayName status')
          .lean(),
      ]);
      res.json({
        total,
        page,
        pageSize: 5,
        items: rows.map((row) => ({
          id: String(row._id),
          author: authorName(row.accountId),
          rating: row.value,
          createdAt: row.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.put('/community/stories/:id/rating', requireAuth(config), async (req, res, next) => {
    try {
      const input = validate(
        z.object({ value: z.number().int().min(1).max(5) }).strict(),
        req.body,
      );
      await ownerWrite(req, async (session) => {
        await publicStory(req.params.id, session);
        await Rating.findOneAndUpdate(
          { accountId: req.account._id, storyId: req.params.id },
          { $set: { value: input.value, status: 'active', removedAt: null } },
          { upsert: true, session, runValidators: true },
        );
      });
      res.json({ ok: true, value: input.value });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
