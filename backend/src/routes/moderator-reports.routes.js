import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { REPORT_ACTIONS, REPORT_TARGET_TYPES } from '../models/index.js'
import { resolveReport } from '../modules/moderation-ai/moderation/report-decision.js'
import {
  claimReport,
  listModeratorReports,
  moderatorReportDetail,
  releaseReport,
} from '../modules/moderation-ai/moderation/report-queue.js'

/** ReportReviewController (SDS 3.3): report queue, review, claim, release and resolution. */

const id = z.string().regex(/^[a-f\d]{24}$/i)
const listQuery = z
  .object({
    view: z.enum(['queue', 'mine']).default('queue'),
    targetType: z.enum(REPORT_TARGET_TYPES).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
// claimToken is ignored on claim and required on release (SDS ClaimMutationInput).
const claimBody = z
  .object({ expectedVersion: z.number().int().min(0), claimToken: id.optional() })
  .strict()
const releaseBody = z.object({ expectedVersion: z.number().int().min(0), claimToken: id }).strict()
const resolutionBody = z
  .object({
    action: z.enum(REPORT_ACTIONS),
    reason: z.string().trim().min(5).max(2000),
    expectedVersion: z.number().int().min(0),
    claimToken: id,
  })
  .strict()

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(422, 'validation_error', 'Thông tin xử lý báo cáo không hợp lệ.')
  return result.data
}

export function createModeratorReportsRouter(config) {
  const router = Router()
  router.use('/moderator/reports', requireAuth(config), requireRole('moderator'))
  router.get('/moderator/reports', async (req, res, next) => {
    try {
      res
        .set('Cache-Control', 'private, no-store')
        .json(await listModeratorReports(req.account, parse(listQuery, req.query)))
    } catch (error) {
      next(error)
    }
  })
  router.get('/moderator/reports/:reportId', async (req, res, next) => {
    try {
      res
        .set({ 'Cache-Control': 'private, no-store', Vary: 'Cookie' })
        .json(await moderatorReportDetail(req.account, parse(id, req.params.reportId)))
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/reports/:reportId/claim', async (req, res, next) => {
    try {
      const { expectedVersion } = parse(claimBody, req.body)
      res.json(
        await claimReport(req.account, parse(id, req.params.reportId), { expectedVersion }, config),
      )
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/reports/:reportId/release', async (req, res, next) => {
    try {
      res.json(
        await releaseReport(
          req.account,
          parse(id, req.params.reportId),
          parse(releaseBody, req.body),
        ),
      )
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/reports/:reportId/resolution', async (req, res, next) => {
    try {
      res.json(
        await resolveReport(
          req.account,
          parse(id, req.params.reportId),
          parse(resolutionBody, req.body),
          { correlationId: String(req.id ?? randomUUID()) },
        ),
      )
    } catch (error) {
      next(error)
    }
  })
  return router
}
