import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  Account,
  AuditEvent,
  Category,
  ContentImport,
  Follow,
  Notification,
  PolicyVersion,
  PublicationSubmission,
  RoleAssignment,
  StatisticsEvent,
  Story,
} from '../models/index.js'
import { databaseState } from '../db/connection.js'
const query = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
const stamp = value => (value ? new Date(value).toISOString() : null)
const entry = (id, title, description = '', status = '', updatedAt = null, href = null) => ({
  id: String(id),
  title,
  description,
  status,
  updatedAt: stamp(updatedAt),
  href,
})
/** Explicit allowlisted projections, never arbitrary model access or document serialization. */
export function createWorkspaceDataRouter(config) {
  const router = Router()
  const get = (path, role, load) => {
    router.get(
      path,
      requireAuth(config),
      ...(role ? [requireRole(role)] : []),
      async (req, res, next) => {
        try {
          const parsed = query.safeParse(req.query)
          if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid pagination')
          const page = parsed.data.page
          const items = await load(req, {
            skip: (page - 1) * 50,
            limit: 51,
          })
          res.json({
            items: items.slice(0, 50),
            page,
            hasMore: items.length > 50,
          })
        } catch (error) {
          next(error)
        }
      },
    )
  }
  get('/workspace/author/imports', 'author', async (req, options) => {
    const items = await ContentImport.find({
      accountId: req.account._id,
    })
      .sort({
        createdAt: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .select('sourceType extractionStatus failureCode createdAt')
      .lean()
    return items.map(item =>
      entry(item._id, 'Nhập PDF', item.failureCode ?? '', item.extractionStatus, item.createdAt),
    )
  })
  const submissions = async (req, options, own) => {
    const items = await PublicationSubmission.find(
      own
        ? {
            authorAccountId: req.account._id,
          }
        : {},
    )
      .sort({
        submittedAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .populate('revisionId', 'content.title')
      .lean()
    return items.map(item =>
      entry(
        item._id,
        item.revisionId?.content?.title ?? 'Bản gửi duyệt',
        item.decisionSummary ?? '',
        item.status,
        item.submittedAt,
        own ? null : `/moderator/submissions/${item._id}`,
      ),
    )
  }
  get('/workspace/author/submissions', 'author', (req, options) => submissions(req, options, true))
  get('/workspace/author/analytics', 'author', async req => {
    const stories = await Story.find({
      authorAccountId: req.account._id,
    })
      .select('_id')
      .lean()
    const views = await StatisticsEvent.countDocuments({
      storyId: {
        $in: stories.map(story => story._id),
      },
      eventType: 'view',
    })
    const followers = await Follow.countDocuments({
      storyId: {
        $in: stories.map(story => story._id),
      },
      status: 'active',
    })
    return [
      entry('stories', 'Truyện', String(stories.length)),
      entry('views', 'Lượt xem đã ghi nhận', String(views)),
      entry('followers', 'Lượt theo dõi đang hoạt động', String(followers)),
    ]
  })
  get('/workspace/admin/users', 'admin', async (_req, options) => {
    const items = await Account.find()
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .select('displayName email status createdAt')
      .lean()
    return items.map(item =>
      entry(item._id, item.displayName, item.email ?? '', item.status, item.createdAt),
    )
  })
  get('/workspace/admin/roles', 'admin', async (_req, options) => {
    const items = await RoleAssignment.find()
      .sort({
        grantedAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .populate('accountId', 'displayName')
      .lean()
    return items.map(item =>
      entry(
        item._id,
        item.accountId?.displayName ?? 'Tài khoản',
        item.role,
        item.status,
        item.grantedAt,
      ),
    )
  })
  get('/workspace/admin/policies', 'admin', async (_req, options) => {
    const items = await PolicyVersion.find()
      .sort({
        effectiveAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .select(
        'status effectiveAt authorSharePercent platformSharePercent priceMinCoins priceMaxCoins',
      )
      .lean()
    return items.map(item =>
      entry(
        item._id,
        'Chính sách nền tảng',
        `Tác giả ${item.authorSharePercent}% · Nền tảng ${item.platformSharePercent}% · Giá ${item.priceMinCoins}–${item.priceMaxCoins} xu`,
        item.status,
        item.effectiveAt,
      ),
    )
  })
  get('/workspace/admin/audit', 'admin', async (_req, options) => {
    const items = await AuditEvent.find()
      .sort({
        occurredAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .select('action targetType result reason occurredAt')
      .lean()
    return items.map(item =>
      entry(item._id, item.action, item.reason ?? item.targetType, item.result, item.occurredAt),
    )
  })
  get('/workspace/admin/overview', 'admin', async () => {
    const [accounts, stories, categories, pending] = await Promise.all([
      Account.countDocuments(),
      Story.countDocuments({
        publicationStatus: 'published',
      }),
      Category.countDocuments({
        status: 'active',
      }),
      PublicationSubmission.countDocuments({
        status: 'pending-review',
      }),
    ])
    return [
      entry('accounts', 'Tài khoản', String(accounts)),
      entry('stories', 'Truyện đã xuất bản', String(stories)),
      entry('categories', 'Thể loại đang hoạt động', String(categories)),
      entry('pending', 'Bản gửi đang chờ duyệt', String(pending)),
    ]
  })
  get('/workspace/admin/content', 'admin', async (_req, options) => {
    const items = await Story.find()
      .sort({
        updatedAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .select('title publicationStatus updatedAt')
      .lean()
    return items.map(item =>
      entry(item._id, item.title, '', item.publicationStatus, item.updatedAt),
    )
  })
  get('/workspace/admin/moderation', 'admin', (req, options) => submissions(req, options, false))
  get('/workspace/admin/services', 'admin', async () => [
    entry('mongodb', 'MongoDB', '', databaseState()),
  ])
  get('/workspace/activity', null, async (req, options) => {
    const items = await Notification.find({
      recipientAccountId: req.account._id,
    })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(options.skip)
      .limit(options.limit)
      .select('eventType readAt createdAt')
      .lean()
    return items.map(item =>
      entry(item._id, item.eventType, '', item.readAt ? 'Đã đọc' : 'Chưa đọc', item.createdAt),
    )
  })
  // A concrete revision preview for review; no invented default submission ID.

  return router
}
