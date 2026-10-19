import { testConfig } from './config.js'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCaptchaStore } from '../src/auth/captcha.js'
import { createApp } from '../src/app.js'
import { hashPassword, verifyPassword } from '../src/auth/password.js'
import { digestToken } from '../src/auth/session.js'
import { Account } from '../src/models/identity/account.model.js'
import { ExternalIdentity } from '../src/models/identity/external-identity.model.js'
import { RoleAssignment } from '../src/models/identity/role-assignment.model.js'
import { Session } from '../src/models/identity/session.model.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const deliveredEmails = []
const createTestApp = () =>
  createApp({
    ...testConfig(),
    corsOrigin: 'http://localhost:5173',
    nodeEnv: 'test',
    captchaStore: createCaptchaStore({
      ...testConfig().securityConfig,
      generate: () => ({ text: 'ABC234', data: '<svg xmlns="http://www.w3.org/2000/svg" />' }),
    }),
    cookieName: 'novelhub_session',
    sessionTtlDays: 7,
    frontendUrl: 'http://localhost:5173',
    emailVerificationTtlMinutes: 60,
    passwordResetTtlMinutes: 30,
    emailDelivery: {
      async send(message) {
        deliveredEmails.push(message)
        return { accepted: true }
      },
    },
  })
const password = 'correct horse battery staple'
let app
let account

async function createAccount(overrides = {}) {
  return Account.create({
    displayName: 'Test Reader',
    email: 'reader@example.test',
    status: 'active',
    emailVerifiedAt: new Date(),
    password: {
      hash: await hashPassword(password),
      algorithm: 'scrypt',
      updatedAt: new Date(),
    },
    ...overrides,
  })
}

beforeEach(async () => {
  app = createTestApp()
  deliveredEmails.length = 0
  account = await createAccount()
})

async function captchaCredentials() {
  const response = await request(app).get('/api/auth/captcha')
  const answer = 'ABC234'
  return { captchaToken: response.body.token, captchaAnswer: answer }
}
function registrationRequest() {
  return {
    async send(payload) {
      return request(app)
        .post('/api/auth/register')
        .send({
          passwordConfirmation: payload.password,
          ...(await captchaCredentials()),
          ...payload,
        })
    },
  }
}

