import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { getAdminAuthorRevenue } from '../modules/admin-author-revenue.js'
import { getAuthorRevenueDetails } from '../modules/admin-author-revenue-details.js'

const querySchema = z
  .object({
    periodId: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    search: z.string().trim().max(100).default(''),
    activity: z.enum(['all', 'earning']).default('all'),
    sort: z.enum(['revenue', 'balance', 'name']).default('revenue'),
    export: z.literal('csv').optional(),
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

        const result = await getAdminAuthorRevenue({
          ...parsed.data,
          all: parsed.data.export === 'csv',
        })

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  router.get(
    '/admin/author-revenue/:accountId',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const params = z
          .string()
          .regex(/^[a-fA-F0-9]{24}$/)
          .safeParse(req.params.accountId)
        const query = querySchema.pick({ periodId: true, page: true }).safeParse(req.query)
        if (!params.success || !query.success)
          throw new HttpError(400, 'validation_error', 'Bộ lọc chi tiết doanh thu không hợp lệ.')
        const result = await getAuthorRevenueDetails(params.data, query.data)
        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )
  return router
}
