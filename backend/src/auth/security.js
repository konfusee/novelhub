import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { Account } from '../models/identity/account.model.js'
import { EmailToken } from '../models/identity/email-token.model.js'
import { Session } from '../models/identity/session.model.js'
import { digestEmailToken } from './email-tokens.js'
import { hashPassword, verifyPassword } from './password.js'
import { issueSession, publicUser } from './session.js'
import { withTransaction } from '../db/connection.js'
import { sendWithRetry } from '../email/delivery.js'
import { HttpError } from '../middleware/errors.js'

const proofSchema = z.object({
  challenge: z.string().min(32).max(256),
  otp: z.string().regex(/^\d{6}$/),
})
const invalid = () =>
  new HttpError(400, 'invalid_otp', 'Code is invalid, expired or has too many attempts')
export function createSecurityService({ emailDelivery, securityConfig }) {
  const cooldowns = new Map()
  async function issue(account, purpose, rememberMe = false) {
    const now = Date.now()
    for (const [key, until] of cooldowns) if (until <= now) cooldowns.delete(key)
    const key = account._id + ':' + purpose
    if (cooldowns.has(key))
      throw new HttpError(429, 'too_many_attempts', 'Wait before requesting another code')
    cooldowns.set(key, now + securityConfig.resendSeconds * 1000)
    const challenge = randomBytes(32).toString('base64url')
    const otp = String(randomInt(0, 1000000)).padStart(6, '0')
    const record = await withTransaction(async session => {
      await EmailToken.updateMany(
        { accountId: account._id, purpose, usedAt: null, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session },
      )
      const [token] = await EmailToken.create(
        [
          {
            accountId: account._id,
            purpose,
            tokenHash: digestEmailToken(challenge),
            otpHash: digestEmailToken(challenge + ':' + otp),
            credentialVersion: account.credentialVersion,
            authorizationEpoch: account.authorizationEpoch,
            rememberMe,
            expiresAt: new Date(now + securityConfig.codeTtlMinutes * 60000),
          },
        ],
        { session },
      )
      return token
    })
    try {
      await sendWithRetry(
        emailDelivery,
        {
          to: account.email,
          subject: 'Mã xác minh bảo mật NovelHub',
          purpose,
          otp,
          expiresInMinutes: securityConfig.codeTtlMinutes,
        },
        { attempts: securityConfig.emailSendAttempts },
      )
    } catch {
      await EmailToken.updateOne({ _id: record._id }, { $set: { revokedAt: new Date() } })
      cooldowns.delete(key)
      throw new HttpError(
        503,
        'email_unavailable',
        'Cannot send verification email. Try again later',
      )
    }
    return { challenge, expiresInSeconds: securityConfig.codeTtlMinutes * 60 }
  }
  async function check(challenge, otp, purpose, accountId) {
    const candidate = await EmailToken.findOneAndUpdate(
      {
        tokenHash: digestEmailToken(challenge),
        purpose,
        ...(accountId ? { accountId } : {}),
        usedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: securityConfig.codeMaxAttempts },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    )
    const supplied = digestEmailToken(challenge + ':' + otp)
    if (
      !candidate?.otpHash ||
      !timingSafeEqual(Buffer.from(candidate.otpHash), Buffer.from(supplied))
    )
      throw invalid()
    return candidate
  }
  async function consume(candidate, session) {
    const used = await EmailToken.findOneAndUpdate(
      { _id: candidate._id, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { session, returnDocument: 'after' },
    )
    if (!used) throw invalid()
    const account = await Account.findOne({
      _id: used.accountId,
      status: 'active',
      credentialVersion: used.credentialVersion,
      authorizationEpoch: used.authorizationEpoch,
    }).session(session)
    if (!account) throw invalid()
    return account
  }
  return { issue, check, consume }
}

export function installSecurityRoutes(
  router,
  { service, authenticate, rateLimit, cookieName, options, sessionTtlDays },
) {
  async function respond(req, res, account, rememberMe = true) {
    const { token } = await issueSession(account, rememberMe ? sessionTtlDays : 1, {
      userAgent: req.get('user-agent'),
    })
    const cookie = { ...options }
    if (!rememberMe) delete cookie.maxAge
    return res.cookie(cookieName, token, cookie).json({ user: await publicUser(account) })
  }
  router.post('/auth/security/challenge', authenticate, rateLimit, async (req, res, next) => {
    try {
      const { action, currentPassword } = z
        .object({
          action: z.enum(['password', 'enable', 'disable']),
          currentPassword: z.string().max(1024).optional(),
        })
        .strict()
        .parse(req.body)
      const account = await Account.findById(req.auth.account._id).select('+password')
      if (
        account.password?.hash &&
        !(await verifyPassword(currentPassword || '', account.password.hash))
      )
        throw new HttpError(400, 'invalid_current_password', 'Current password is incorrect')
      if (
        (action === 'enable' && account.twoFactorEnabled) ||
        (action === 'disable' && !account.twoFactorEnabled)
      )
        throw new HttpError(
          409,
          'security_state_changed',
          'Security state has changed. Refresh and try again',
        )
      res.json(await service.issue(account, 'security-' + action))
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new HttpError(400, 'validation_error', 'Invalid security request')
          : error,
      )
    }
  })
  router.post('/auth/security/password', authenticate, rateLimit, async (req, res, next) => {
    try {
      const data = proofSchema
        .extend({
          password: z.string().min(10).max(1024),
          passwordConfirmation: z.string().min(10).max(1024),
        })
        .strict()
        .parse(req.body)
      if (data.password !== data.passwordConfirmation)
        throw new HttpError(400, 'password_mismatch', 'Passwords do not match')
      const candidate = await service.check(
        data.challenge,
        data.otp,
        'security-password',
        req.auth.account._id,
      )
      const hash = await hashPassword(data.password)
      const account = await withTransaction(async session => {
        const account = await service.consume(candidate, session)
        account.password = { hash, algorithm: 'scrypt', updatedAt: new Date() }
        account.credentialVersion += 1
        await account.save({ session })
        await Session.updateMany(
          { accountId: account._id, status: 'active' },
          { $set: { status: 'revoked', revokedAt: new Date() } },
          { session },
        )
        return account
      })
      await respond(req, res, account)
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new HttpError(400, 'validation_error', 'Invalid password or verification code')
          : error,
      )
    }
  })
  router.post('/auth/security/two-factor', authenticate, rateLimit, async (req, res, next) => {
    try {
      const data = proofSchema.extend({ enabled: z.boolean() }).strict().parse(req.body)
      const candidate = await service.check(
        data.challenge,
        data.otp,
        data.enabled ? 'security-enable' : 'security-disable',
        req.auth.account._id,
      )
      const account = await withTransaction(async session => {
        const account = await service.consume(candidate, session)
        account.twoFactorEnabled = data.enabled
        account.credentialVersion += 1
        await account.save({ session })
        await Session.updateMany(
          { accountId: account._id, status: 'active' },
          { $set: { status: 'revoked', revokedAt: new Date() } },
          { session },
        )
        return account
      })
      await respond(req, res, account)
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new HttpError(400, 'validation_error', 'Invalid verification code')
          : error,
      )
    }
  })
  router.post('/auth/two-factor/verify', rateLimit, async (req, res, next) => {
    try {
      const data = proofSchema.strict().parse(req.body)
      const candidate = await service.check(data.challenge, data.otp, 'security-login')
      const account = await withTransaction(async session => {
        const account = await service.consume(candidate, session)
        if (!account.twoFactorEnabled) throw invalid()
        return account
      })
      await respond(req, res, account, candidate.rememberMe)
    } catch (error) {
      next(error instanceof z.ZodError ? invalid() : error)
    }
  })
}
