import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { decideSubmission } from '../modules/moderation-ai/moderation/review-decision.js'
import {
  moderatorSubmissionDetail,
  moderatorSubmittedImage,
} from '../modules/moderation-ai/moderation/review-detail.js'
import {
  claimSubmission,
  listModeratorSubmissions,
  releaseSubmission,
} from '../modules/moderation-ai/moderation/review-queue.js'

/** SubmissionReviewController (SDS 3.2): queue, review, image, claim, release and decision. */

const id = z.string().regex(/^[a-f\d]{24}$/i)
const version = z.number().int().min(0)
const listQuery = z
  .object({
    view: z.enum(['available', 'mine', 'processing']).default('available'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
// claimToken is ignored on claim and required on release (SDS ClaimMutationInput).
const claimBody = z.object({ expectedVersion: version, claimToken: id.optional() }).strict()
const releaseBody = z.object({ expectedVersion: version, claimToken: id }).strict()
const decisionBody = z
  .object({
    outcome: z.enum(['approve', 'reject']),
    feedback: z.string().trim().max(4000).default(''),
    expectedVersion: version,
    revisionId: id,
    revisionVersion: version,
    evidenceBatchId: id,
    evidenceVersion: version,
    claimToken: id,
  })
  .strict()
  .refine(value => value.outcome === 'approve' || value.feedback.length > 0, {
    path: ['feedback'],
  })

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(422, 'validation_error', 'Thông tin kiểm duyệt không hợp lệ.')
  return result.data
}

export function createModeratorRouter(config) {
  const router = Router()
  router.use('/moderator/submissions', requireAuth(config), requireRole('moderator'))
  router.get('/moderator/submissions', async (req, res, next) => {
    try {
      res
        .set('Cache-Control', 'private, no-store')
        .json(await listModeratorSubmissions(req.account, parse(listQuery, req.query)))
    } catch (error) {
      next(error)
    }
  })
  router.get('/moderator/submissions/:submissionId', async (req, res, next) => {
    try {
      res
        .set({ 'Cache-Control': 'private, no-store', Vary: 'Cookie' })
        .json(
          await moderatorSubmissionDetail(
            req.account,
            parse(id, req.params.submissionId),
            new Date(),
          ),
        )
    } catch (error) {
      next(error)
    }
  })
  router.get('/moderator/submissions/:submissionId/images/:mediaId', async (req, res, next) => {
    try {
      const bytes = await moderatorSubmittedImage(
        req.account,
        config,
        parse(id, req.params.submissionId),
        parse(id, req.params.mediaId).toLowerCase(),
        new Date(),
      )
      res
        .set({
          'Content-Type': 'image/webp',
          'Content-Disposition': 'inline; filename="image.webp"',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          Vary: 'Cookie',
        })
        .send(bytes)
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/submissions/:submissionId/claim', async (req, res, next) => {
    try {
      const { expectedVersion } = parse(claimBody, req.body)
      res.json(
        await claimSubmission(
          req.account,
          parse(id, req.params.submissionId),
          { expectedVersion },
          config,
        ),
      )
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/submissions/:submissionId/release', async (req, res, next) => {
    try {
      res.json(
        await releaseSubmission(
          req.account,
          parse(id, req.params.submissionId),
          parse(releaseBody, req.body),
        ),
      )
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/submissions/:submissionId/decision', async (req, res, next) => {
    try {
      res.json(
        await decideSubmission(
          req.account,
          parse(id, req.params.submissionId),
          parse(decisionBody, req.body),
          { correlationId: String(req.id ?? randomUUID()) },
        ),
      )
    } catch (error) {
      next(error)
    }
  })
  return router
}
