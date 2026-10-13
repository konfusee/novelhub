import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../auth/password.js';
import { hashPassword } from '../auth/password.js';
import { digestEmailToken, issueEmailToken } from '../auth/email-tokens.js';
import {
  cookieOptions,
  digestToken,
  issueSession,
  publicUser,
  readCookie,
} from '../auth/session.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { Account } from '../models/identity/account.model.js';
import { Session } from '../models/identity/session.model.js';
import { EmailToken } from '../models/identity/email-token.model.js';
import { withTransaction } from '../db/connection.js';
import {
  createDevelopmentEmailDelivery,
  sendWithRetry,
  unavailableEmailDelivery,
} from '../email/delivery.js';

const credentialsSchema = z
  .object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(1024),
  })
  .strict();
const registrationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(10).max(1024),
    acceptedTerms: z.literal(true),
    accountType: z.enum(['reader', 'author']).default('reader'),
  })
  .strict();
const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
const emailSchema = z
  .object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) })
  .strict();
const resetPasswordSchema = z
  .object({ token: z.string().min(32).max(256), password: z.string().min(10).max(1024) })
  .strict();
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function checkRateLimit(req, _res, next) {
  const key = req.ip;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  current.count += 1;
  if (current.count > MAX_ATTEMPTS) {
    return next(
      new HttpError(429, 'too_many_attempts', 'Too many login attempts. Try again later.'),
    );
  }
  next();
}

