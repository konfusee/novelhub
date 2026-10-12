import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../auth/password.js';
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

const credentialsSchema = z
  .object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(1024),
  })
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
