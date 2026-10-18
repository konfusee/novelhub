import { authorAgreement, saveAuthorAgreement } from '../modules/author-agreement.js';
import {
  activatePolicy,
  adminPolicy,
  adminPolicyHistory,
  cancelFuturePolicy,
  rescheduleFuturePolicy,
} from '../modules/admin-policy.js';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { adminUsers, adminUserDetail } from '../modules/admin-users.js';
import { adminAudit, auditQuery } from '../modules/admin-audit.js';
import { changeAuthorAccount } from '../modules/admin-author-account.js';
import { closeAuthorAccount } from '../modules/admin-close-author-account.js';
import {
  authorRoleView,
  revokeAuthorRole,
  listActiveAuthors,
} from '../modules/author-access/revocation.js';
import {
  decideApplication,
  getApplication,
  listApplications,
} from '../modules/author-access/service.js';

const querySchema = z
  .object({
    status: z.enum(['submitted', 'approved', 'rejected', 'all']).default('submitted'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(1).max(1000),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export function createAdminAuthorRouter(config) {
  const router = Router();
  router.post(
    '/admin/accounts/:accountId/status',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            action: z.enum(['suspend', 'restore', 'close']),
            expectedVersion: z.number().int().min(0),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .safeParse(req.body);
        if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.accountId))
          throw new HttpError(400, 'validation_error', 'Cần tài khoản, phiên bản và lý do hợp lệ.');
        res
          .set('Cache-Control', 'private, no-store')
          .json(
            await (parsed.data.action === 'close' ? closeAuthorAccount : changeAuthorAccount)(
              req.account,
              req.params.accountId.toLowerCase(),
              parsed.data,
            ),
          );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/admin/audit-events',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = auditQuery.safeParse(req.query);
        if (!parsed.success)
          throw new HttpError(400, 'validation_error', 'Bộ lọc nhật ký không hợp lệ.');
        res
          .set({ 'Cache-Control': 'private, no-store', Vary: 'Cookie' })
          .json(await adminAudit(parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/admin/policy/:policyId/reschedule',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
            effectiveAt: z.string().datetime({ offset: true }),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .safeParse(req.body);
        if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.policyId))
          throw new HttpError(
            400,
            'validation_error',
            'Cần mã chính sách, phiên bản, ngày hiệu lực và lý do hợp lệ.',
          );
        res
          .status(201)
          .set('Cache-Control', 'private, no-store')
          .json(await rescheduleFuturePolicy(req.account, req.params.policyId, parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/admin/policy/:policyId/cancel',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .safeParse(req.body);
        if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.policyId))
          throw new HttpError(
            400,
            'validation_error',
            'Cần mã chính sách, phiên bản và lý do hợp lệ.',
          );
        res
          .set('Cache-Control', 'private, no-store')
          .json(await cancelFuturePolicy(req.account, req.params.policyId, parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/admin/policy/history',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            page: z.coerce.number().int().min(1).max(100000).default(1),
            pageSize: z.coerce.number().int().min(1).max(20).default(5),
          })
          .strict()
          .safeParse(req.query);
        if (!parsed.success)
          throw new HttpError(
            400,
            'validation_error',
            'Phân trang lịch sử chính sách không hợp lệ.',
          );
        res.set('Cache-Control', 'private, no-store').json(await adminPolicyHistory(parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/admin/policy',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
        const parsed = z
          .object({
            priceMinCoins: integer,
            priceMaxCoins: integer,
            durationMinDays: integer.min(1),
            durationMaxDays: integer.min(1),
            authorSharePercent: integer.max(100).optional(),
            withdrawalThresholdCoins: integer.optional(),
            orderExpiryHours: integer.optional(),
            claimExpiryHours: integer.optional(),
            effectiveAt: z.string().datetime({ offset: true }).optional(),
            expectedPolicyId: z
              .string()
              .regex(/^[a-f\d]{24}$/i)
              .nullable(),
            expectedPolicyVersion: integer.nullable(),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .refine(
            (value) =>
              value.priceMinCoins <= value.priceMaxCoins &&
              value.durationMinDays <= value.durationMaxDays &&
              (value.expectedPolicyId === null) === (value.expectedPolicyVersion === null),
          )
          .safeParse(req.body);
        if (!parsed.success)
          throw new HttpError(
            400,
            'validation_error',
            'Cần giới hạn nguyên hợp lệ, phiên bản chính sách và lý do.',
          );
        res
          .status(201)
          .set('Cache-Control', 'private, no-store')
          .json(await activatePolicy(req.account, parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/admin/policy',
    requireAuth(config),
    requireRole('admin'),
    async (_req, res, next) => {
      try {
        res.set('Cache-Control', 'private, no-store').json(await adminPolicy());
      } catch (error) {
        next(error);
      }
    },
  );
  router.use('/admin/accounts', requireAuth(config), requireRole('admin'));
  router.get('/admin/accounts', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(10),
          query: z.string().trim().max(100).default(''),
          role: z.enum(['all', 'reader', 'author', 'moderator', 'admin']).default('all'),
          status: z
            .enum(['all', 'active', 'suspended', 'pending-verification', 'anonymized'])
            .default('all'),
          sort: z.enum(['newest', 'oldest', 'stories', 'coins']).default('newest'),
        })
        .strict()
        .safeParse(req.query);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc tài khoản không hợp lệ.');
      res.set('Cache-Control', 'private, no-store').json(await adminUsers(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/accounts/:accountId', async (req, res, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.accountId))
        throw new HttpError(400, 'validation_error', 'Mã tài khoản không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(await adminUserDetail(req.params.accountId));
    } catch (error) {
      next(error);
    }
  });
  router.use('/admin/authors', requireAuth(config), requireRole('admin'));
  router.post('/admin/authors/:accountId/agreement', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          percentage: z.number().int().min(0).max(100),
          reason: z.string().trim().min(1).max(1000),
          expectedAccountVersion: z.number().int().min(0),
          expectedLatestRateId: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .nullable(),
        })
        .strict()
        .safeParse(req.body);
      if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.accountId))
        throw new HttpError(
          400,
          'validation_error',
          'Cần tỷ lệ, lý do và phiên bản thỏa thuận hợp lệ.',
        );
      res
        .status(201)
        .set('Cache-Control', 'private, no-store')
        .json(await saveAuthorAgreement(req.account, req.params.accountId, parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/authors/:accountId/agreement', async (req, res, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.accountId))
        throw new HttpError(400, 'validation_error', 'Mã tài khoản không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(await authorAgreement(req.params.accountId));
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/authors', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(10),
          query: z.string().trim().max(100).default(''),
        })
        .strict()
        .safeParse(req.query);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc tác giả không hợp lệ.');
      res.set('Cache-Control', 'private, no-store').json(await listActiveAuthors(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/authors/:accountId/role', async (req, res, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.accountId))
        throw new HttpError(400, 'validation_error', 'Mã tài khoản không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(await authorRoleView(req.params.accountId));
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/authors/:accountId/revoke', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          roleId: z.string().regex(/^[a-f\d]{24}$/i),
          expectedRoleVersion: z.number().int().min(0),
          expectedAccountVersion: z.number().int().min(0),
          reason: z.string().trim().min(1).max(1000),
        })
        .strict()
        .safeParse(req.body);
      if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.accountId))
        throw new HttpError(
          400,
          'validation_error',
          'Cần lý do, quyền và phiên bản tài khoản hợp lệ.',
        );
      res.json(await revokeAuthorRole(req.account, req.params.accountId, parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.use('/admin/author-applications', requireAuth(config), requireRole('admin'));
  router.get('/admin/author-applications', async (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Invalid application filters');
      res.json(await listApplications(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.param('id', (req, _res, next, id) => {
    if (!/^[a-f\d]{24}$/i.test(id))
      return next(new HttpError(400, 'validation_error', 'Invalid application ID'));
    next();
  });
  router.get('/admin/author-applications/:id', async (req, res, next) => {
    try {
      res.json({ application: await getApplication(req.params.id) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/author-applications/:id/decision', async (req, res, next) => {
    try {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'A decision, reason and version are required');
      res.json({ application: await decideApplication(req.account, req.params.id, parsed.data) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
