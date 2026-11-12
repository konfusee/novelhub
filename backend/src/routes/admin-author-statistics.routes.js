import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { adminAuthorStatistics } from '../modules/accounts-administration/admin/admin-author-statistics.js'
import { adminDashboard } from '../modules/accounts-administration/admin/admin-dashboard.js'
export function createAdminAuthorStatisticsRouter(config) {
  const router = Router()
  router.get(
    '/admin/dashboard',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        res.set('Cache-Control', 'private, no-store').json(await adminDashboard())
      } catch (error) {
        next(error)
      }
    },
  )
  router.get(
    '/admin/author-statistics',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            period: z
              .union([z.literal('all'), z.string().regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/)])
              .default('all'),
            accountStatus: z
              .enum(['all', 'active', 'suspended', 'pending-verification', 'anonymized'])
              .default('all'),
          })
          .strict()
          .safeParse(req.query)
        if (!parsed.success)
          throw new HttpError(400, 'validation_error', 'Kỳ thống kê không hợp lệ.')
        res
          .set('Cache-Control', 'private, no-store')
          .json(await adminAuthorStatistics(parsed.data.period, parsed.data))
      } catch (error) {
        next(error)
      }
    },
  )
  return router
}
