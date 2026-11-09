import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getTopUpPackages } from '../modules/coins-payouts/finance/reader-top-ups.js'
import { z } from 'zod'
import { HttpError } from '../middleware/errors.js'
import {
  createTopUpOrder,
  getReaderTopUpOrder,
} from '../modules/coins-payouts/finance/reader-top-up-orders.js'

export function createReaderTopUpsRouter(config) {
  const router = Router()

  router.get('/reader/top-up-packages', requireAuth(config), async (req, res, next) => {
    try {
      const result = await getTopUpPackages()

      res.set('Cache-Control', 'private, no-store').json(result)
    } catch (error) {
      next(error)
    }
  })

  router.post('/reader/top-up-orders', requireAuth(config), async (req, res, next) => {
    try {
      const input = z
        .object({
          packageId: z.string().regex(/^[a-f\d]{24}$/i),
        })
        .strict()
        .safeParse(req.body)

      if (!input.success) {
        throw new HttpError(400, 'validation_error', 'Mã gói nạp không hợp lệ.')
      }

      const bank = config.topUpBank

      if (!bank?.bin || !bank.name || !bank.accountNumber || !bank.accountName) {
        throw new HttpError(
          503,
          'payment_not_configured',
          'Hệ thống chưa cấu hình tài khoản nhận tiền.',
        )
      }

      const result = await createTopUpOrder(req.account, input.data.packageId)

      res
        .status(result.reused ? 200 : 201)
        .set('Cache-Control', 'private, no-store')
        .json({
          ...result,
          order: {
            ...result.order,
            payment: {
              bankBin: bank.bin,
              bankName: bank.name,
              accountNumber: bank.accountNumber,
              accountName: bank.accountName,
              amount: result.order.priceVnd,
              content: result.order.paymentCode,
            },
          },
        })
    } catch (error) {
      next(error)
    }
  })

  router.get('/reader/top-up-orders/:orderId', requireAuth(config), async (req, res, next) => {
    try {
      const { orderId } = req.params

      if (!/^[a-f\d]{24}$/i.test(orderId)) {
        throw new HttpError(400, 'validation_error', 'Mã định danh đơn không hợp lệ.')
      }

      const result = await getReaderTopUpOrder(req.account._id, orderId)

      res.set('Cache-Control', 'private, no-store').json(result)
    } catch (error) {
      next(error)
    }
  })

  return router
}
