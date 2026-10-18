import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { prepareUnlock, unlockChapter } from '../modules/reader-unlocks.js';
export function createReaderUnlocksRouter(config) {
  const router = Router(),
    id = z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .transform((v) => v.toLowerCase());
  const path = '/reader/stories/:storyId/chapters/:chapterId/unlock';
  router.use('/reader/stories', requireAuth(config));
  const params = z.object({ storyId: id, chapterId: id });
  router.get(path, async (req, res, next) => {
    try {
      const parsed = params.safeParse(req.params);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Mã truyện/chương không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(await prepareUnlock(req.account, parsed.data.storyId, parsed.data.chapterId));
    } catch (error) {
      next(error);
    }
  });
  router.post(path, async (req, res, next) => {
    try {
      const parsed = params.safeParse(req.params),
        input = z
          .object({
            publishedRevisionId: id,
            expectedPriceCoins: z.number().int().positive().safe(),
            idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
          })
          .strict()
          .safeParse(req.body);
      if (!parsed.success || !input.success)
        throw new HttpError(400, 'validation_error', 'Yêu cầu mở khóa không hợp lệ.');
      res
        .set('Cache-Control', 'private, no-store')
        .json(
          await unlockChapter(req.account, parsed.data.storyId, parsed.data.chapterId, input.data),
        );
    } catch (error) {
      next(error);
    }
  });
  return router;
}
