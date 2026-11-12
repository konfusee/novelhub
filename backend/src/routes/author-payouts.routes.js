import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { getAuthorPayouts } from '../modules/coins-payouts/finance/author-payouts.js'
import { getPayoutDetails } from '../modules/coins-payouts/finance/payout-details.js'

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict()

export function createAuthorPayoutsRouter(config) {
  const router = Router()
  router.get(
    '/author/payouts/:withdrawalId/history',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const input = querySchema.safeParse(req.query)
        if (!input.success || !/^[a-fA-F0-9]{24}$/.test(req.params.withdrawalId))
          throw new HttpError(400, 'validation_error', 'Trang kết quả không hợp lệ.')
        res
          .set('Cache-Control', 'private, no-store')
          .json(
            await getPayoutDetails(req.params.withdrawalId, {
              ...input.data,
              accountId: req.account._id,
            }),
          )
      } catch (error) {
        next(error)
      }
    },
  )

  router.get(
    '/author/payouts',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const parsed = querySchema.safeParse(req.query)

        if (!parsed.success) {
          throw new HttpError(400, 'validation_error', 'Bộ lọc lịch sử chi trả không hợp lệ.')
        }

        const result = await getAuthorPayouts(req.account._id, parsed.data.page)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
