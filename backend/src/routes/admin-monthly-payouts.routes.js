import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { generateMonthlyPayouts } from '../modules/admin-monthly-payouts.js'
import { recordSimulatedPayoutResult } from '../modules/admin-payout-results.js'
import { listMonthlyPayouts } from '../modules/admin-payout-list.js'

const generateSchema = z
  .object({
    periodId: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

const payoutParamsSchema = z
  .object({
    withdrawalId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  })
  .strict()

const payoutResultSchema = z
  .object({
    resultEntryKey: z.string().uuid(),
    result: z.enum(['Paid', 'Failed']),
    note: z.string().trim().max(500).optional(),
  })
  .strict()

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

  router.post(
    '/admin/monthly-payouts/generate',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = generateSchema.safeParse(req.body)

        if (!parsed.success) {
          throw new HttpError(400, 'validation_error', 'Kỳ chi trả không hợp lệ.')
        }

        const result = await generateMonthlyPayouts(
          req.account,
          parsed.data.periodId,
          new Date(),
          parsed.data.previewHash,
        )

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  router.post(
    '/admin/monthly-payouts/:withdrawalId/simulate-result',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const params = payoutParamsSchema.safeParse(req.params)
        const body = payoutResultSchema.safeParse(req.body)

        if (!params.success || !body.success) {
          throw new HttpError(400, 'validation_error', 'Dữ liệu kết quả chi trả không hợp lệ.')
        }

        const result = await recordSimulatedPayoutResult(
          req.account,
          params.data.withdrawalId,
          body.data,
        )

        res.set('Cache-Control', 'private, no-store').json(result)
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
