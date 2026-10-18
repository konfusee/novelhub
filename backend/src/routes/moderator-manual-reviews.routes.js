import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { ModerationHistory, PublicationSubmission } from '../models/index.js';
import {
  admitManualReview,
  decideManualReview,
  manualReview,
} from '../modules/moderator-manual-reviews.js';
import { reviewClaimView } from '../modules/moderator-review-claims.js';
export function createModeratorManualReviewsRouter(config) {
  const router = Router();
  const id = z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .transform((v) => v.toLowerCase());
  const version = z.number().int().min(0);
  router.use(
    '/moderator/manual-reviews',
    requireAuth(config),
    requireRole('moderator'),
    (req, res, next) => {
      res.set('Cache-Control', 'private, no-store');
      if (req.account.everAuthor)
        return next(
          new HttpError(403, 'forbidden', 'Tài khoản từng là Author không được kiểm duyệt.'),
        );
      next();
    },
  );
  router.get('/moderator/manual-reviews', async (req, res, next) => {
    try {
      const parsed = z
        .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
        .strict()
        .safeParse(req.query);
      if (!parsed.success) throw new HttpError(400, 'validation_error', 'Bộ lọc không hợp lệ.');
      const items = await PublicationSubmission.find({ status: 'validated' })
        .sort({ submittedAt: 1, _id: 1 })
        .skip((parsed.data.page - 1) * 20)
        .limit(21)
        .lean();
      res.json({
        items: items.slice(0, 20).map((s) => ({
          ...reviewClaimView(s),
          storyId: String(s.storyId),
          chapterId: s.chapterId ? String(s.chapterId) : null,
          submittedAt: s.submittedAt,
        })),
        hasMore: items.length > 20,
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/moderator/manual-reviews/history', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          outcome: z.enum(['all', 'approved', 'rejected', 'revision-requested']).default('all'),
        })
        .strict()
        .safeParse(req.query);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc lịch sử không hợp lệ.');
      const rows = await ModerationHistory.find({
        actorAccountId: req.account._id,
        action: 'manual-review.decided',
        ...(parsed.data.outcome === 'all' ? {} : { outcome: parsed.data.outcome }),
      })
        .sort({ occurredAt: -1, _id: -1 })
        .skip((parsed.data.page - 1) * 20)
        .limit(21)
        .lean();
      res.json({
        items: rows.slice(0, 20).map((h) => ({
          id: String(h._id),
          submissionId: String(h.submissionId),
          revisionId: String(h.revisionId),
          outcome: h.outcome,
          reason: h.reason ?? '',
          occurredAt: h.occurredAt,
        })),
        hasMore: rows.length > 20,
      });
    } catch (error) {
      next(error);
    }
  });
  router.param('id', (req, res, next, value) =>
    id.safeParse(value).success
      ? next()
      : next(new HttpError(400, 'validation_error', 'Mã hồ sơ không hợp lệ.')),
  );
  router.get('/moderator/manual-reviews/:id', async (req, res, next) => {
    try {
      res.json(await manualReview(req.account, req.params.id));
    } catch (error) {
      next(error);
    }
  });
  router.post('/moderator/manual-reviews/:id/admit', async (req, res, next) => {
    try {
      const input = z
        .object({
          expectedVersion: version,
          revisionId: id,
          expectedEvidenceVersion: version,
          confirmedManualReview: z.literal(true),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict()
        .safeParse(req.body);
      if (!input.success)
        throw new HttpError(
          400,
          'validation_error',
          'Phiên bản, xác nhận hoặc lý do chưa hợp lệ (ít nhất 10 ký tự).',
        );
      res.json(await admitManualReview(req.account, req.params.id, input.data));
    } catch (error) {
      next(error);
    }
  });
  router.post('/moderator/manual-reviews/:id/decision', async (req, res, next) => {
    try {
      const input = z
        .object({
          expectedVersion: version,
          expectedClaimVersion: version,
          revisionId: id,
          expectedRevisionVersion: version,
          evidenceBatchId: id,
          expectedEvidenceVersion: version,
          outcome: z.enum(['approved', 'rejected', 'revision-requested']),
          confirmedManualReview: z.literal(true),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict()
        .safeParse(req.body);
      if (!input.success)
        throw new HttpError(
          400,
          'validation_error',
          'Quyết định, phiên bản, xác nhận hoặc lý do chưa hợp lệ.',
        );
      res.json(await decideManualReview(req.account, req.params.id, input.data));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