export function createAuthRouter(config) {
  const router = Router();
  const options = cookieOptions(config);
  const authenticate = requireAuth({ cookieName: config.cookieName });
  const emailDelivery =
    config.emailDelivery ??
    (config.nodeEnv === 'production'
      ? unavailableEmailDelivery()
      : createDevelopmentEmailDelivery({ logger: config.logger }));

  async function deliverToken({ email, token, purpose }) {
    const path = purpose === 'email-verification' ? '/verify-email' : '/reset-password';
    const actionUrl = `${config.frontendUrl}${path}?token=${encodeURIComponent(token)}`;
    return sendWithRetry(emailDelivery, {
      to: email,
      subject: purpose === 'email-verification' ? 'Verify your NovelHub email' : 'Reset your NovelHub password',
      actionUrl,
    });
  }

  router.post('/auth/register', async (req, res, next) => {
    try {
      const parsed = registrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new HttpError(400, 'validation_error', 'Registration details are invalid'));
      }
      const { displayName, email, password } = parsed.data;
      const passwordHash = await hashPassword(password);
      const result = await withTransaction(async (session) => {
        if (await Account.exists({ normalizedEmail: email }).session(session)) {
          throw new HttpError(409, 'email_in_use', 'An account with this email already exists');
        }
        const [account] = await Account.create(
          [
            {
              displayName,
              email,
              status: 'pending-verification',
              password: { hash: passwordHash, algorithm: 'scrypt', updatedAt: new Date() },
            },
          ],
          { session },
        );
        const token = await issueEmailToken({
          accountId: account._id,
          purpose: 'email-verification',
          ttlMinutes: config.emailVerificationTtlMinutes,
          session,
        });
        return { account, token };
      });
      let emailDelivered = true;
      try {
        await deliverToken({ email, token: result.token, purpose: 'email-verification' });
      } catch (error) {
        emailDelivered = false;
        config.logger?.error({ err: error, accountId: result.account._id }, 'verification email failed');
      }
      res.status(201).json({
        account: { id: result.account._id.toString(), email, status: result.account.status },
        emailDelivered,
        authorApplicationRequired: parsed.data.accountType === 'author',
      });
    } catch (error) {
      if (error?.code === 11000) {
        return next(new HttpError(409, 'email_in_use', 'An account with this email already exists'));
      }
      next(error);
    }
  });

  router.post('/auth/verify-email', async (req, res, next) => {
    try {
      const parsed = tokenSchema.safeParse(req.body);
      if (!parsed.success) return next(new HttpError(400, 'validation_error', 'Token is required'));
      const account = await withTransaction(async (session) => {
        const usedAt = new Date();
        const emailToken = await EmailToken.findOneAndUpdate(
          {
            tokenHash: digestEmailToken(parsed.data.token),
            purpose: 'email-verification',
            usedAt: null,
            revokedAt: null,
            expiresAt: { $gt: usedAt },
          },
          { $set: { usedAt } },
          { returnDocument: 'after', session },
        );
        if (!emailToken) throw new HttpError(400, 'invalid_token', 'Verification link is invalid or expired');
        const updated = await Account.findOneAndUpdate(
          { _id: emailToken.accountId, status: 'pending-verification', emailVerifiedAt: null },
          { $set: { status: 'active', emailVerifiedAt: usedAt } },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new HttpError(400, 'invalid_token', 'Verification link is invalid or expired');
        return updated;
      });
      res.json({ account: { id: account._id.toString(), email: account.email, status: account.status } });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/resend-verification', async (req, res, next) => {
    try {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) return next(new HttpError(400, 'validation_error', 'Valid email is required'));
      const account = await Account.findOne({ normalizedEmail: parsed.data.email, status: 'pending-verification' });
      if (account) {
        const token = await withTransaction((session) =>
          issueEmailToken({
            accountId: account._id,
            purpose: 'email-verification',
            ttlMinutes: config.emailVerificationTtlMinutes,
            session,
          }),
        );
        await deliverToken({ email: account.email, token, purpose: 'email-verification' });
      }
      res.json({ message: 'If the account is awaiting verification, a new email has been sent.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/forgot-password', async (req, res, next) => {
    try {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) return next(new HttpError(400, 'validation_error', 'Valid email is required'));
      const account = await Account.findOne({
        normalizedEmail: parsed.data.email,
        status: 'active',
        emailVerifiedAt: { $ne: null },
        password: { $exists: true },
      });
      if (account) {
        const token = await withTransaction((session) =>
          issueEmailToken({
            accountId: account._id,
            purpose: 'password-reset',
            ttlMinutes: config.passwordResetTtlMinutes,
            session,
          }),
        );
        try {
          await deliverToken({ email: account.email, token, purpose: 'password-reset' });
        } catch (error) {
          config.logger?.error({ err: error, accountId: account._id }, 'password reset email failed');
        }
      }
      res.json({ message: 'If an eligible account exists, password reset instructions have been sent.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/reset-password', async (req, res, next) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) return next(new HttpError(400, 'validation_error', 'Token and a valid password are required'));
      const passwordHash = await hashPassword(parsed.data.password);
      await withTransaction(async (session) => {
        const usedAt = new Date();
        const emailToken = await EmailToken.findOneAndUpdate(
          {
            tokenHash: digestEmailToken(parsed.data.token),
            purpose: 'password-reset',
            usedAt: null,
            revokedAt: null,
            expiresAt: { $gt: usedAt },
          },
          { $set: { usedAt } },
          { returnDocument: 'after', session },
        );
        if (!emailToken) throw new HttpError(400, 'invalid_token', 'Reset link is invalid or expired');
        const account = await Account.findOneAndUpdate(
          { _id: emailToken.accountId, status: 'active', emailVerifiedAt: { $ne: null } },
          {
            $set: {
              password: { hash: passwordHash, algorithm: 'scrypt', updatedAt: usedAt },
            },
            $inc: { credentialVersion: 1 },
          },
          { returnDocument: 'after', session },
        );
        if (!account) throw new HttpError(400, 'invalid_token', 'Reset link is invalid or expired');
        await Promise.all([
          Session.updateMany(
            { accountId: account._id, status: 'active' },
            { $set: { status: 'revoked', revokedAt: usedAt } },
            { session },
          ),
          EmailToken.updateMany(
            {
              accountId: account._id,
              purpose: 'password-reset',
              usedAt: null,
              revokedAt: null,
            },
            { $set: { revokedAt: usedAt } },
            { session },
          ),
        ]);
      });
      res.json({ message: 'Password has been reset. Sign in with the new password.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/login', checkRateLimit, async (req, res, next) => {
    try {
      const parsed = credentialsSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new HttpError(400, 'validation_error', 'Valid email and password are required'),
        );
      }
      const account = await Account.findOne({ normalizedEmail: parsed.data.email }).select(
        '+password',
      );
      const valid =
        account?.status === 'active' &&
        account.emailVerifiedAt &&
        account.password?.hash &&
        (await verifyPassword(parsed.data.password, account.password.hash));
      if (!valid) {
        return next(new HttpError(401, 'invalid_credentials', 'Email or password is invalid'));
      }
      const { token } = await issueSession(account, config.sessionTtlDays);
      attempts.delete(req.ip);
      res.cookie(config.cookieName, token, options).json({ user: await publicUser(account) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/auth/me', authenticate, async (req, res, next) => {
    try {
      res.json({ user: await publicUser(req.auth.account) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/logout', async (req, res, next) => {
    try {
      const token = readCookie(req.headers.cookie, config.cookieName);
      if (token) {
        await Session.updateOne(
          { tokenHash: digestToken(token), status: 'active' },
          { $set: { status: 'revoked', revokedAt: new Date() } },
        );
      }
      const clearOptions = { ...options };
      delete clearOptions.maxAge;
      res.clearCookie(config.cookieName, clearOptions).status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
