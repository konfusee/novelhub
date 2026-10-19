import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { issueSession } from '../src/auth/session.js'
import { hashPassword } from '../src/auth/password.js'
import { Account } from '../src/models/identity/account.model.js'
import { Session } from '../src/models/identity/session.model.js'
import { testConfig } from './config.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(
  testConfig({ cookieName: 'novelhub_session', corsOrigin: 'http://localhost:5173' }),
)
const base = '/api/auth/sessions'
const cookie = token => `novelhub_session=${token}`

describe('account sessions', () => {
  it('lists only valid own sessions, marks current and never exposes token hashes', async () => {
    const user = await authenticatedAccount()
    await authenticatedAccount()
    const other = await issueSession(user.account, 1, {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1',
    })
    await Session.create({
      accountId: user.account._id,
      tokenHash: 'expired-token-hash',
      credentialVersion: 0,
      authorizationEpoch: 0,
      expiresAt: new Date(0),
    })
    await Session.create({
      accountId: user.account._id,
      tokenHash: 'stale-token-hash',
      credentialVersion: 5,
      authorizationEpoch: 0,
      expiresAt: new Date(Date.now() + 60000),
    })
    const result = await request(app).get(base).set('Cookie', user.cookie)
    expect(result.status).toBe(200)
    expect(result.body.items).toHaveLength(2)
    expect(result.body.items[0].current).toBe(true)
    expect(result.body.items[1]).toMatchObject({
      current: false,
      client: { os: 'iPhone', browser: 'Safari', deviceType: 'mobile' },
    })
    expect(JSON.stringify(result.body)).not.toMatch(
      /tokenHash|accountId|credentialVersion|providerSessionReference/,
    )
    expect(JSON.stringify(result.body)).not.toContain(other.token)
  })

  it('revokes other real sessions while keeping current and other users signed in', async () => {
    const user = await authenticatedAccount()
    const otherUser = await authenticatedAccount()
    const second = await issueSession(user.account, 1)
    const revoked = await request(app)
      .post(`${base}/revoke-others`)
      .set('Cookie', user.cookie)
      .set('Origin', 'http://localhost:5173')
      .send({})
    expect(revoked.status).toBe(200)
    expect(revoked.body.revokedCount).toBe(1)
    expect((await request(app).get('/api/auth/me').set('Cookie', user.cookie)).status).toBe(200)
    expect((await request(app).get('/api/auth/me').set('Cookie', otherUser.cookie)).status).toBe(
      200,
    )
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', cookie(second.token))).status,
    ).toBe(401)
    expect(
      (
        await request(app)
          .post(`${base}/revoke-others`)
          .set('Cookie', user.cookie)
          .set('Origin', 'http://localhost:5173')
          .send({})
      ).body.revokedCount,
    ).toBe(0)
  })

  it('requires authentication and same-origin protection', async () => {
    expect((await request(app).get(base)).status).toBe(401)
    const user = await authenticatedAccount()
    expect(
      (await request(app).post(`${base}/revoke-others`).set('Cookie', user.cookie).send({})).status,
    ).toBe(403)
  })

  it('records sanitized browser/device labels on password login', async () => {
    const user = await authenticatedAccount()
    await Account.updateOne(
      { _id: user.account._id },
      {
        $set: {
          password: {
            hash: await hashPassword('SessionTest-2026!'),
            algorithm: 'scrypt',
            updatedAt: new Date(),
          },
        },
      },
    )
    const agent = request.agent(app)
    const login = await agent
      .post('/api/auth/login')
      .set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36 Edg/130.0',
      )
      .send({ email: user.account.email, password: 'SessionTest-2026!' })
    expect(login.status).toBe(200)
    const result = await agent.get(base)
    expect(result.body.items[0]).toMatchObject({
      current: true,
      client: { os: 'Windows', browser: 'Edge', deviceType: 'desktop' },
    })
    expect(JSON.stringify(result.body)).not.toContain('Mozilla')
  })

  it('updates activity for older sessions without inventing a device for legacy sessions', async () => {
    const user = await authenticatedAccount()
    await Session.updateMany(
      { accountId: user.account._id },
      { $set: { lastSeenAt: new Date(0) }, $unset: { client: 1 } },
    )
    const result = await request(app).get(base).set('Cookie', user.cookie)
    expect(result.body.items[0].client).toBeNull()
    expect(new Date(result.body.items[0].lastSeenAt).getTime()).toBeGreaterThan(Date.now() - 10000)
  })
})
