import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { Session } from '../models/identity/session.model.js'

export function createSessionRouter(config) {
  const router = Router()
  router.use('/auth/sessions', requireAuth(config))
  router.get('/auth/sessions', async (req, res, next) => {
    try {
      const filter = {
        accountId: req.account._id,
        credentialVersion: req.account.credentialVersion,
        authorizationEpoch: req.account.authorizationEpoch,
        status: 'active',
        expiresAt: { $gt: new Date() },
      }
      const sessions = await Session.find(filter).sort({ lastSeenAt: -1, _id: -1 }).lean()
      const items = sessions
        .map(session => ({
          id: session._id.toString(),
          current: session._id.equals(req.auth.session._id),
          client: session.client ?? null,
          issuedAt: session.issuedAt,
          lastSeenAt: session.lastSeenAt ?? session.issuedAt,
          expiresAt: session.expiresAt,
        }))
        .sort((a, b) => Number(b.current) - Number(a.current))
      res.json({ items })
    } catch (error) {
      next(error)
    }
  })
  router.post('/auth/sessions/revoke-others', async (req, res, next) => {
    try {
      const result = await Session.updateMany(
        {
          accountId: req.account._id,
          _id: { $ne: req.auth.session._id },
          credentialVersion: req.account.credentialVersion,
          authorizationEpoch: req.account.authorizationEpoch,
          status: 'active',
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: 'revoked', revokedAt: new Date() } },
      )
      res.json({ revokedCount: result.modifiedCount })
    } catch (error) {
      next(error)
    }
  })
  return router
}
