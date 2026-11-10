import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import {
  changeFormerStory,
  formerStoryDetail,
  formerStoryInput,
  formerStoryList,
} from '../modules/accounts-administration/admin/admin-former-author-stories.js'
export function createAdminFormerAuthorRouter(config) {
  const router = Router()
  router.use('/admin/former-author-stories', requireAuth(config), requireRole('admin'))
  router.get('/admin/former-author-stories', async (req, res, next) => {
    try {
      const parsed = z
        .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
        .strict()
        .safeParse(req.query)
      if (!parsed.success) throw new HttpError(400, 'validation_error', 'Phân trang không hợp lệ.')
      res.set('Cache-Control', 'private, no-store').json(await formerStoryList(parsed.data.page))
    } catch (error) {
      next(error)
    }
  })
  router.param('id', (req, res, next, id) =>
    /^[a-f\d]{24}$/i.test(id)
      ? next()
      : next(new HttpError(400, 'validation_error', 'Mã truyện không hợp lệ.')),
  )
  router.get('/admin/former-author-stories/:id', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'private, no-store').json(await formerStoryDetail(req.params.id))
    } catch (error) {
      next(error)
    }
  })
  router.post('/admin/former-author-stories/:id', async (req, res, next) => {
    try {
      const parsed = formerStoryInput.safeParse(req.body)
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Thao tác, phiên bản và lý do không hợp lệ.')
      res
        .set('Cache-Control', 'private, no-store')
        .json(await changeFormerStory(req.account, req.params.id, parsed.data))
    } catch (error) {
      next(error)
    }
  })
  return router
}
