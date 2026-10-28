import { timingSafeEqual } from 'node:crypto'
import { HttpError } from './errors.js'

export function requireSePayApiKey(config) {
  return (req, _res, next) => {
    const key = config.sePayWebhookApiKey

    if (!key) {
      return next(new HttpError(503, 'webhook_disabled', 'Webhook chưa được cấu hình.'))
    }

    const expected = Buffer.from(`Apikey ${key}`)
    const received = Buffer.from(req.get('authorization') ?? '')

    const valid = received.length === expected.length && timingSafeEqual(received, expected)

    if (!valid) {
      return next(new HttpError(401, 'invalid_webhook_key', 'Khóa webhook không hợp lệ.'))
    }

    next()
  }
}