describe('email registration and verification', () => {
  const registration = {
    displayName: 'New Reader',
    email: 'new-reader@example.test',
    password: 'a secure password',
    acceptedTerms: true,
    accountType: 'reader',
  }

  it('requires a valid single-use CAPTCHA and matching confirmation', async () => {
    expect((await request(app).post('/api/auth/register').send(registration)).status).toBe(400)
    const captcha = await captchaCredentials()
    const payload = { ...registration, passwordConfirmation: registration.password, ...captcha }
    const wrong = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, captchaAnswer: '!!!!!!' })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.code).toBe('invalid_captcha')
    expect((await request(app).post('/api/auth/register').send(payload)).body.error.code).toBe(
      'invalid_captcha',
    )
    expect(
      (
        await registrationRequest().send({
          ...registration,
          passwordConfirmation: 'another password',
        })
      ).body.error.code,
    ).toBe('password_mismatch')
    expect(await Account.countDocuments({ normalizedEmail: registration.email })).toBe(0)
  })

  it('creates a pending Reader with a hash and sends a verification link', async () => {
    const response = await registrationRequest().send(registration)
    expect(response.status).toBe(201)
    expect(response.body.account).toMatchObject({
      email: registration.email,
      status: 'pending-verification',
    })
    const created = await Account.findOne({ normalizedEmail: registration.email }).select(
      '+password',
    )
    expect(created.password.hash).not.toBe(registration.password)
    await expect(verifyPassword(registration.password, created.password.hash)).resolves.toBe(true)
    await expect(
      (await import('../src/auth/session.js')).publicUser(created),
    ).resolves.toMatchObject({ roles: ['reader'] })
    expect(deliveredEmails).toHaveLength(1)
    expect(deliveredEmails[0].actionUrl).toContain('/verify-email?token=')
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: registration.email, password: registration.password })
      ).status,
    ).toBe(401)
  })

  it('verifies once, activates the account, and permits login', async () => {
    await registrationRequest().send(registration)
    const token = new URL(deliveredEmails[0].actionUrl).searchParams.get('token')
    const verified = await request(app).post('/api/auth/verify-email').send({ token })
    expect(verified.status).toBe(200)
    expect(verified.body.account.status).toBe('active')
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400)
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: registration.email, password: registration.password })
      ).status,
    ).toBe(200)
  })

  it('rejects duplicates, invalid data, and privileged role injection', async () => {
    expect((await registrationRequest().send(registration)).status).toBe(201)
    expect((await registrationRequest().send(registration)).status).toBe(409)
    expect((await registrationRequest().send({ ...registration, password: 'short' })).status).toBe(
      400,
    )
    expect(
      (
        await registrationRequest().send({
          ...registration,
          email: 'x2@example.test',
          roles: ['admin'],
        })
      ).status,
    ).toBe(400)
  })

  it('revokes the older token when verification is resent', async () => {
    await registrationRequest().send(registration)
    const oldToken = new URL(deliveredEmails[0].actionUrl).searchParams.get('token')
    expect(
      (await request(app).post('/api/auth/resend-verification').send({ email: registration.email }))
        .status,
    ).toBe(200)
    const newToken = new URL(deliveredEmails[1].actionUrl).searchParams.get('token')
    expect(
      (await request(app).post('/api/auth/verify-email').send({ token: oldToken })).status,
    ).toBe(400)
    expect(
      (await request(app).post('/api/auth/verify-email').send({ token: newToken })).status,
    ).toBe(200)
  })
})

describe('password security', () => {
  it('hashes and verifies without storing plaintext', async () => {
    const encoded = await hashPassword(password)
    expect(encoded).not.toContain(password)
    await expect(verifyPassword(password, encoded)).resolves.toBe(true)
    await expect(verifyPassword('wrong password', encoded)).resolves.toBe(false)
  })
})

