import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { REPORT_TARGET_TYPES } from '../models/index.js'
import { resolveReport } from '../modules/moderation-ai/moderation/report-decision.js'
import {
  claimReport,
  listModeratorReports,
  releaseReport,
} from '../modules/moderation-ai/moderation/report-queue.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const versionBody = z.object({ expectedVersion: z.number().int().min(0) }).strict()
const listQuery = z
  .object({
    status: z.enum(['open', 'mine', 'resolved']).default('open'),
    targetType: z.enum(REPORT_TARGET_TYPES).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
const resolveBody = z
  .object({
    action: z.enum([
      'dismiss',
      'hide-comment',
      'unpublish-chapter',
      'unpublish-story',
      'warn-author',
    ]),
    reason: z.string().trim().min(5).max(2000),
    expectedVersion: z.number().int().min(0),
  })
  .strict()

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(400, 'validation_error', 'Thông tin xử lý báo cáo không hợp lệ.')
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
  router.post('/moderator/reports/:reportId/claim', async (req, res, next) => {
    try {
      const report = await claimReport(
        req.account,
        parse(id, req.params.reportId),
        parse(versionBody, req.body),
        config,
      )
      res.json({ report })
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/reports/:reportId/release', async (req, res, next) => {
    try {
      const report = await releaseReport(
        req.account,
        parse(id, req.params.reportId),
        parse(versionBody, req.body),
      )
      res.json({ report })
    } catch (error) {
      next(error)
    }
  })
  router.post('/moderator/reports/:reportId/resolve', async (req, res, next) => {
    try {
      const report = await resolveReport(
        req.account,
        parse(id, req.params.reportId),
        parse(resolveBody, req.body),
        { correlationId: String(req.id ?? randomUUID()) },
      )
      res.json({ report })
    } catch (error) {
      next(error)
    }
  })
  return router
}
