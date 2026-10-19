import { createSecurityService, installSecurityRoutes } from '../auth/security.js';
import { createCaptchaStore } from '../auth/captcha.js';
import { Router } from 'express';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
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
import { AuthorApplication } from '../models/identity/author-application.model.js';
import { RoleAssignment } from '../models/identity/role-assignment.model.js';
import { ExternalIdentity } from '../models/identity/external-identity.model.js';
import { withTransaction } from '../db/connection.js';
import {
  createDevelopmentEmailDelivery,
  sendWithRetry,
  unavailableEmailDelivery,
} from '../email/delivery.js';
import { createGoogleProvider } from '../auth/google-oidc.js';
import { applicationView, submitApplication } from '../modules/author-access/service.js';

const credentialsSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(1024),
    rememberMe: z.boolean().default(false),
  })
  .strict();
const registrationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(10).max(1024),
    passwordConfirmation: z.string().min(10).max(1024),
    captchaToken: z.string().min(32).max(256),
    captchaAnswer: z.string().trim().length(6),
    acceptedTerms: z.literal(true),
    accountType: z.enum(['reader', 'author']).default('reader'),
  })
  .strict();
const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
const emailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
  })
  .strict();
const resetPasswordSchema = z
  .object({ token: z.string().min(32).max(256), password: z.string().min(10).max(1024) })
  .strict();
