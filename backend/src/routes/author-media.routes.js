import { Router, raw } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  uploadAuthorMedia,
  readAuthorMedia,
  MEDIA_UPLOAD_BYTES,
} from '../modules/authoring-publishing/author/author-media.js'
const oid = z.string().regex(/^[a-f\d]{24}$/iu)
function parse(schema, input) {
  const result = schema.safeParse(input)
  if (!result.success) throw new HttpError(400, 'validation_error', 'Thông tin ảnh không hợp lệ.')
  return result.data
}
export function createAuthorMediaRouter(config) {
  const router = Router()
  router.use('/author/media', requireAuth(config), requireRole('author'))
  router.post(
    '/author/media',
    raw({ type: 'application/octet-stream', limit: MEDIA_UPLOAD_BYTES }),
    async (req, res, next) => {
      try {
        const input = parse(
          z
            .object({
              name: z
                .string()
                .trim()
                .min(1)
                .max(180)
                .refine(value => value.isWellFormed()),
              kind: z.enum(['image', 'cover', 'banner']).default('image'),
              storyId: oid.optional(),
            })
            .strict(),
          req.query,
        )
        res
          .status(201)
          .json({ asset: await uploadAuthorMedia(config, req.account, input, req.body) })
      } catch (error) {
        next(error)
      }
    },
  )
  router.get('/author/media/:id/content', async (req, res, next) => {
    try {
      const bytes = await readAuthorMedia(config, req.account._id, parse(oid, req.params.id))
      res
        .set({
          'Content-Type': 'image/webp',
          'Content-Disposition': 'inline; filename="image.webp"',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          Vary: 'Cookie',
        })
        .send(bytes)
    } catch (error) {
      next(error)
    }
  })
  return router
}
