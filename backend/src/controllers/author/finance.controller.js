import { z } from 'zod'
import { HttpError } from '../../middleware/errors.js'
import { authorFinance, updateAuthorPaymentDetails } from '../../services/author/finance.service.js'

const paymentDetails = z
  .object({
    bankName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().min(4).max(40),
    accountHolder: z.string().trim().min(2).max(120),
  })
  .strict()

export function authorFinanceController() {
  return async (req, res, next) => {
    try {
      res.set('Cache-Control', 'private, no-store').json(await authorFinance(req.account._id))
    } catch (error) {
      next(error)
    }
  }
}

export function updateAuthorPaymentDetailsController() {
  return async (req, res, next) => {
    try {
      const parsed = paymentDetails.safeParse(req.body)
      if (!parsed.success)
        throw new HttpError(
          400,
          'validation_error',
          'Thông tin tài khoản nhận thanh toán không hợp lệ.',
        )
      res.json(await updateAuthorPaymentDetails(req, parsed.data))
    } catch (error) {
      next(error)
    }
  }
}