const otpSchema = z
  .object({
    challenge: z.string().min(32).max(256),
    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();
export function createAuthRouter(config) {
  const router = Router();
  const attempts = new Map();
  const WINDOW_MS = config.securityConfig.windowMs;
  const MAX_ATTEMPTS = config.securityConfig.loginMaxAttempts;

  function checkRateLimit(req, _res, next) {
    const key = req.ip;
    const now = Date.now();
    for (const [ip, value] of attempts) if (value.resetAt <= now) attempts.delete(ip);
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

  const captchaStore = config.captchaStore ?? createCaptchaStore(config.securityConfig);
  const recoveryRequests = new Map();
  const recoveryIps = new Map();
  const otpTtlMinutes = Math.min(
    config.passwordResetTtlMinutes,
    config.securityConfig.codeTtlMinutes,
  );
  function recoveryRateLimit(req, _res, next) {
    const now = Date.now();
    for (const [key, value] of recoveryIps) {
      if (value.resetAt <= now) recoveryIps.delete(key);
    }
    const current = recoveryIps.get(req.ip) || { count: 0, resetAt: now + WINDOW_MS };
    current.count += 1;
    recoveryIps.set(req.ip, current);
    if (current.count > config.securityConfig.recoveryMaxAttempts)
      return next(
        new HttpError(429, 'too_many_attempts', 'Too many recovery attempts. Try again later.'),
      );
    next();
  }
  const options = cookieOptions(config);
  const authenticate = requireAuth({ cookieName: config.cookieName });
  const emailDelivery =
    config.emailDelivery ??
    (config.nodeEnv === 'production'
      ? unavailableEmailDelivery()
      : createDevelopmentEmailDelivery({ logger: config.logger }));
  const deliver = (message) =>
    sendWithRetry(emailDelivery, message, { attempts: config.securityConfig.emailSendAttempts });
  const googleProvider =
    config.googleProvider ?? (config.google ? createGoogleProvider(config.google) : null);
  const security = createSecurityService({
    securityConfig: config.securityConfig,
    emailDelivery,
    sessionTtlDays: config.sessionTtlDays,
    options,
  });
  installSecurityRoutes(router, {
    service: security,
    authenticate,
    rateLimit: recoveryRateLimit,
    cookieName: config.cookieName,
    options,
    sessionTtlDays: config.sessionTtlDays,
  });
  const oauthCookieOptions = {
    ...options,
    maxAge: config.securityConfig.oauthTtlMinutes * 60 * 1000,
  };

  async function deliverToken({ email, token, purpose }) {
    const path = purpose === 'email-verification' ? '/verify-email' : '/reset-password';
    const actionUrl = `${config.frontendUrl}${path}?token=${encodeURIComponent(token)}`;
    return deliver({
      to: email,
      subject:
        purpose === 'email-verification'
          ? 'Verify your NovelHub email'
          : 'Reset your NovelHub password',
      actionUrl,
    });
  }

  router.get('/auth/captcha', (req, res, next) => {
    const challenge = captchaStore.issue(req.ip);
    if (!challenge)
      return next(
        new HttpError(
          429,
          'captcha_rate_limit',
          'Too many verification requests. Try again in a minute.',
        ),
      );
    res.set('Cache-Control', 'no-store').json(challenge);
  });

  router.post('/auth/register', async (req, res, next) => {
    try {
      const parsed = registrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new HttpError(400, 'validation_error', 'Registration details are invalid'));
      }
      const { displayName, email, password, passwordConfirmation, captchaToken, captchaAnswer } =
        parsed.data;
      if (password !== passwordConfirmation)
        return next(new HttpError(400, 'password_mismatch', 'Passwords do not match'));
      if (!captchaStore.consume(captchaToken, captchaAnswer))
        return next(
          new HttpError(400, 'invalid_captcha', 'Verification code is invalid or expired'),
        );
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
        config.logger?.error(
          { err: error, accountId: result.account._id },
          'verification email failed',
        );
      }
      res.status(201).json({
        account: { id: result.account._id.toString(), email, status: result.account.status },
        emailDelivered,
        authorApplicationRequired: parsed.data.accountType === 'author',
      });
    } catch (error) {
      if (error?.code === 11000) {
        return next(
          new HttpError(409, 'email_in_use', 'An account with this email already exists'),
        );
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
        if (!emailToken)
          throw new HttpError(400, 'invalid_token', 'Verification link is invalid or expired');
        const updated = await Account.findOneAndUpdate(
          { _id: emailToken.accountId, status: 'pending-verification', emailVerifiedAt: null },
          { $set: { status: 'active', emailVerifiedAt: usedAt } },
          { returnDocument: 'after', session },
        );
        if (!updated)
          throw new HttpError(400, 'invalid_token', 'Verification link is invalid or expired');
        return updated;
      });
      res.json({
        account: { id: account._id.toString(), email: account.email, status: account.status },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/resend-verification', async (req, res, next) => {
    try {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success)
        return next(new HttpError(400, 'validation_error', 'Valid email is required'));
      const account = await Account.findOne({
        normalizedEmail: parsed.data.email,
        status: 'pending-verification',
      });
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

  router.post('/auth/forgot-password', recoveryRateLimit, async (req, res, next) => {
    try {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success)
        return next(new HttpError(400, 'validation_error', 'Valid email is required'));
      const now = Date.now();
      for (const [key, until] of recoveryRequests) {
        if (until <= now) recoveryRequests.delete(key);
      }
      const email = parsed.data.email;
      if (recoveryRequests.has(email)) {
        return next(
          new HttpError(429, 'otp_cooldown', 'Please wait before requesting another code'),
        );
      }
      recoveryRequests.set(email, now + config.securityConfig.resendSeconds * 1000);
      const challenge = randomBytes(32).toString('base64url');
      const account = await Account.findOne({
        normalizedEmail: email,
        status: 'active',
        emailVerifiedAt: { $ne: null },
        password: { $exists: true },
      });
      if (account) {
        const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
        await withTransaction(async (session) => {
          await EmailToken.updateMany(
            {
              accountId: account._id,
              purpose: { $in: ['password-reset-otp', 'password-reset'] },
              usedAt: null,
              revokedAt: null,
            },
            { $set: { revokedAt: new Date(now) } },
            { session },
          );
          await EmailToken.create(
            [
              {
                accountId: account._id,
                purpose: 'password-reset-otp',
                tokenHash: digestEmailToken(challenge),
                otpHash: digestEmailToken(challenge + ':' + otp),
                expiresAt: new Date(now + otpTtlMinutes * 60_000),
              },
            ],
            { session },
          );
        });
        try {
          await deliver({
            to: account.email,
            subject: 'Mã OTP đặt lại mật khẩu NovelHub',
            purpose: 'password-reset',
            otp,
            expiresInMinutes: otpTtlMinutes,
          });
        } catch (error) {
          config.logger?.error(
            { err: error, accountId: account._id },
            'password reset email failed',
          );
        }
      }
      res.json({
        message: 'If an eligible account exists, a password reset code has been sent.',
        challenge,
        expiresInSeconds: otpTtlMinutes * 60,
        retryAfterSeconds: config.securityConfig.resendSeconds,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/verify-reset-otp', recoveryRateLimit, async (req, res, next) => {
    try {
      const parsed = otpSchema.safeParse(req.body);
      if (!parsed.success)
        return next(
          new HttpError(400, 'validation_error', 'A six-digit code and challenge are required'),
        );
      const { challenge, otp } = parsed.data;
      // Count attempts atomically outside the transaction so failed attempts cannot roll back.
      const candidate = await EmailToken.findOneAndUpdate(
        {
          tokenHash: digestEmailToken(challenge),
          purpose: 'password-reset-otp',
          usedAt: null,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: config.securityConfig.codeMaxAttempts },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      );
      const supplied = digestEmailToken(challenge + ':' + otp);
      if (
        !candidate?.otpHash ||
        !timingSafeEqual(Buffer.from(candidate.otpHash), Buffer.from(supplied))
      ) {
        return next(
          new HttpError(400, 'invalid_otp', 'Code is invalid, expired or has too many attempts'),
        );
      }
      const token = await withTransaction(async (session) => {
        const consumed = await EmailToken.findOneAndUpdate(
          {
            _id: candidate._id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
          },
          { $set: { usedAt: new Date() } },
          { returnDocument: 'after', session },
        );
        if (!consumed) throw new HttpError(400, 'invalid_otp', 'Code is invalid or expired');
        return issueEmailToken({
          accountId: consumed.accountId,
          purpose: 'password-reset',
          ttlMinutes: config.securityConfig.codeTtlMinutes,
          session,
        });
      });
      res.json({ token });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/reset-password', async (req, res, next) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success)
        return next(
          new HttpError(400, 'validation_error', 'Token and a valid password are required'),
        );
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
        if (!emailToken)
          throw new HttpError(400, 'invalid_token', 'Reset link is invalid or expired');
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

  router.get('/auth/author-application', authenticate, async (req, res, next) => {
    try {
      const application = await AuthorApplication.findOne({
        applicantAccountId: req.auth.account._id,
      }).sort({ submittedAt: -1, _id: -1 });
      const roles = await RoleAssignment.find({ accountId: req.account._id, status: 'active' })
        .select('role')
        .lean();
      res.json({
        application: applicationView(application),
        access: {
          activeAuthor: roles.some((assignment) => assignment.role === 'author'),
          canApply: !roles.length && Boolean(req.account.emailVerifiedAt && req.account.email),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/author-application', authenticate, async (req, res, next) => {
    try {
      const { application, created } = await submitApplication(req.account);
      res.status(created ? 201 : 200).json({ application });
    } catch (error) {
      next(error);
    }
  });

  router.get('/auth/google/status', (_req, res) => {
    res.json({ enabled: Boolean(googleProvider) });
  });

  router.get('/auth/google/start', (req, res, next) => {
    if (!googleProvider)
      return next(new HttpError(503, 'google_unavailable', 'Google sign-in is not configured'));
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res
      .cookie('novelhub_oauth_state', state, oauthCookieOptions)
      .cookie('novelhub_oauth_verifier', verifier, oauthCookieOptions)
      .cookie(
        'novelhub_oauth_mode',
        req.query.mode === 'register' ? 'register' : 'login',
        oauthCookieOptions,
      )
      .redirect(googleProvider.authorizationUrl({ state, codeChallenge: challenge }));
  });

  router.get('/auth/google/callback', async (req, res) => {
    try {
      if (!googleProvider)
        throw new HttpError(503, 'google_unavailable', 'Google sign-in is not configured');
      const expectedState = readCookie(req.headers.cookie, 'novelhub_oauth_state');
      const verifier = readCookie(req.headers.cookie, 'novelhub_oauth_verifier');
      const registering = readCookie(req.headers.cookie, 'novelhub_oauth_mode') === 'register';
      if (!req.query.state || req.query.state !== expectedState || !verifier) {
        throw new HttpError(400, 'invalid_oauth_state', 'Google sign-in state is invalid');
      }
      const clear = { ...oauthCookieOptions };
      delete clear.maxAge;
      res
        .clearCookie('novelhub_oauth_state', clear)
        .clearCookie('novelhub_oauth_verifier', clear)
        .clearCookie('novelhub_oauth_mode', clear);
      if (req.query.error) return res.redirect(`${config.frontendUrl}/login?googleError=cancelled`);
      if (typeof req.query.code !== 'string')
        throw new HttpError(400, 'invalid_oauth_state', 'Google authorization code is missing');
      const identity = await googleProvider.exchange({
        code: req.query.code,
        codeVerifier: verifier,
      });
      const account = await withTransaction(async (session) => {
        const linked = await ExternalIdentity.findOne({
          provider: 'google',
          providerSubject: identity.sub,
          status: 'linked',
        })
          .select('+providerSubject')
          .session(session);
        if (linked) {
          const linkedAccount = await Account.findById(linked.accountId).session(session);
          if (linkedAccount) return linkedAccount;
          // A deleted account must not leave its Google identity permanently unusable.
          await ExternalIdentity.deleteOne({ _id: linked._id }, { session });
        }
        let target = await Account.findOne({ normalizedEmail: identity.email }).session(session);
        if (target && !['active', 'pending-verification'].includes(target.status)) {
          throw new HttpError(403, 'account_unavailable', 'This NovelHub account is unavailable');
        }
        if (!target) {
          [target] = await Account.create(
            [
              {
                displayName: identity.name,
                email: identity.email,
                status: 'active',
                emailVerifiedAt: new Date(),
              },
            ],
            { session },
          );
        } else if (target.status === 'pending-verification') {
          target.status = 'active';
          target.emailVerifiedAt = new Date();
          await target.save({ session });
        }
        await ExternalIdentity.create(
          [
            {
              accountId: target._id,
              provider: 'google',
              providerSubject: identity.sub,
              emailAtLink: identity.email,
              claimsDigest: createHash('sha256')
                .update(`${identity.sub}\n${identity.email}`)
                .digest('base64url'),
            },
          ],
          { session },
        );
        return target;
      });
      if (!account || account.status !== 'active')
        throw new HttpError(403, 'account_unavailable', 'This NovelHub account is unavailable');
      if (registering) {
        return res.redirect(`${config.frontendUrl}/login?registered=google`);
      }
      if (account.twoFactorEnabled) {
        const { challenge } = await security.issue(account, 'security-login', true);
        return res.redirect(
          config.frontendUrl + '/login?googleChallenge=' + encodeURIComponent(challenge),
        );
      }
      const { token } = await issueSession(account, config.sessionTtlDays, {
        userAgent: req.get('user-agent'),
      });
      res
        .clearCookie('novelhub_oauth_state', clear)
        .clearCookie('novelhub_oauth_verifier', clear)
        .cookie(config.cookieName, token, options)
        .redirect(`${config.frontendUrl}/auth/google-complete`);
    } catch (error) {
      const clear = { ...oauthCookieOptions };
      delete clear.maxAge;
      res
        .clearCookie('novelhub_oauth_state', clear)
        .clearCookie('novelhub_oauth_verifier', clear)
        .clearCookie('novelhub_oauth_mode', clear);
      const code = error.code === 'account_unavailable' ? 'account_unavailable' : 'failed';
      res.redirect(`${config.frontendUrl}/login?googleError=${code}`);
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
      if (account.twoFactorEnabled) {
        return res.json({
          requiresTwoFactor: true,
          ...(await security.issue(account, 'security-login', parsed.data.rememberMe)),
        });
      }
      const { token } = await issueSession(
        account,
        parsed.data.rememberMe ? config.sessionTtlDays : 1,
        { userAgent: req.get('user-agent') },
      );
      const loginCookie = { ...options };
      if (!parsed.data.rememberMe) delete loginCookie.maxAge;
      attempts.delete(req.ip);
      res.cookie(config.cookieName, token, loginCookie).json({ user: await publicUser(account) });
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
