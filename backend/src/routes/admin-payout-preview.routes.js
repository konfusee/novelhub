import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { getMonthlyPayoutPreview } from '../modules/admin-payout-preview.js'

const previewSchema = z
  .object({
    periodId: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  })
  .strict()

export function createAdminPayoutPreviewRouter(config) {
  const router = Router()

  router.get(
    '/admin/monthly-payouts/preview',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = previewSchema.safeParse(req.query)

        if (!parsed.success) {
          throw new HttpError(400, 'validation_error', 'Kỳ xem trước chi trả không hợp lệ.')
        }

        const result = await getMonthlyPayoutPreview(parsed.data.periodId)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
