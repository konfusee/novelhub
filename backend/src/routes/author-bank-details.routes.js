import { Router } from 'express'
import { bankDetailsSchema } from '../modules/coins-payouts/finance/bank-details.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  getAuthorBankDetails,
  updateAuthorBankDetails,
} from '../modules/coins-payouts/finance/author-bank-details.js'

export function createAuthorBankDetailsRouter(config) {
  const router = Router()

  router.get(
    '/author/bank-details',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const result = await getAuthorBankDetails(req.account._id)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  router.put(
    '/author/bank-details',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const parsed = bankDetailsSchema.safeParse(req.body)

        if (!parsed.success) {
          throw new HttpError(
            400,
            'validation_error',
            'Vui lòng nhập đầy đủ thông tin ngân hàng hợp lệ.',
          )
        }

        const result = await updateAuthorBankDetails(req, parsed.data)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
