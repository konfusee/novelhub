import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getReaderWallet } from '../modules/reader-wallet.js'

export function createReaderWalletRouter(config) {
  const router = Router()

  router.get('/reader/wallet', requireAuth(config), async (req, res, next) => {
    try {
      const result = await getReaderWallet(req.account._id)

      res.set('Cache-Control', 'private, no-store').json(result)
    } catch (error) {
      next(error)
    }
  })

  return router
}