describe('session authentication API', () => {
  it('uses a browser-session cookie by default and a persistent cookie when remembered', async () => {
    const session = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password })
    expect(session.status).toBe(200)
    expect(session.headers['set-cookie'][0]).not.toMatch(/Max-Age|Expires/)
    const remembered = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password, rememberMe: true })
    expect(remembered.status).toBe(200)
    expect(remembered.headers['set-cookie'][0]).toContain('Max-Age=604800')
    const records = await Session.find({ accountId: account._id }).sort({ expiresAt: 1 })
    expect(records[1].expiresAt.getTime() - records[0].expiresAt.getTime()).toBeGreaterThan(
      5 * 24 * 60 * 60 * 1000,
    )
  })
  it('logs in, returns safe role data, restores the session, and logs out', async () => {
    await RoleAssignment.create({
      accountId: account._id,
      role: 'author',
      grantedBy: account._id,
    })
    const agent = request.agent(app)
    const login = await agent
      .post('/api/auth/login')
      .send({ email: ' READER@EXAMPLE.TEST ', password })
    expect(login.status).toBe(200)
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/)
    expect(login.headers['set-cookie'][0]).toMatch(/SameSite=Lax/)
    expect(login.body.user).toMatchObject({
      name: 'Test Reader',
      email: 'reader@example.test',
      roles: ['reader', 'author'],
    })
    expect(login.body.user).not.toHaveProperty('password')
    expect(await Session.countDocuments({ accountId: account._id })).toBe(1)

    const current = await agent.get('/api/auth/me')
    expect(current.status).toBe(200)
    expect(current.body.user.id).toBe(account._id.toString())

    expect(
      (await agent.post('/api/auth/logout').set('Origin', 'http://localhost:5173')).status,
    ).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(await Session.countDocuments({ accountId: account._id, status: 'revoked' })).toBe(1)
  })

  it.each([
    ['incorrect password', 'reader@example.test', 'incorrect'],
    ['unknown account', 'unknown@example.test', password],
  ])('returns the same response for %s', async (_case, email, suppliedPassword) => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: suppliedPassword })
    expect(response.status).toBe(401)
    expect(response.body.error).toMatchObject({
      code: 'invalid_credentials',
      message: 'Email or password is invalid',
    })
  })

  it.each([
    {},
    { email: 'not-an-email', password },
    { email: 'reader@example.test', password, unexpected: true },
  ])('rejects invalid payload %#', async payload => {
    const response = await request(app).post('/api/auth/login').send(payload)
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
  })

  it.each(['pending-verification', 'suspended', 'anonymized'])(
    'rejects an account with status %s',
    async status => {
      await Account.updateOne(
        { _id: account._id },
        { $set: { status }, ...(status === 'anonymized' ? { $unset: { email: 1 } } : {}) },
      )
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'reader@example.test', password })
      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('invalid_credentials')
    },
  )

  it('rejects missing, expired, and invalid sessions', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    await Session.create({
      accountId: account._id,
      tokenHash: digestToken('expired-token'),
      credentialVersion: account.credentialVersion,
      authorizationEpoch: account.authorizationEpoch,
      status: 'expired',
      expiresAt: new Date(Date.now() - 1000),
    })
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', 'novelhub_session=expired-token'))
        .status,
    ).toBe(401)
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', 'novelhub_session=made-up-token'))
        .status,
    ).toBe(401)
  })

  it('invalidates a session when credentials change', async () => {
    const agent = request.agent(app)
    expect(
      (await agent.post('/api/auth/login').send({ email: 'reader@example.test', password })).status,
    ).toBe(200)
    await Account.updateOne({ _id: account._id }, { $inc: { credentialVersion: 1 } })
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(await Session.countDocuments({ accountId: account._id, status: 'revoked' })).toBe(1)
  })
})

