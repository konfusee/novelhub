import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { getReaderWallet } from '../modules/coins-payouts/finance/reader-wallet.js'

export function createReaderWalletRouter(config) {
  const router = Router()

  router.get('/reader/wallet', requireAuth(config), async (req, res, next) => {
    try {
      const input = z
        .object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
          type: z.enum(['all', 'added', 'unlock', 'other']).default('all'),
        })
        .strict()
        .safeParse(req.query)
      if (!input.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc lịch sử ví không hợp lệ.')
      const result = await getReaderWallet(req.account._id, input.data)

      res.set('Cache-Control', 'private, no-store').json(result)
    } catch (error) {
      next(error)
    }
  })

  return router
}
