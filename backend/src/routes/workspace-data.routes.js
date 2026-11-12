import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  ContentImport,
  Follow,
  Notification,
  PublicationSubmission,
  StatisticsEvent,
  Story,
} from '../models/index.js'
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
