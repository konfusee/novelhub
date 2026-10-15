import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import {
  Account,
  AuditEvent,
  AuthorRevenueRate,
  Category,
  Chapter,
  ContentImport,
  ContentReport,
  ContentRevision,
  Follow,
  LedgerEntry,
  MediaAsset,
  ModerationHistory,
  NarrationAsset,
  Notification,
  PolicyVersion,
  PublicationSubmission,
  ReadingProgress,
  RoleAssignment,
  SimilarityFinding,
  StatisticsEvent,
  Story,
  TopUpPackage,
  Wallet,
} from '../models/index.js';
import { publishedCards } from './catalog.routes.js';
import { databaseState } from '../db/connection.js';

const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
const stamp = (value) => (value ? new Date(value).toISOString() : null);
const entry = (id, title, description = '', status = '', updatedAt = null, href = null) => ({
  id: String(id),
  title,
  description,
  status,
  updatedAt: stamp(updatedAt),
  href,
});
const decimal = (value) => (value == null ? '0' : String(value));

/** Explicit allowlisted projections, never arbitrary model access or document serialization. */
export function createWorkspaceDataRouter(config) {
  const router = Router();
  const get = (path, role, load) => {
    router.get(
      path,
      requireAuth(config),
      ...(role ? [requireRole(role)] : []),
      async (req, res, next) => {
        try {
          const parsed = query.safeParse(req.query);
          if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid pagination');
          const page = parsed.data.page;
          const items = await load(req, { skip: (page - 1) * 50, limit: 51 });
          res.json({ items: items.slice(0, 50), page, hasMore: items.length > 50 });
        } catch (error) {
          next(error);
        }
      },
    );
  };
  const ownerWallet = async (req, options, purpose) => {
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: req.account._id,
      purpose,
    }).lean();
    const entries = wallet
      ? await LedgerEntry.find({ walletId: wallet._id })
          .sort({ occurredAt: -1, _id: -1 })
          .skip(options.skip)
          .limit(options.limit)
          .lean()
      : [];
    const items = entries.map((item) =>
      entry(
        item._id,
        item.ledgerType,
        `${item.direction === 'credit' ? '+' : '-'}${decimal(item.amount)} xu`,
        item.direction,
        item.occurredAt,
      ),
    );
    return items;
  };
  get('/workspace/reader/wallet', null, (req, options) =>
    ownerWallet(req, options, 'reader-coins'),
  );
  get('/workspace/reader/balance', null, async (req) => {
    const wallet = await Wallet.findOne({
      ownerType: 'account',
      ownerId: req.account._id,
      purpose: 'reader-coins',
    })
      .select('availableBalance')
      .lean();
    return [entry('balance', 'Số dư hiện tại', `${decimal(wallet?.availableBalance)} xu`)];
  });
  get('/workspace/author/earnings', 'author', (req, options) =>
    ownerWallet(req, options, 'author-earnings'),
  );
  get('/workspace/reader/packages', null, async (_req, options) => {
    const items = await TopUpPackage.find({ status: 'active' })
      .sort({ priceVnd: 1, _id: 1 })
      .skip(options.skip)
      .limit(options.limit)
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        `${decimal(item.coinAmount)} xu`,
        `${item.priceVnd.toLocaleString('vi-VN')} VND`,
        item.status,
      ),
    );
  });
  get('/workspace/reader/library', null, async (req, options) => {
    const follows = await Follow.find({ accountId: req.account._id, status: 'active' })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .lean();
    const cards = new Map(
      (
        await publishedCards({ ids: follows.map((item) => String(item.storyId)), pageSize: 51 })
      ).map((story) => [story.id, story]),
    );
    return follows.map((follow) => {
      const story = cards.get(String(follow.storyId));
      return entry(
        follow._id,
        story?.title ?? 'Truyện hiện không được xuất bản',
        story?.author ?? '',
        story ? 'Đang theo dõi' : 'Không khả dụng',
        follow.updatedAt,
        story ? `/stories/${story.id}` : null,
      );
    });
  });
  get('/workspace/reader/history', null, async (req, options) => {
    const progress = await ReadingProgress.find({ accountId: req.account._id })
      .sort({ lastReadAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .lean();
    const cards = new Map(
      (
        await publishedCards({ ids: progress.map((item) => String(item.storyId)), pageSize: 51 })
      ).map((story) => [story.id, story]),
    );
    return progress.map((item) => {
      const story = cards.get(String(item.storyId));
      return entry(
        item._id,
        story?.title ?? 'Nội dung không còn công khai',
        `Vị trí đã lưu: ${item.position ?? 0}`,
        item.completedAt ? 'Hoàn thành' : 'Đang đọc',
        item.lastReadAt,
        story ? `/read/${item.storyId}/${item.chapterId}` : null,
      );
    });
  });
  get('/workspace/reader/audio', null, async (req, options) => {
    // Narrations are exposed only after both the asset and chapter are published.
    const chapters = await Chapter.find({ status: 'published' }).select('_id').lean();
    const items = await NarrationAsset.find({
      chapterId: { $in: chapters.map((item) => item._id) },
      status: 'available',
    })
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('chapterId status createdAt')
      .lean();
    return items.map((item) =>
      entry(item._id, 'Bản thu âm', `Chương ${item.chapterId}`, item.status, item.createdAt),
    );
  });
  get('/workspace/author/media', 'author', async (req, options) => {
    const items = await MediaAsset.find({
      ownerAccountId: req.account._id,
      status: { $ne: 'deleted' },
    })
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('kind contentType sizeBytes status createdAt')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        item.kind,
        `${item.contentType ?? ''} · ${item.sizeBytes ?? 0} bytes`,
        item.status,
        item.createdAt,
      ),
    );
  });
  get('/workspace/author/imports', 'author', async (req, options) => {
    const items = await ContentImport.find({ accountId: req.account._id })
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('sourceType extractionStatus failureCode createdAt')
      .lean();
    return items.map((item) =>
      entry(item._id, 'Nhập PDF', item.failureCode ?? '', item.extractionStatus, item.createdAt),
    );
  });
  const submissions = async (req, options, own) => {
    const items = await PublicationSubmission.find(own ? { authorAccountId: req.account._id } : {})
      .sort({ submittedAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .populate('revisionId', 'content.title')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        item.revisionId?.content?.title ?? 'Bản gửi duyệt',
        item.decisionSummary ?? '',
        item.status,
        item.submittedAt,
        own ? null : `/moderator/submissions/${item._id}`,
      ),
    );
  };
  get('/workspace/author/submissions', 'author', (req, options) => submissions(req, options, true));
  get('/workspace/moderator/submissions', 'moderator', (req, options) =>
    submissions(req, options, false),
  );
  get('/workspace/author/analytics', 'author', async (req) => {
    const stories = await Story.find({ authorAccountId: req.account._id }).select('_id').lean();
    const views = await StatisticsEvent.countDocuments({
      storyId: { $in: stories.map((story) => story._id) },
      eventType: 'view',
    });
    const followers = await Follow.countDocuments({
      storyId: { $in: stories.map((story) => story._id) },
      status: 'active',
    });
    return [
      entry('stories', 'Truyện', String(stories.length)),
      entry('views', 'Lượt xem đã ghi nhận', String(views)),
      entry('followers', 'Lượt theo dõi đang hoạt động', String(followers)),
    ];
  });
  get('/workspace/moderator/reports', 'moderator', async (_req, options) => {
    const items = await ContentReport.find()
      .sort({ submittedAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('targetType targetId status submittedAt')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        `Báo cáo ${item.targetType}`,
        `Nội dung ${item.targetId}`,
        item.status,
        item.submittedAt,
      ),
    );
  });
  get('/workspace/moderator/evidence', 'moderator', async (_req, options) => {
    const items = await SimilarityFinding.find()
      .sort({ occurredAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('score revisionId rank occurredAt')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        `Mức tương đồng ${(item.score * 100).toFixed(1)}%`,
        `Revision ${item.revisionId} · Hạng ${item.rank}`,
        '',
        item.occurredAt,
      ),
    );
  });
  get('/workspace/moderator/activity', 'moderator', async (_req, options) => {
    const items = await ModerationHistory.find()
      .sort({ occurredAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('action outcome reason feedback occurredAt')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        item.action,
        item.feedback ?? item.reason ?? '',
        item.outcome,
        item.occurredAt,
      ),
    );
  });
  get('/workspace/admin/users', 'admin', async (_req, options) => {
    const items = await Account.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('displayName email status createdAt')
      .lean();
    return items.map((item) =>
      entry(item._id, item.displayName, item.email ?? '', item.status, item.createdAt),
    );
  });
  get('/workspace/admin/roles', 'admin', async (_req, options) => {
    const items = await RoleAssignment.find()
      .sort({ grantedAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .populate('accountId', 'displayName')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        item.accountId?.displayName ?? 'Tài khoản',
        item.role,
        item.status,
        item.grantedAt,
      ),
    );
  });
  get('/workspace/admin/policies', 'admin', async (_req, options) => {
    const items = await PolicyVersion.find()
      .sort({ effectiveAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select(
        'status effectiveAt authorSharePercent platformSharePercent priceMinCoins priceMaxCoins',
      )
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        'Chính sách nền tảng',
        `Tác giả ${item.authorSharePercent}% · Nền tảng ${item.platformSharePercent}% · Giá ${item.priceMinCoins}–${item.priceMaxCoins} xu`,
        item.status,
        item.effectiveAt,
      ),
    );
  });
  get('/workspace/admin/agreements', 'admin', async (_req, options) => {
    const items = await AuthorRevenueRate.find()
      .sort({ effectiveAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .populate('authorAccountId', 'displayName')
      .lean();
    return items.map((item) =>
      entry(
        item._id,
        item.authorAccountId?.displayName ?? 'Tác giả',
        `Tỷ lệ tác giả ${item.percentage}%`,
        '',
        item.effectiveAt,
      ),
    );
  });
  get('/workspace/admin/audit', 'admin', async (_req, options) => {
    const items = await AuditEvent.find()
      .sort({ occurredAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('action targetType result reason occurredAt')
      .lean();
    return items.map((item) =>
      entry(item._id, item.action, item.reason ?? item.targetType, item.result, item.occurredAt),
    );
  });
  get('/workspace/admin/overview', 'admin', async () => {
    const [accounts, stories, categories, pending] = await Promise.all([
      Account.countDocuments(),
      Story.countDocuments({ publicationStatus: 'published' }),
      Category.countDocuments({ status: 'active' }),
      PublicationSubmission.countDocuments({ status: 'pending-review' }),
    ]);
    return [
      entry('accounts', 'Tài khoản', String(accounts)),
      entry('stories', 'Truyện đã xuất bản', String(stories)),
      entry('categories', 'Thể loại đang hoạt động', String(categories)),
      entry('pending', 'Bản gửi đang chờ duyệt', String(pending)),
    ];
  });
  get('/workspace/admin/content', 'admin', async (_req, options) => {
    const items = await Story.find().sort({ updatedAt: -1, _id: -1 }).skip(options.skip).limit(options.limit).select('title publicationStatus updatedAt').lean();
    return items.map((item) => entry(item._id, item.title, '', item.publicationStatus, item.updatedAt));
  });
  get('/workspace/admin/transactions', 'admin', async (_req, options) => {
    const items = await LedgerEntry.find().sort({ occurredAt: -1, _id: -1 }).skip(options.skip).limit(options.limit).select('ledgerType amount direction occurredAt').lean();
    return items.map((item) => entry(item._id, item.ledgerType, `${item.direction === 'credit' ? '+' : '-'}${decimal(item.amount)} xu`, item.direction, item.occurredAt));
  });
  get('/workspace/admin/moderation', 'admin', (req, options) => submissions(req, options, false));
  get('/workspace/admin/services', 'admin', async () => [entry('mongodb', 'MongoDB', '', databaseState())]);
  get('/workspace/activity', null, async (req, options) => {
    const items = await Notification.find({ recipientAccountId: req.account._id })
      .sort({ createdAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .select('eventType readAt createdAt')
      .lean();
    return items.map((item) =>
      entry(item._id, item.eventType, '', item.readAt ? 'Đã đọc' : 'Chưa đọc', item.createdAt),
    );
  });
  // A concrete revision preview for review; no invented default submission ID.
  router.get(
    '/workspace/moderator/submissions/:id',
    requireAuth(config),
    requireRole('moderator'),
    async (req, res, next) => {
      try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id))
          throw new HttpError(400, 'validation_error', 'Invalid submission ID');
        const submission = await PublicationSubmission.findById(req.params.id).lean();
        if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy bản gửi duyệt.');
        const revision = await ContentRevision.findOne({
          _id: submission.revisionId,
          storyId: submission.storyId,
          authorAccountId: submission.authorAccountId,
        })
          .select('content')
          .lean();
        if (!revision) throw new HttpError(404, 'not_found', 'Không tìm thấy revision.');
        const items = [
          entry(
            submission._id,
            revision.content.title ?? 'Bản gửi duyệt',
            revision.content.description ?? '',
            submission.status,
            submission.submittedAt,
          ),
        ];
        for (const [index, block] of (revision.content.blocks ?? []).entries()) {
          if (block.type === 'paragraph' && typeof block.text === 'string')
            items.push(entry(`paragraph-${index}`, `Đoạn ${index + 1}`, block.text));
        }
        res.json({ items });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
