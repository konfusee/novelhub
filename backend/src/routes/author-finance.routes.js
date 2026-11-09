import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  authorFinanceController,
  updateAuthorPaymentDetailsController,
} from '../controllers/author/finance.controller.js'

export function createAuthorFinanceRouter(config) {
  const router = Router()
  router.use('/author/earnings', requireAuth(config), requireRole('author'))
  router.get('/author/earnings', authorFinanceController())
  router.put('/author/earnings/payment-details', updateAuthorPaymentDetailsController())
  return router
}
