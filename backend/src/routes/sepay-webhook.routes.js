import { Router } from 'express'
import { requireSePayApiKey } from '../middleware/sepay-auth.js'
import { parseSePayPayload, processSePayWebhook } from '../modules/sepay-webhook.js'

export function createSePayWebhookRouter(config) {
  const router = Router()

  router.post('/webhooks/sepay', requireSePayApiKey(config), async (req, res, next) => {
    try {
      const payload = parseSePayPayload(req.body)

      await processSePayWebhook(payload, config)

      res.status(200).json({ success: true })
    } catch (error) {
      next(error)
    }
  })

  return router
}
