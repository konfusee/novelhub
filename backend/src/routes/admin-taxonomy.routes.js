import { Router } from 'express'
import { z } from 'zod'
import { Account, AuditEvent, Category, RoleAssignment, Story } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { withTransaction } from '../db/connection.js'

const values = {
  name: z.string().trim().min(1).max(100),
  sortKey: z.number().int().min(0).max(1000000),
}
const create = z.object({ ...values, reason: z.string().trim().min(1).max(1000) }).strict()
const update = create.extend({
  expectedVersion: z.number().int().min(0),
  status: z.enum(['active', 'retired']),
})
const view = category => ({
  id: String(category._id),
  name: category.name,
  sortKey: category.sortKey,
  status: category.status,
  version: category.version,
})
export function createAdminTaxonomyRouter(config) {
  const router = Router()
  router.use('/admin/taxonomy/categories', requireAuth(config), requireRole('admin'))
  router.get('/admin/taxonomy/categories', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
          status: z.enum(['all', 'active', 'retired']).default('all'),
          q: z.string().trim().max(100).default(''),
        })
        .strict()
        .safeParse(req.query)
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc thể loại không hợp lệ.')
      const { page, pageSize, status, q } = parsed.data
      const match = {
        ...(status === 'all' ? {} : { status }),
        ...(q ? { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {}),
      }
      const [items, total] = await Promise.all([
        Category.find(match)
          .sort({ sortKey: 1, name: 1, _id: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Category.countDocuments(match),
      ])
      const counts = await Story.aggregate([
        { $match: { categoryIds: { $in: items.map(item => item._id) } } },
        { $unwind: '$categoryIds' },
        { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
      ])
      const byId = new Map(counts.map(item => [String(item._id), item.count]))
      res.set('Cache-Control', 'private, no-store').json({
        items: items.map(item => ({
          ...view(item),
          storyCount: byId.get(String(item._id)) ?? 0,
        })),
        total,
        page,
        pageSize,
      })
    } catch (error) {
      next(error)
    }
  })
  async function write(req, res, next) {
    try {
      const editing = req.method === 'PUT'
      const parsed = (editing ? update : create).safeParse(req.body)
      if (!parsed.success || (editing && !/^[a-f\d]{24}$/i.test(req.params.id)))
        throw new HttpError(400, 'validation_error', 'Thông tin thể loại hoặc lý do không hợp lệ.')
      const input = parsed.data
      const category = await withTransaction(async session => {
        const actor = await Account.findOneAndUpdate(
          {
            _id: req.account._id,
            status: 'active',
            authorizationEpoch: req.account.authorizationEpoch,
            credentialVersion: req.account.credentialVersion,
          },
          { $inc: { version: 1 } },
          { session },
        )
        const role = await RoleAssignment.exists({
          accountId: req.account._id,
          role: 'admin',
          status: 'active',
        }).session(session)
        if (!actor || !role)
          throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
        const name = input.name.normalize('NFC').replace(/\s+/gu, ' ')
        let item
        if (editing) {
          item = await Category.findById(req.params.id).session(session)
          if (!item) throw new HttpError(404, 'not_found', 'Không tìm thấy thể loại.')
          if (item.version !== input.expectedVersion)
            throw new HttpError(409, 'category_changed', 'Thể loại đã thay đổi. Hãy tải lại.')
          item.name = name
          item.normalizedName = name.toLocaleLowerCase('vi')
          item.sortKey = input.sortKey
          if (item.status !== input.status)
            item.retiredAt = input.status === 'retired' ? new Date() : undefined
          item.status = input.status
          await item.save({ session })
        } else {
          ;[item] = await Category.create(
            [
              {
                name,
                normalizedName: name.toLocaleLowerCase('vi'),
                sortKey: input.sortKey,
                createdBy: req.account._id,
              },
            ],
            { session },
          )
        }
        await AuditEvent.create(
          [
            {
              actorType: 'account',
              actorId: req.account._id,
              action: editing ? 'category.updated' : 'category.created',
              targetType: 'Category',
              targetId: item._id,
              targetVersion: item.version,
              result: 'success',
              reason: input.reason,
              occurredAt: new Date(),
            },
          ],
          { session },
        )
        return item
      })
      res
        .status(editing ? 200 : 201)
        .set('Cache-Control', 'private, no-store')
        .json({ category: view(category) })
    } catch (error) {
      next(
        error.code === 11000
          ? new HttpError(409, 'category_exists', 'Tên thể loại đã tồn tại.')
          : error,
      )
    }
  }
  router.post('/admin/taxonomy/categories', write)
  router.put('/admin/taxonomy/categories/:id', write)
  return router
}
