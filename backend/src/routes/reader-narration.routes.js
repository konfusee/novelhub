import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  narrationCallback,
  narrationFile,
  narrationStatus,
  requestNarration,
} from '../modules/reading-community/narration/narration.js'
import { createTtsProvider } from '../modules/reading-community/narration/tts-provider.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const callbackBody = z.object({ request_id: z.string().trim().min(1).max(200) }).passthrough()

export function createReaderNarrationRouter(config) {
  const router = Router()
  const provider = createTtsProvider(config)
  const target = req => ({
    config,
    provider,
    account: req.account,
    storyId: req.params.storyId,
    chapterId: req.params.chapterId,
  })
  router.use('/reader/narration', requireAuth(config))
  for (const name of ['storyId', 'chapterId'])
    router.param(name, (_req, _res, next, value) =>
      next(
        id.safeParse(value).success
          ? undefined
          : new HttpError(400, 'validation_error', 'ID không hợp lệ.'),
      ),
    )

  router.get('/reader/narration/:storyId/:chapterId', async (req, res, next) => {
    try {
      res.json({ narration: await narrationStatus(target(req)) })
    } catch (error) {
      next(error)
    }
  })
  router.post('/reader/narration/:storyId/:chapterId', async (req, res, next) => {
    try {
      const narration = await requestNarration(target(req))
      res.status(narration.status === 'processing' ? 202 : 200).json({ narration })
    } catch (error) {
      next(error)
    }
  })
  router.get('/reader/narration/:storyId/:chapterId/audio', async (req, res, next) => {
    try {
      const file = await narrationFile(target(req))
      res.sendFile(
        file,
        { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-cache' } },
        error =>
          error &&
          !res.headersSent &&
          next(new HttpError(404, 'narration_unavailable', 'Âm thanh chưa sẵn sàng.')),
      )
    } catch (error) {
      next(error)
    }
  })
  // Vbee webhook. Its body is untrusted; it only triggers a poll with our own credentials.
  router.post('/tts/vbee/callback', async (req, res, next) => {
    try {
      const parsed = callbackBody.safeParse(req.body)
      if (parsed.success)
        await narrationCallback({ config, provider, requestId: parsed.data.request_id })
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  return router
}
