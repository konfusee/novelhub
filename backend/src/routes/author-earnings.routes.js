import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getAuthorEarnings } from '../modules/author-earnings.js'

export function createAuthorEarningsRouter(config) {
  const router = Router()

  router.get(
    '/author/earnings',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const result = await getAuthorEarnings(req.account._id)

        res.set('Cache-Control', 'private, no-store').json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