describe('password recovery', () => {
  it('returns a generic response for known and unknown emails', async () => {
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reader@example.test' })
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.test' })
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(known.body.message).toEqual(unknown.body.message)
    expect(known.body.challenge).toHaveLength(43)
    expect(unknown.body.challenge).toHaveLength(43)
    expect(known.body.expiresInSeconds).toBe(600)
    expect(deliveredEmails).toHaveLength(1)
    expect(deliveredEmails[0].otp).toMatch(/^\d{6}$/)
    expect(deliveredEmails[0].actionUrl).toBeUndefined()
  })

  it('resets once, revokes sessions, and accepts only the new password', async () => {
    const agent = request.agent(app)
    expect(
      (await agent.post('/api/auth/login').send({ email: 'reader@example.test', password })).status,
    ).toBe(200)
    const sent = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reader@example.test' })
    const verified = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ challenge: sent.body.challenge, otp: deliveredEmails[0].otp })
    expect(verified.status).toBe(200)
    const { token } = verified.body
    expect(
      (
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: sent.body.challenge, otp: deliveredEmails[0].otp })
      ).status,
    ).toBe(400)
    const nextPassword = 'a brand new secure password'
    expect(
      (await request(app).post('/api/auth/reset-password').send({ token, password: nextPassword }))
        .status,
    ).toBe(200)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(
      (await request(app).post('/api/auth/reset-password').send({ token, password })).status,
    ).toBe(400)
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'reader@example.test', password }))
        .status,
    ).toBe(401)
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'reader@example.test', password: nextPassword })
      ).status,
    ).toBe(200)
  })

  it('stores only hashed OTPs and prevents bypassing verification', async () => {
    const { EmailToken } = await import('../src/models/identity/email-token.model.js')
    const sent = await request(app).post('/api/auth/forgot-password').send({ email: account.email })
    const saved = await EmailToken.findOne({ purpose: 'password-reset-otp' }).lean()
    expect(saved.otpHash).not.toBe(deliveredEmails[0].otp)
    expect(saved.tokenHash).not.toBe(sent.body.challenge)
    expect(
      (
        await request(app)
          .post('/api/auth/reset-password')
          .send({ token: sent.body.challenge, password })
      ).status,
    ).toBe(400)
  })

  it('locks a challenge after five wrong attempts', async () => {
    const sent = await request(app).post('/api/auth/forgot-password').send({ email: account.email })
    const wrong = deliveredEmails[0].otp === '000000' ? '111111' : '000000'
    for (let index = 0; index < 5; index += 1) {
      expect(
        (
          await request(app)
            .post('/api/auth/verify-reset-otp')
            .send({ challenge: sent.body.challenge, otp: wrong })
        ).status,
      ).toBe(400)
    }
    expect(
      (
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: sent.body.challenge, otp: deliveredEmails[0].otp })
      ).status,
    ).toBe(400)
  })

  it('rejects expired OTPs and malformed codes', async () => {
    const { EmailToken } = await import('../src/models/identity/email-token.model.js')
    const sent = await request(app).post('/api/auth/forgot-password').send({ email: account.email })
    expect(
      (
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: sent.body.challenge, otp: '12345' })
      ).status,
    ).toBe(400)
    await EmailToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    expect(
      (
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: sent.body.challenge, otp: deliveredEmails[0].otp })
      ).status,
    ).toBe(400)
  })

  it('enforces resend cooldown for both known and unknown emails and revokes the older code', async () => {
    const first = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: account.email })
    const oldOtp = deliveredEmails[0].otp
    expect(
      (await request(app).post('/api/auth/forgot-password').send({ email: account.email })).status,
    ).toBe(429)
    await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.test' })
    expect(
      (await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.test' }))
        .status,
    ).toBe(429)
    const later = Date.now() + 61_000
    const clock = vi.spyOn(Date, 'now').mockReturnValue(later)
    let second
    try {
      second = await request(app).post('/api/auth/forgot-password').send({ email: account.email })
    } finally {
      clock.mockRestore()
    }
    expect(second.status).toBe(200)
    expect(
      (
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: first.body.challenge, otp: oldOtp })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: second.body.challenge, otp: deliveredEmails[1].otp })
      ).status,
    ).toBe(200)
  })

  it('allows only one concurrent OTP verification', async () => {
    const sent = await request(app).post('/api/auth/forgot-password').send({ email: account.email })
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ challenge: sent.body.challenge, otp: deliveredEmails[0].otp }),
      ),
    )
    expect(results.map(result => result.status).sort()).toEqual([200, 400])
  })

  it('rejects expired and malformed reset tokens', async () => {
    const { EmailToken } = await import('../src/models/identity/email-token.model.js')
    const { digestEmailToken } = await import('../src/auth/email-tokens.js')
    await EmailToken.create({
      accountId: account._id,
      purpose: 'password-reset',
      tokenHash: digestEmailToken('x'.repeat(32)),
      expiresAt: new Date(Date.now() - 1000),
    })
    expect(
      (
        await request(app)
          .post('/api/auth/reset-password')
          .send({ token: 'x'.repeat(32), password })
      ).status,
    ).toBe(400)
    expect(
      (await request(app).post('/api/auth/reset-password').send({ token: 'short', password }))
        .status,
    ).toBe(400)
  })
})

describe('author application authorization', () => {
  it('returns only the signed-in account application status', async () => {
    expect((await request(app).get('/api/auth/author-application')).status).toBe(401)
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: account.email, password })
    expect((await agent.get('/api/auth/author-application')).body.application).toBeNull()
    const other = await createAccount({ email: 'other@example.test' })
    const { AuthorApplication } = await import('../src/models/identity/author-application.model.js')
    await AuthorApplication.create({ applicantAccountId: other._id, status: 'submitted' })
    expect((await agent.get('/api/auth/author-application')).body.application).toBeNull()
    await agent.post('/api/auth/author-application').set('Origin', 'http://localhost:5173').send({})
    expect((await agent.get('/api/auth/author-application')).body.application.status).toBe(
      'submitted',
    )
  })

  it('requires authentication and never grants the Author role', async () => {
    expect((await request(app).post('/api/auth/author-application').send({})).status).toBe(401)
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'reader@example.test', password })
    const submitted = await agent
      .post('/api/auth/author-application')
      .set('Origin', 'http://localhost:5173')
      .send({})
    expect(submitted.status).toBe(201)
    expect(submitted.body.application.status).toBe('submitted')
    expect(
      (
        await agent
          .post('/api/auth/author-application')
          .set('Origin', 'http://localhost:5173')
          .send({})
      ).status,
    ).toBe(200)
    expect((await agent.get('/api/auth/me')).body.user.roles).toEqual(['reader'])
  })
})

