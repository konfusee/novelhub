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
  listModeratorDecisions,
  listModeratorSubmissions,
  moderatorSummary,
  releaseSubmission,
} from '../modules/moderation-ai/moderation/review-queue.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const versionBody = z.object({ expectedVersion: z.number().int().min(0) }).strict()
const page = z.coerce.number().int().min(1).max(100000).default(1)
const listQuery = z
  .object({ view: z.enum(['queue', 'mine', 'processing']).default('queue'), page })
  .strict()
const decisionsQuery = z
  .object({
    outcome: z.enum(['all', 'approved', 'rejected']).default('all'),
    scope: z.enum(['all', 'mine']).default('all'),
    page,
  })
  .strict()
const decisionBody = z
  .object({
    decision: z.enum(['approve', 'reject']),
    feedback: z.string().trim().max(4000).default(''),
    expectedVersion: z.number().int().min(0),
    evidenceBatchId: id,
    evidenceBatchVersion: z.number().int().min(0),
  })
  .strict()
  .refine(value => value.decision === 'approve' || value.feedback.length > 0, {
    path: ['feedback'],
  })

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(400, 'validation_error', 'Thông tin kiểm duyệt không hợp lệ.')
  return result.data
}

export function createModeratorRouter(config) {
  const router = Router()
  router.use('/moderator', requireAuth(config), requireRole('moderator'))
  router.get('/moderator/summary', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'private, no-store').json(await moderatorSummary(req.account))
    } catch (error) {
      next(error)
    }
  })
  router.get('/moderator/submissions', async (req, res, next) => {
    try {
      res.json(await listModeratorSubmissions(req.account, parse(listQuery, req.query)))
    } catch (error) {
      next(error)
    }
  })
  router.get('/moderator/submissions/:submissionId', async (req, res, next) => {
    try {
      res
        .set({ 'Cache-Control': 'private, no-store', Vary: 'Cookie' })
        .json(await moderatorSubmissionDetail(req.account, parse(id, req.params.submissionId)))
    } catch (error) {
      next(error)
    }
  })
  router.get(
    '/moderator/submissions/:submissionId/media/:mediaId/content',
    async (req, res, next) => {
      try {
        const bytes = await moderatorSubmittedImage(
          config,
          parse(id, req.params.submissionId),
          parse(id, req.params.mediaId).toLowerCase(),
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
    },
  )
  router.post('/moderator/submissions/:submissionId/claim', async (req, res, next) => {
    try {
      const submission = await claimSubmission(
        req.account,
        parse(id, req.params.submissionId),
        parse(versionBody, req.body),
        config,
      )
      res.json({ submission })
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/submissions/:submissionId/release', async (req, res, next) => {
    try {
      const submission = await releaseSubmission(
        req.account,
        parse(id, req.params.submissionId),
        parse(versionBody, req.body),
      )
      res.json({ submission })
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/submissions/:submissionId/decision', async (req, res, next) => {
    try {
      const submission = await decideSubmission(
        req.account,
        parse(id, req.params.submissionId),
        parse(decisionBody, req.body),
        { correlationId: String(req.id ?? randomUUID()) },
      )
      res.json({ submission })
    } catch (error) {
      next(error)
    }
  })
  router.get('/moderator/decisions', async (req, res, next) => {
    try {
      res.json(await listModeratorDecisions(req.account, parse(decisionsQuery, req.query)))
    } catch (error) {
      next(error)
    }
  })
  return router
}
