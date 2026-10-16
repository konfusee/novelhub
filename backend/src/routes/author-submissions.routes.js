import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import {
  prepareSubmission,
  submitContent,
  submissionList,
  reviseSubmission,
} from '../modules/author-submissions.js';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const target = z.object({ storyId: id, chapterId: id.optional() }).strict();
const input = z
  .object({
    storyId: id,
    chapterId: id.optional(),
    revisionId: id,
    expectedVersion: z.number().int().min(0),
    imageManifestDigest: z
      .string()
      .regex(/^[a-f\d]{64}$/)
      .optional(),
    rights: z
      .object({
        basis: z.enum(['original', 'licensed']),
        asserted: z.literal(true),
        sourceLicenceNote: z.string().trim().max(2000).default(''),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) =>
    value.chapterId
      ? Boolean(value.rights) === Boolean(value.imageManifestDigest)
      : Boolean(value.rights) && !value.imageManifestDigest,
  );
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(400, 'validation_error', 'Thông tin gửi duyệt không hợp lệ.');
  return result.data;
}
export function createAuthorSubmissionsRouter(config) {
  const router = Router();
  router.use('/author/submissions', requireAuth(config), requireRole('author'));
  router.get('/author/submissions', async (req, res, next) => {
    try {
      res.json(
        await submissionList(
          req.account,
          parse(
            z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
            req.query,
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get('/author/submissions/prepare', async (req, res, next) => {
    try {
      res.json(await prepareSubmission(req.account, parse(target, req.query), config));
    } catch (error) {
      next(error);
    }
  });
  router.post('/author/submissions', async (req, res, next) => {
    try {
      const submission = await submitContent(req.account, parse(input, req.body), config);
      res.status(submission.replayed ? 200 : 201).json({ submission });
    } catch (error) {
      next(error);
    }
  });
  router.post('/author/submissions/:submissionId/revise', async (req, res, next) => {
    try {
      const submissionId = parse(id, req.params.submissionId);
      const { expectedVersion } = parse(
        z.object({ expectedVersion: z.number().int().min(0) }).strict(),
        req.body,
      );
      const revision = await reviseSubmission(req.account, submissionId, expectedVersion);
      res.status(revision.replayed ? 200 : 201).json({ revision });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