describe('CSRF protection', () => {
  it('rejects authenticated mutations without an allowed Origin', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'reader@example.test', password })
    expect((await agent.post('/api/auth/logout')).status).toBe(403)
    expect(
      (await agent.post('/api/auth/logout').set('Origin', 'https://attacker.example')).status,
    ).toBe(403)
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    expect(
      (await agent.post('/api/auth/logout').set('Origin', 'http://localhost:5173')).status,
    ).toBe(204)
  })
})

describe('Google OAuth account registration and linking', () => {
  function googleApp(identity) {
    return createApp({
      ...testConfig(),
      corsOrigin: 'http://localhost:5173',
      nodeEnv: 'test',
      cookieName: 'novelhub_session',
      sessionTtlDays: 7,
      frontendUrl: 'http://localhost:5173',
      googleProvider: {
        authorizationUrl: ({ state }) => `https://accounts.example/authorize?state=${state}`,
        async exchange() {
          return identity
        },
      },
    })
  }

  async function completeGoogle(agent, mode = 'login') {
    const start = await agent.get('/api/auth/google/start').query({ mode })
    const state = new URL(start.headers.location).searchParams.get('state')
    return agent.get(`/api/auth/google/callback?code=test-code&state=${state}`)
  }

  it('reports availability without exposing credentials', async () => {
    expect((await request(app).get('/api/auth/google/status')).body).toEqual({ enabled: false })
    expect((await request(googleApp({})).get('/api/auth/google/status')).body).toEqual({
      enabled: true,
    })
  })

  it('returns cancellation to the login page and clears OAuth cookies', async () => {
    const agent = request.agent(googleApp({}))
    const start = await agent.get('/api/auth/google/start')
    const state = new URL(start.headers.location).searchParams.get('state')
    const result = await agent
      .get('/api/auth/google/callback')
      .query({ state, error: 'access_denied' })
    expect(result.status).toBe(302)
    expect(result.headers.location).toBe('http://localhost:5173/login?googleError=cancelled')
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(
      result.headers['set-cookie'].every(cookie => cookie.includes('Expires=Thu, 01 Jan 1970')),
    ).toBe(true)
  })

  it('creates a new passwordless Reader and authenticates returning identity', async () => {
    const appWithGoogle = googleApp({
      sub: 'google-new-subject',
      email: 'google-new@example.test',
      name: 'Google Reader',
    })
    const first = request.agent(appWithGoogle)
    expect((await completeGoogle(first)).status).toBe(302)
    expect((await first.get('/api/auth/me')).body.user.roles).toEqual(['reader'])
    const created = await Account.findOne({ normalizedEmail: 'google-new@example.test' }).select(
      '+password',
    )
    expect(created.password).toBeUndefined()
    const second = request.agent(appWithGoogle)
    expect((await completeGoogle(second)).status).toBe(302)
    expect(await Account.countDocuments({ normalizedEmail: 'google-new@example.test' })).toBe(1)
  })

  it('registers with Google without a session, then allows an explicit Google login', async () => {
    const agent = request.agent(
      googleApp({
        sub: 'register-only-subject',
        email: 'register-only@example.test',
        name: 'New Google Reader',
      }),
    )
    const result = await completeGoogle(agent, 'register')
    expect(result.headers.location).toBe('http://localhost:5173/login?registered=google')
    const created = await Account.findOne({ normalizedEmail: 'register-only@example.test' })
    expect(created.status).toBe('active')
    expect(await Session.countDocuments({ accountId: created._id })).toBe(0)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect((await completeGoogle(agent, 'register')).headers.location).toBe(
      'http://localhost:5173/login?registered=google',
    )
    expect(await Session.countDocuments({ accountId: created._id })).toBe(0)
    expect((await completeGoogle(agent)).headers.location).toBe(
      'http://localhost:5173/auth/google-complete',
    )
    expect((await agent.get('/api/auth/me')).body.user.roles).toEqual(['reader'])
  })

  it('recreates an account when its Google identity points to a deleted account', async () => {
    await ExternalIdentity.create({
      accountId: account._id,
      provider: 'google',
      providerSubject: 'orphan-subject',
    })
    await Account.deleteOne({ _id: account._id })
    const agent = request.agent(
      googleApp({ sub: 'orphan-subject', email: account.email, name: 'Returning Reader' }),
    )
    const result = await completeGoogle(agent)
    expect(result.headers.location).toBe('http://localhost:5173/auth/google-complete')
    expect((await agent.get('/api/auth/me')).body.user.roles).toEqual(['reader'])
    const replacement = await Account.findOne({ normalizedEmail: account.email })
    const link = await ExternalIdentity.findOne({ providerSubject: 'orphan-subject' })
    expect(link.accountId.equals(replacement._id)).toBe(true)
    expect(await ExternalIdentity.countDocuments({ providerSubject: 'orphan-subject' })).toBe(1)
  })

  it('keeps suspended Google accounts blocked', async () => {
    account.status = 'suspended'
    await account.save()
    await ExternalIdentity.create({
      accountId: account._id,
      provider: 'google',
      providerSubject: 'suspended-subject',
    })
    const agent = request.agent(
      googleApp({ sub: 'suspended-subject', email: account.email, name: 'Suspended Reader' }),
    )
    expect((await completeGoogle(agent)).headers.location).toBe(
      'http://localhost:5173/login?googleError=account_unavailable',
    )
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect((await Account.findById(account._id)).status).toBe('suspended')
  })

  it('links a verified matching email and preserves NovelHub roles', async () => {
    await RoleAssignment.create({ accountId: account._id, role: 'author', grantedBy: account._id })
    const agent = request.agent(
      googleApp({
        sub: 'google-link-subject',
        email: account.email,
        name: 'Ignored Provider Name',
      }),
    )
    expect((await completeGoogle(agent)).status).toBe(302)
    expect((await agent.get('/api/auth/me')).body.user.roles).toEqual(['reader', 'author'])
    expect(await Account.countDocuments({ normalizedEmail: account.normalizedEmail })).toBe(1)
  })

  it('rejects callback state tampering and missing configuration', async () => {
    const configured = request.agent(
      googleApp({ sub: 'subject', email: 'state@example.test', name: 'State Test' }),
    )
    await configured.get('/api/auth/google/start')
    expect((await configured.get('/api/auth/google/callback?code=x&state=tampered')).status).toBe(
      302,
    )
    expect((await request(app).get('/api/auth/google/start')).status).toBe(503)
  })
})

describe('Google identity claim validation', () => {
  it.each([
    ['bad structure', 'invalid'],
    [
      'issuer',
      `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k' })).toString('base64url')}.${Buffer.from(
        JSON.stringify({
          iss: 'attacker',
          aud: 'client',
          exp: Math.floor(Date.now() / 1000) + 60,
          sub: 's',
          email: 'e@x.test',
          email_verified: true,
        }),
      ).toString('base64url')}.signature`,
    ],
  ])('rejects invalid %s', async (_case, token) => {
    const { verifyGoogleIdToken } = await import('../src/auth/google-oidc.js')
    await expect(verifyGoogleIdToken(token, 'client')).rejects.toThrow()
  })
})
