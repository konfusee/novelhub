import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { getReaderUnlockQuote } from '../modules/reader-unlocks.js'

const paramsSchema = z.object({
  storyId: z.string().regex(/^[a-f\d]{24}$/i),
  chapterId: z.string().regex(/^[a-f\d]{24}$/i),
})

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

  return router
}
