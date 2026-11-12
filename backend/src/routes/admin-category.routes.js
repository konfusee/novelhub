import { Router } from 'express'
import { Category } from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export function createAdminCategoryRouter(config) {
  const router = Router()
  router.use('/admin/categories', requireAuth(config), requireRole('admin'))
  router.get('/admin/categories', async (_req, res, next) => {
    try {
      const items = await Category.find()
        .sort({ sortKey: 1, name: 1 })
        .select('name status version')
        .lean()
      res.json({
        items: items.map(item => ({
          id: String(item._id),
          name: item.name,
          status: item.status,
          version: item.version,
        })),
      })
    } catch (error) {
      next(error)
    }
  })
  return router
}
