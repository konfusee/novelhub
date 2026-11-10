import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  getReaderUnlockQuote,
  purchaseReaderChapter,
} from '../modules/coins-payouts/finance/reader-unlocks.js'

const paramsSchema = z.object({
  storyId: z.string().regex(/^[a-f\d]{24}$/i),
  chapterId: z.string().regex(/^[a-f\d]{24}$/i),
})

const purchaseSchema = z
  .object({
    expectedPriceCoins: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    expectedRevisionId: z.string().regex(/^[a-f\d]{24}$/i),
    requestKey: z.string().uuid(),
  })
  .strict()

export function createReaderUnlocksRouter(config) {
  const router = Router()

  router.get(
    '/reader/stories/:storyId/chapters/:chapterId/unlock-quote',
    requireAuth(config),
    async (req, res, next) => {
      try {
        const input = paramsSchema.safeParse(req.params)

        if (!input.success) {
          throw new HttpError(400, 'validation_error', 'Mã truyện hoặc chương không hợp lệ.')
        }

        const { storyId, chapterId } = input.data

        const result = await getReaderUnlockQuote(req.account._id, storyId, chapterId)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  router.post(
    '/reader/stories/:storyId/chapters/:chapterId/unlock',
    requireAuth(config),
    async (req, res, next) => {
      try {
        const params = paramsSchema.safeParse(req.params)
        const body = purchaseSchema.safeParse(req.body)

        if (!params.success || !body.success) {
          throw new HttpError(400, 'validation_error', 'Thông tin mua quyền đọc không hợp lệ.')
        }

        const result = await purchaseReaderChapter(
          req,
          params.data.storyId,
          params.data.chapterId,
          body.data,
        )

        res
          .status(result.reused ? 200 : 201)
          .set('Cache-Control', 'private, no-store')
          .json(result)
      } catch (error) {
        next(error)
      }
    },
  )
  return router
}
