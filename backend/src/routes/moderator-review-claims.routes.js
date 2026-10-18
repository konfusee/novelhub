import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { changeReviewClaim, reviewClaimView } from '../modules/moderator-review-claims.js';
import { PublicationSubmission } from '../models/index.js';
export function createModeratorReviewClaimsRouter(config) {
  const router = Router();
  router.use('/moderator/review-claims', requireAuth(config), requireRole('moderator'));
  router.get('/moderator/review-claims', async (req, res, next) => {
    try {
      if (req.account.everAuthor)
        throw new HttpError(403, 'forbidden', 'Tài khoản từng là Author không được kiểm duyệt.');
      const query = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          view: z.enum(['available', 'mine']).default('available'),
        })
        .strict()
        .safeParse(req.query);
      if (!query.success) throw new HttpError(400, 'validation_error', 'Bộ lọc không hợp lệ.');
      const now = new Date();
      const claims = await PublicationSubmission.find({
        status: 'pending-review',
        ...(query.data.view === 'mine'
          ? { claimOwnerAccountId: req.account._id, claimExpiresAt: { $gt: now } }
          : {
              $or: [
                { claimOwnerAccountId: null },
                { claimExpiresAt: { $lte: now } },
                { claimExpiresAt: null },
              ],
            }),
      })
        .sort({ submittedAt: 1, _id: 1 })
        .skip((query.data.page - 1) * 20)
        .limit(21)
        .lean();
      res.set('Cache-Control', 'private, no-store').json({
        items: claims.slice(0, 20).map((s) => ({
          ...reviewClaimView(s),
          storyId: String(s.storyId),
          chapterId: s.chapterId ? String(s.chapterId) : null,
          submittedAt: s.submittedAt,
        })),
        hasMore: claims.length > 20,
      });
    } catch (error) {
      next(error);
    }
  });
  const body = z
    .object({
      expectedVersion: z.number().int().min(0),
      expectedClaimVersion: z.number().int().min(0),
    })
    .strict();
  for (const release of [false, true])
    router.post(
      `/moderator/review-claims/:id${release ? '/release' : ''}`,
      async (req, res, next) => {
        try {
          const parsed = body.safeParse(req.body);
          if (!parsed.success || !/^[a-f\d]{24}$/i.test(req.params.id))
            throw new HttpError(400, 'validation_error', 'Hồ sơ hoặc phiên bản không hợp lệ.');
          res
            .set('Cache-Control', 'private, no-store')
            .json(await changeReviewClaim(req.account, req.params.id, parsed.data, release));
        } catch (error) {
          next(error);
        }
      },
    );
  return router;
}
