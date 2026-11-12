import { z } from 'zod'
import { HttpError } from '../middleware/errors.js'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getAuthorEarnings } from '../modules/coins-payouts/finance/author-earnings.js'

export function createAuthorEarningsRouter(config) {
  const router = Router()

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
