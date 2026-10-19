import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account } from '../src/models/identity/account.model.js'
import { EmailToken } from '../src/models/identity/email-token.model.js'
import { hashPassword, verifyPassword } from '../src/auth/password.js'
import { useTestDatabase } from './db.js'
import { testConfig } from './config.js'
useTestDatabase()
const origin = 'http://localhost:5173'
const password = 'correct password 123'
const newPassword = 'new secure password 456'
let app, account, agent, emails
const post = (agent, path, data) =>
  agent
    .post('/api/auth/' + path)
    .set('Origin', origin)
    .send(data)
async function challenge(action) {
  const result = await post(agent, 'security/challenge', { action, currentPassword: password })
  expect(result.status).toBe(200)
  return { challenge: result.body.challenge, otp: emails.at(-1).otp }
}
beforeEach(async () => {
  emails = []
  account = await Account.create({
    displayName: 'Security Reader',
    email: 'security@example.test',
    status: 'active',
    emailVerifiedAt: new Date(),
    password: { hash: await hashPassword(password), algorithm: 'scrypt', updatedAt: new Date() },
  })
  app = createApp(
    testConfig({
      emailDelivery: {
        async send(message) {
          emails.push(message)
        },
      },
      googleProvider: {
        authorizationUrl: ({ state }) => 'https://accounts.example/?state=' + state,
        async exchange() {
          return { sub: 'security-google', email: account.email, name: account.displayName }
        },
      },
    }),
  )
  agent = request.agent(app)
  expect((await post(agent, 'login', { email: account.email, password })).status).toBe(200)
})
describe('account security', () => {
  it('changes password only after proof, revokes old sessions, and keeps this session', async () => {
    const other = request.agent(app)
    await post(other, 'login', { email: account.email, password })
    const proof = await challenge('password')
    expect(
      (
        await post(agent, 'security/password', {
          ...proof,
          password: newPassword,
          passwordConfirmation: newPassword,
        })
      ).status,
    ).toBe(200)
    expect((await agent.get('/api/auth/me')).body.user.hasPassword).toBe(true)
    expect((await other.get('/api/auth/me')).status).toBe(401)
    const saved = await Account.findById(account._id).select('+password')
    expect(await verifyPassword(newPassword, saved.password.hash)).toBe(true)
    expect(await verifyPassword(password, saved.password.hash)).toBe(false)
    expect(
      (
        await post(agent, 'security/password', {
          ...proof,
          password: newPassword,
          passwordConfirmation: newPassword,
        })
      ).status,
    ).toBe(400)
  })
  it('rejects wrong current password without sending email', async () => {
    const res = await post(agent, 'security/challenge', {
      action: 'password',
      currentPassword: 'wrong',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_current_password')
    expect(emails).toHaveLength(0)
  })
  it('lets a Google-only account create a password after email proof', async () => {
    await Account.updateOne({ _id: account._id }, { $unset: { password: 1 } })
    const res = await post(agent, 'security/challenge', { action: 'password' })
    expect(res.status).toBe(200)
    expect(
      (
        await post(agent, 'security/password', {
          challenge: res.body.challenge,
          otp: emails.at(-1).otp,
          password: newPassword,
          passwordConfirmation: newPassword,
        })
      ).status,
    ).toBe(200)
  })
  it('enforces email second step before issuing password-login session and rejects replay', async () => {
    expect(
      (await post(agent, 'security/two-factor', { ...(await challenge('enable')), enabled: true }))
        .body.user.twoFactorEnabled,
    ).toBe(true)
    const fresh = request.agent(app)
    const login = await post(fresh, 'login', { email: account.email, password })
    expect(login.body.requiresTwoFactor).toBe(true)
    expect(login.headers['set-cookie']).toBeUndefined()
    expect((await fresh.get('/api/auth/me')).status).toBe(401)
    const proof = { challenge: login.body.challenge, otp: emails.at(-1).otp }
    const verified = await post(fresh, 'two-factor/verify', proof)
    expect(verified.status).toBe(200)
    expect(verified.headers['set-cookie'][0]).not.toContain('Max-Age')
    expect((await fresh.get('/api/auth/me')).status).toBe(200)
    expect((await post(fresh, 'two-factor/verify', proof)).status).toBe(400)
  })
  it('enforces second step for Google login too', async () => {
    await post(agent, 'security/two-factor', { ...(await challenge('enable')), enabled: true })
    const fresh = request.agent(app)
    const start = await fresh.get('/api/auth/google/start')
    const state = new URL(start.headers.location).searchParams.get('state')
    const callback = await fresh.get('/api/auth/google/callback').query({ state, code: 'code' })
    const target = new URL(callback.headers.location)
    expect(target.pathname).toBe('/login')
    expect((await fresh.get('/api/auth/me')).status).toBe(401)
    expect(
      (
        await post(fresh, 'two-factor/verify', {
          challenge: target.searchParams.get('googleChallenge'),
          otp: emails.at(-1).otp,
        })
      ).status,
    ).toBe(200)
  })
  it('disables the second step only with a new disable proof', async () => {
    await post(agent, 'security/two-factor', { ...(await challenge('enable')), enabled: true })
    const proof = await challenge('disable')
    expect((await post(agent, 'security/two-factor', { ...proof, enabled: true })).status).toBe(400)
    expect(
      (await post(agent, 'security/two-factor', { ...proof, enabled: false })).body.user
        .twoFactorEnabled,
    ).toBe(false)
    expect(
      (await post(request.agent(app), 'login', { email: account.email, password })).body.user,
    ).toBeTruthy()
  })
  it('locks an OTP after five guesses, even when the sixth answer is correct', async () => {
    const proof = await challenge('enable')
    const wrong = proof.otp === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++)
      expect(
        (await post(agent, 'security/two-factor', { ...proof, otp: wrong, enabled: true })).status,
      ).toBe(400)
    expect((await post(agent, 'security/two-factor', { ...proof, enabled: true })).status).toBe(400)
    expect((await Account.findById(account._id)).twoFactorEnabled).toBe(false)
  })
  it('rejects expired proof and limits code resend', async () => {
    const proof = await challenge('enable')
    expect(
      (await post(agent, 'security/challenge', { action: 'enable', currentPassword: password }))
        .status,
    ).toBe(429)
    await EmailToken.updateMany({ accountId: account._id }, { $set: { expiresAt: new Date(0) } })
    expect((await post(agent, 'security/two-factor', { ...proof, enabled: true })).status).toBe(400)
  })
  it('requires authentication for security changes', async () => {
    expect((await post(request(app), 'security/challenge', { action: 'enable' })).status).toBe(401)
  })
})
