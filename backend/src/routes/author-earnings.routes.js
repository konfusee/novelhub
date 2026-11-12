import { Story } from '../models/index.js'
import { z } from 'zod'
import { HttpError } from '../middleware/errors.js'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getAuthorEarnings } from '../modules/coins-payouts/finance/author-earnings.js'

export function createAuthorEarningsRouter(config) {
  const router = Router()
  router.get(
    '/author/earnings/stories',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const query = z
          .object({ search: z.string().trim().max(100).default('') })
          .strict()
          .safeParse(req.query)
        if (!query.success)
          throw new HttpError(400, 'validation_error', 'Tìm kiếm truyện không hợp lệ.')
        const literal = query.data.search.replace(
          /[.*+?^${}()|[\]\\]/g,
          character => '\\' + character,
        )
        const items = await Story.find({
          authorAccountId: req.account._id,
          ...(literal ? { title: { $regex: literal, $options: 'i' } } : {}),
        })
          .select('title')
          .sort({ title: 1, _id: 1 })
          .limit(50)
          .lean()
        res.set('Cache-Control', 'private, no-store').json({ items })
      } catch (error) {
        next(error)
      }
    },
  )

  router.get(
    '/author/earnings',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            page: z.coerce.number().int().min(1).max(10000).default(1),
            type: z
              .enum(['all', 'allocation-credit', 'withdrawal-debit', 'adjustment', 'reversal'])
              .default('all'),
            storyId: z
              .string()
              .regex(/^[a-fA-F0-9]{24}$/)
              .optional(),
            from: z.string().datetime({ offset: true }).optional(),
            to: z.string().datetime({ offset: true }).optional(),
          })
          .strict()
          .refine(value => !value.from || !value.to || new Date(value.from) < new Date(value.to))
          .safeParse(req.query)
        if (!parsed.success)
          throw new HttpError(400, 'validation_error', 'Bộ lọc thu nhập không hợp lệ.')
        const result = await getAuthorEarnings(req.account._id, parsed.data)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
