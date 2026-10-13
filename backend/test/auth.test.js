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
const deliveredEmails = [];
const app = createApp({
  corsOrigin: 'http://localhost:5173',
  nodeEnv: 'test',
  cookieName: 'novelhub_session',
  sessionTtlDays: 7,
  frontendUrl: 'http://localhost:5173',
  emailVerificationTtlMinutes: 60,
  passwordResetTtlMinutes: 30,
  emailDelivery: {
    async send(message) {
      deliveredEmails.push(message);
      return { accepted: true };
    },
  },
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
  deliveredEmails.length = 0;
  account = await createAccount();
});

describe('email registration and verification', () => {
  const registration = {
    displayName: 'New Reader',
    email: 'new-reader@example.test',
    password: 'a secure password',
    acceptedTerms: true,
    accountType: 'reader',
  };

  it('creates a pending Reader with a hash and sends a verification link', async () => {
    const response = await request(app).post('/api/auth/register').send(registration);
    expect(response.status).toBe(201);
    expect(response.body.account).toMatchObject({
      email: registration.email,
      status: 'pending-verification',
    });
    const created = await Account.findOne({ normalizedEmail: registration.email }).select('+password');
    expect(created.password.hash).not.toBe(registration.password);
    await expect(verifyPassword(registration.password, created.password.hash)).resolves.toBe(true);
    await expect(
      (await import('../src/auth/session.js')).publicUser(created),
    ).resolves.toMatchObject({ roles: ['reader'] });
    expect(deliveredEmails).toHaveLength(1);
    expect(deliveredEmails[0].actionUrl).toContain('/verify-email?token=');
    expect(
      (await request(app).post('/api/auth/login').send({ email: registration.email, password: registration.password })).status,
    ).toBe(401);
  });

  it('verifies once, activates the account, and permits login', async () => {
    await request(app).post('/api/auth/register').send(registration);
    const token = new URL(deliveredEmails[0].actionUrl).searchParams.get('token');
    const verified = await request(app).post('/api/auth/verify-email').send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.account.status).toBe('active');
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
    expect(
      (await request(app).post('/api/auth/login').send({ email: registration.email, password: registration.password })).status,
    ).toBe(200);
  });

  it('rejects duplicates, invalid data, and privileged role injection', async () => {
    expect((await request(app).post('/api/auth/register').send(registration)).status).toBe(201);
    expect((await request(app).post('/api/auth/register').send(registration)).status).toBe(409);
    expect(
      (await request(app).post('/api/auth/register').send({ ...registration, password: 'short' })).status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/auth/register').send({ ...registration, email: 'x2@example.test', roles: ['admin'] })).status,
    ).toBe(400);
  });

  it('revokes the older token when verification is resent', async () => {
    await request(app).post('/api/auth/register').send(registration);
    const oldToken = new URL(deliveredEmails[0].actionUrl).searchParams.get('token');
    expect(
      (await request(app).post('/api/auth/resend-verification').send({ email: registration.email })).status,
    ).toBe(200);
    const newToken = new URL(deliveredEmails[1].actionUrl).searchParams.get('token');
    expect((await request(app).post('/api/auth/verify-email').send({ token: oldToken })).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-email').send({ token: newToken })).status).toBe(200);
  });
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

describe('password recovery', () => {
  it('returns a generic response for known and unknown emails', async () => {
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reader@example.test' });
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.test' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(deliveredEmails).toHaveLength(1);
    expect(deliveredEmails[0].actionUrl).toContain('/reset-password?token=');
  });

  it('resets once, revokes sessions, and accepts only the new password', async () => {
    const agent = request.agent(app);
    expect(
      (await agent.post('/api/auth/login').send({ email: 'reader@example.test', password })).status,
    ).toBe(200);
    await request(app).post('/api/auth/forgot-password').send({ email: 'reader@example.test' });
    const token = new URL(deliveredEmails[0].actionUrl).searchParams.get('token');
    const nextPassword = 'a brand new secure password';
    expect(
      (await request(app).post('/api/auth/reset-password').send({ token, password: nextPassword })).status,
    ).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password })).status).toBe(400);
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'reader@example.test', password })).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'reader@example.test', password: nextPassword })).status,
    ).toBe(200);
  });

  it('rejects expired and malformed reset tokens', async () => {
    const { EmailToken } = await import('../src/models/identity/email-token.model.js');
    const { digestEmailToken } = await import('../src/auth/email-tokens.js');
    await EmailToken.create({
      accountId: account._id,
      purpose: 'password-reset',
      tokenHash: digestEmailToken('x'.repeat(32)),
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(
      (await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(32), password })).status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/auth/reset-password').send({ token: 'short', password })).status,
    ).toBe(400);
  });
});
