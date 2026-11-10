import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  authorFinanceController,
  updateAuthorPaymentDetailsController,
} from '../controllers/author/finance.controller.js'

export function createAuthorFinanceRouter(config) {
  const router = Router()
  router.use(['/author/earnings', '/author/finance'], requireAuth(config), requireRole('author'))
  // Keep /author/earnings as the stable wallet API; the combined finance view has its own URL.
  router.get('/author/finance', authorFinanceController())
  router.put('/author/earnings/payment-details', updateAuthorPaymentDetailsController())
  return router
}
