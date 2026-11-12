import { MonthlyPayoutRun } from '../models/index.js'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { listMonthlyPayouts } from '../modules/coins-payouts/finance/admin-payout-list.js'
import { getPayoutDetails } from '../modules/coins-payouts/finance/payout-details.js'

import { correctPayoutBank } from '../modules/coins-payouts/finance/payout-bank-correction.js'
import { bankDetailsSchema } from '../modules/coins-payouts/finance/bank-details.js'

const listSchema = z
  .object({
    periodId: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    status: z.enum(['pending', 'paid']).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    search: z.string().trim().max(100).default(''),
    latestResult: z.literal('Failed').optional(),
    export: z.literal('csv').optional(),
  })
  .strict()

export function createAdminMonthlyPayoutsRouter(config) {
  const router = Router()
  router.put(
    '/admin/monthly-payouts/:withdrawalId/payment-details',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            expectedVersion: z.number().int().min(0),
            reason: z.string().trim().min(1).max(1000),
            bankDetails: bankDetailsSchema,
          })
          .strict()
          .safeParse(req.body)
        if (!parsed.success || !/^[a-fA-F0-9]{24}$/.test(req.params.withdrawalId))
          throw new HttpError(400, 'validation_error', 'Thông tin sửa ngân hàng không hợp lệ.')
        res
          .set('Cache-Control', 'private, no-store')
          .json(await correctPayoutBank(req.account, req.params.withdrawalId, parsed.data))
      } catch (error) {
        next(error)
      }
    },
  )
  router.get(
    '/admin/monthly-payouts/:withdrawalId/history',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const input = z
          .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
          .strict()
          .safeParse(req.query)
        if (!input.success || !/^[a-fA-F0-9]{24}$/.test(req.params.withdrawalId))
          throw new HttpError(400, 'validation_error', 'Trang kết quả không hợp lệ.')
        res
          .set('Cache-Control', 'private, no-store')
          .json(await getPayoutDetails(req.params.withdrawalId, input.data))
      } catch (error) {
        next(error)
      }
    },
  )

  // Payout execution belongs exclusively to the system worker.
  router.post(
    [
      '/admin/monthly-payouts/generate',
      '/admin/monthly-payouts/:withdrawalId/result',
      '/admin/monthly-payouts/:withdrawalId/simulate-result',
    ],
    requireAuth(config),
    requireRole('admin'),
    (_req, _res, next) =>
      next(
        new HttpError(
          405,
          'payouts_read_only',
          'Chi trả do hệ thống tự động xử lý. Admin chỉ có quyền xem.',
        ),
      ),
  )
  router.get(
    '/admin/monthly-payouts/runs',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const query = z
          .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
          .strict()
          .safeParse(req.query)
        if (!query.success)
          throw new HttpError(400, 'validation_error', 'Trang kỳ chi trả không hợp lệ.')
        const rows = await MonthlyPayoutRun.find()
          .sort({ periodId: -1 })
          .skip((query.data.page - 1) * 12)
          .limit(13)
          .lean()
        res.set('Cache-Control', 'private, no-store').json({
          items: rows
            .slice(0, 12)
            .map(
              ({
                _id,
                periodId,
                cutoffAt,
                status,
                executionMode,
                totalCount,
                paidCount,
                pendingCount,
                totalCoins,
                lastEvaluatedAt,
              }) => ({
                id: String(_id),
                periodId,
                cutoffAt,
                status,
                executionMode,
                totalCount,
                paidCount,
                pendingCount,
                totalCoins,
                lastEvaluatedAt,
              }),
            ),
          hasMore: rows.length > 12,
        })
      } catch (error) {
        next(error)
      }
    },
  )

  router.get(
    '/admin/monthly-payouts',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = listSchema.safeParse(req.query)

        if (!parsed.success) {
          throw new HttpError(400, 'validation_error', 'Bộ lọc danh sách chi trả không hợp lệ.')
        }

        const result = await listMonthlyPayouts({
          ...parsed.data,
          all: parsed.data.export === 'csv',
        })

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
