import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { digestToken } from '../src/auth/session.js';
import { Account } from '../src/models/identity/account.model.js';
import { RoleAssignment } from '../src/models/identity/role-assignment.model.js';
import { Session } from '../src/models/identity/session.model.js';
import { useTestDatabase } from './db.js';

useTestDatabase();
const app = createApp({
  corsOrigin: 'http://localhost:5173',
  nodeEnv: 'test',
  cookieName: 'novelhub_session',
  sessionTtlDays: 7,
});
const password = 'correct horse battery staple';
let account;

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
  });
}

beforeEach(async () => {
  account = await createAccount();
});

describe('password security', () => {
  it('hashes and verifies without storing plaintext', async () => {
    const encoded = await hashPassword(password);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', encoded)).resolves.toBe(false);
  });
});

describe('session authentication API', () => {
  it('logs in, returns safe role data, restores the session, and logs out', async () => {
    await RoleAssignment.create({
      accountId: account._id,
      role: 'author',
      grantedBy: account._id,
    });
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: ' READER@EXAMPLE.TEST ', password });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(login.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    expect(login.body.user).toMatchObject({
      name: 'Test Reader',
      email: 'reader@example.test',
      roles: ['reader', 'author'],
    });
    expect(login.body.user).not.toHaveProperty('password');
    expect(await Session.countDocuments({ accountId: account._id })).toBe(1);

    const current = await agent.get('/api/auth/me');
    expect(current.status).toBe(200);
    expect(current.body.user.id).toBe(account._id.toString());

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await Session.countDocuments({ accountId: account._id, status: 'revoked' })).toBe(1);
  });

  it.each([
    ['incorrect password', 'reader@example.test', 'incorrect'],
    ['unknown account', 'unknown@example.test', password],
  ])('returns the same response for %s', async (_case, email, suppliedPassword) => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: suppliedPassword });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'invalid_credentials',
      message: 'Email or password is invalid',
    });
  });

  it.each([
    {},
    { email: 'not-an-email', password },
    { email: 'reader@example.test', password, unexpected: true },
  ])('rejects invalid payload %#', async (payload) => {
    const response = await request(app).post('/api/auth/login').send(payload);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it.each(['pending-verification', 'suspended', 'anonymized'])(
    'rejects an account with status %s',
    async (status) => {
      await Account.updateOne(
        { _id: account._id },
        { $set: { status }, ...(status === 'anonymized' ? { $unset: { email: 1 } } : {}) },
      );
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'reader@example.test', password });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('invalid_credentials');
    },
  );

  it('rejects missing, expired, and invalid sessions', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    await Session.create({
      accountId: account._id,
      tokenHash: digestToken('expired-token'),
      credentialVersion: account.credentialVersion,
      authorizationEpoch: account.authorizationEpoch,
      status: 'expired',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(
      (
        await request(app)
          .get('/api/auth/me')
          .set('Cookie', 'novelhub_session=expired-token')
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/auth/me')
          .set('Cookie', 'novelhub_session=made-up-token')
      ).status,
    ).toBe(401);
  });

  it('invalidates a session when credentials change', async () => {
    const agent = request.agent(app);
    expect(
      (await agent.post('/api/auth/login').send({ email: 'reader@example.test', password })).status,
    ).toBe(200);
    await Account.updateOne({ _id: account._id }, { $inc: { credentialVersion: 1 } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await Session.countDocuments({ accountId: account._id, status: 'revoked' })).toBe(1);
  });
});
