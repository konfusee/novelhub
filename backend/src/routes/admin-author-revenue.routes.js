import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { getAdminAuthorRevenue } from '../modules/admin-author-revenue.js'

const querySchema = z
  .object({
    periodId: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict()

export function createAdminAuthorRevenueRouter(config) {
  const router = Router()

  router.get(
    '/admin/author-revenue',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = querySchema.safeParse(req.query)

        if (!parsed.success) {
          throw new HttpError(400, 'validation_error', 'Bộ lọc doanh thu không hợp lệ.')
        }

        const result = await getAdminAuthorRevenue(parsed.data)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
