import { Router } from 'express'
import { z } from 'zod'
import { Notification } from '../models/index.js'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { ownerWrite } from '../modules/reading-community/reading/owner-write.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const preferenceFields = ['spacing', 'canvas', 'speed', 'skip', 'autoplay']
const profileInput = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(1000),
    fontSize: z.enum(['small', 'medium', 'large', 'x-large']),
    fontSizePx: z.number().int().min(14).max(24).optional(),
    spacing: z.literal([1.4, 1.8, 2.2]).optional(),
    canvas: z.enum(['parchment', 'cream', 'navy']).optional(),
    speed: z.literal([0.8, 1, 1.25, 1.5]).optional(),
    skip: z.literal([10, 15, 30]).optional(),
    autoplay: z.boolean().optional(),
  })
  .strict()
const validate = (schema, value) => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.')
  return parsed.data
}
const profile = account => ({
  displayName: account.displayName,
  bio: account.profile?.bio ?? '',
  fontSize: account.preferences?.fontSize ?? 'medium',
  fontSizePx: account.preferences?.fontSizePx,
  ...Object.fromEntries(preferenceFields.map(field => [field, account.preferences?.[field]])),
})
function notificationView(item) {
  const text = (value, max = 4000) => (typeof value === 'string' ? value.slice(0, max) : '')
  const eventTitles = {
    'google.linked': 'Đã liên kết tài khoản Google',
    'monthly-payout.created': 'Khoản chi trả đã được lập',
    'monthly-payout.bank-details-missing': 'Cần bổ sung thông tin ngân hàng',
    'monthly-payout.Paid': 'Khoản chi trả đã thanh toán',
    'monthly-payout.Failed': 'Chi trả chưa thành công',
  }
  const decided = item.eventType === 'author-application.decided'
  const publication = item.eventType === 'publication.decided'
  const candidate = item.eventType.replace(/^reference\./, '').split('.')[0]
  const type =
    decided || item.eventType === 'publication.decided'
      ? 'author'
      : ['story', 'author', 'comment', 'system'].includes(candidate)
        ? candidate
        : 'system'
  const labels = {
    story: 'Cập nhật truyện',
    author: 'Tác giả',
    comment: 'Bình luận & phản hồi',
    system: 'Hệ thống',
  }
  const chapterReleased =
    item.eventType === 'story.chapter-released' &&
    /^[a-f\d]{24}$/i.test(item.payload?.storyId ?? '') &&
    /^[a-f\d]{24}$/i.test(item.payload?.chapterId ?? '')
  const authorContent =
    ['author.content-warning', 'author.content-unpublished'].includes(item.eventType) &&
    /^[a-f\d]{24}$/i.test(item.payload?.storyId ?? '')
  const reportResolved = item.eventType === 'report.resolved'
  const href = chapterReleased
    ? `/read/${item.payload.storyId}/${item.payload.chapterId}`
    : authorContent
      ? `/author/stories/${item.payload.storyId}`
      : reportResolved
        ? '/reader/notifications'
        : item.eventType === 'publication.decided'
          ? '/author/submissions'
          : decided
            ? '/author/apply'
            : /^[a-f\d]{24}$/i.test(item.payload?.storyId ?? '')
              ? `/stories/${item.payload.storyId}`
              : type === 'system'
                ? '/reader/wallet'
                : '/reader/library'
  const title = publication
    ? `${item.payload?.outcome === 'approved' ? 'Đã duyệt' : 'Cần chỉnh sửa'}: ${text(item.payload?.title, 200) || 'Gói gửi duyệt'}`
    : decided
      ? item.payload?.status === 'approved'
        ? 'Đơn đăng ký tác giả đã được duyệt'
        : 'Đã có kết quả xét duyệt đăng ký tác giả'
      : authorContent || reportResolved
        ? `${
            reportResolved
              ? 'Báo cáo đã được xử lý'
              : item.eventType === 'author.content-warning'
                ? 'Cảnh báo nội dung'
                : 'Nội dung bị ngừng phát hành'
          }: ${text(item.payload?.title, 200) || 'Nội dung'}`
        : text(item.payload?.title, 300) || 'Thông báo mới'
  const description =
    text(item.payload?.body) || text(item.payload?.reason) || text(item.payload?.feedback)
  return {
    id: String(item._id),
    title: eventTitles[item.eventType] ?? title,
    description,
    body: description,
    status: text(item.payload?.status ?? item.payload?.outcome, 40),
    read: Boolean(item.readAt),
    unread: !item.readAt,
    createdAt: item.createdAt,
    type,
    label: `${text(item.payload?.label, 80) || labels[type]}${item.eventType.startsWith('reference.') ? ' · Tham khảo' : ''}`,
    href: item.eventType.startsWith('monthly-payout.')
      ? '/author/earnings'
      : item.eventType === 'google.linked'
        ? '/reader/account'
        : href,
    action:
      decided || publication
        ? 'Xem kết quả'
        : chapterReleased
          ? 'Đọc chương'
          : authorContent
            ? 'Xem tác phẩm'
            : reportResolved
              ? 'Xem thông báo'
              : href.startsWith('/stories/')
                ? 'Xem truyện'
                : type === 'system'
                  ? 'Xem ví'
                  : 'Xem thư viện',
  }
}
export function createReaderDataRouter(config) {
  const router = Router()
  router.use('/reader', requireAuth(config))
  router.param('id', (_req, _res, next, value) => {
    if (!id.safeParse(value).success)
      return next(new HttpError(400, 'validation_error', 'ID không hợp lệ.'))
    next()
  })
  router.get('/reader/profile', (req, res) => res.json({ profile: profile(req.account) }))

  router.put('/reader/profile', async (req, res, next) => {
    try {
      const input = validate(profileInput, req.body)
      const account = await ownerWrite(req, async (session, account) => {
        account.displayName = input.displayName
        account.set('profile.bio', input.bio)
        account.set('preferences.fontSize', input.fontSize)
        account.set('preferences.fontSizePx', input.fontSizePx)
        for (const field of preferenceFields) {
          if (input[field] !== undefined) account.set(`preferences.${field}`, input[field])
        }
        await account.save({ session })
        return account
      })
      res.json({ profile: profile(account) })
    } catch (error) {
      next(error)
    }
  })
  router.get('/reader/notifications/unread-count', async (req, res, next) => {
    try {
      res.json({
        count: await Notification.countDocuments({
          recipientAccountId: req.account._id,
          deliveryState: { $ne: 'deleted' },
          readAt: null,
        }),
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/reader/notifications', async (req, res, next) => {
    try {
      const parsed = validate(
        z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
        req.query,
      )
      const items = await Notification.find({
        recipientAccountId: req.account._id,
        deliveryState: { $ne: 'deleted' },
      })
        .sort({ createdAt: -1, _id: -1 })
        .skip((parsed.page - 1) * 50)
        .limit(51)
        .lean()
      res.json({
        items: items.slice(0, 50).map(notificationView),
        hasMore: items.length > 50,
        unreadCount: await Notification.countDocuments({
          recipientAccountId: req.account._id,
          deliveryState: { $ne: 'deleted' },
          readAt: null,
        }),
      })
    } catch (error) {
      next(error)
    }
  })
  router.post('/reader/notifications/read-all', async (req, res, next) => {
    try {
      await ownerWrite(req, session =>
        Notification.updateMany(
          { recipientAccountId: req.account._id, deliveryState: { $ne: 'deleted' }, readAt: null },
          { $set: { readAt: new Date() }, $inc: { version: 1 } },
          { session },
        ),
      )
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })
  router.put('/reader/notifications/:id', async (req, res, next) => {
    try {
      const input = validate(z.object({ read: z.boolean() }).strict(), req.body)
      await ownerWrite(req, async session => {
        const result = await Notification.updateOne(
          {
            _id: req.params.id,
            recipientAccountId: req.account._id,
            deliveryState: { $ne: 'deleted' },
          },
          { $set: { readAt: input.read ? new Date() : null }, $inc: { version: 1 } },
          { session },
        )
        if (!result.matchedCount) throw new HttpError(404, 'not_found', 'Không tìm thấy thông báo.')
      })
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })
  router.delete('/reader/notifications/:id', async (req, res, next) => {
    try {
      await ownerWrite(req, async session => {
        const result = await Notification.updateOne(
          {
            _id: req.params.id,
            recipientAccountId: req.account._id,
            deliveryState: { $ne: 'deleted' },
          },
          { $set: { deliveryState: 'deleted' }, $inc: { version: 1 } },
          { session },
        )
        if (!result.matchedCount) throw new HttpError(404, 'not_found', 'Không tìm thấy thông báo.')
      })
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  router.post('/reader/notifications/:id/restore', async (req, res, next) => {
    try {
      await ownerWrite(req, async session => {
        const result = await Notification.updateOne(
          { _id: req.params.id, recipientAccountId: req.account._id, deliveryState: 'deleted' },
          { $set: { deliveryState: 'available' }, $inc: { version: 1 } },
          { session },
        )
        if (!result.matchedCount)
          throw new HttpError(404, 'not_found', 'Không tìm thấy thông báo đã xóa.')
      })
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  return router
}
