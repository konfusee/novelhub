import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { REPORT_REASONS, REPORT_TARGET_TYPES } from '../models/index.js'
import {
  moderationOverview,
  moderationStatistics,
} from '../modules/moderation-ai/moderation/dashboard.js'
import {
  CASE_OUTCOMES,
  historyEntryDetail,
  listHistory,
} from '../modules/moderation-ai/moderation/history.js'
import { RISK_LEVELS } from '../modules/moderation-ai/moderation/period-stats.js'

/** ModerationDashboardController (SDS 3.1): overview, statistics and history; reads only. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i)
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  })
const statisticsQuery = z
  .object({
    period: z.enum(['last7', 'last30', 'last90', 'custom']).default('last30'),
    from: isoDay.optional(),
    to: isoDay.optional(),
    bucket: z.enum(['day', 'week', 'month']).default('day'),
    // groupBy splits publication decisions, so it takes only their attributes. Reports are
    // always split by target type and reason, and resolutions by outcome (UC-MOD-09 step 6).
    groupBy: z.enum(['outcome', 'moderator', 'targetType', 'riskLevel']).optional(),
    outcome: z.enum(['approved', 'rejected']).optional(),
    moderator: z.enum(['all', 'mine', 'one']).default('all'),
    moderatorId: objectId.optional(),
    targetType: z.enum(REPORT_TARGET_TYPES).optional(),
    reason: z.enum(REPORT_REASONS).optional(),
    resolution: z.enum(CASE_OUTCOMES.report).optional(),
    riskLevel: z.enum(RISK_LEVELS).optional(),
  })
  .strict()
  // Custom dates are required with period=custom and not accepted otherwise.
  .refine(query =>
    query.period === 'custom' ? Boolean(query.from && query.to) : !query.from && !query.to,
  )
  .refine(query => (query.moderator === 'one') === Boolean(query.moderatorId))
const historyQuery = z
  .object({
    scope: z.enum(['all', 'mine']).default('all'),
    caseType: z.enum(['publication', 'report']).optional(),
    outcome: z.enum([...CASE_OUTCOMES.publication, ...CASE_OUTCOMES.report]).optional(),
    from: isoDay.optional(),
    to: isoDay.optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
  .refine(
    query =>
      !query.caseType || !query.outcome || CASE_OUTCOMES[query.caseType].includes(query.outcome),
  )
  .refine(query => !query.from || !query.to || query.from <= query.to)

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(422, 'validation_error', 'Một số giá trị không hợp lệ. Hãy kiểm tra lại.')
  return result.data
}

export function createModeratorDashboardRouter(config) {
  const router = Router()
  router.use(
    ['/moderator/overview', '/moderator/statistics', '/moderator/history'],
    requireAuth(config),
    requireRole('moderator'),
  )
  const read = handler => async (req, res, next) => {
    try {
      res.set('Cache-Control', 'private, no-store').json(await handler(req, new Date()))
    } catch (error) {
      next(error)
    }
  }
  router.get(
    '/moderator/overview',
    read((req, now) => moderationOverview(req.account, now)),
  )
  router.get(
    '/moderator/statistics',
    read((req, now) => moderationStatistics(req.account, parse(statisticsQuery, req.query), now)),
  )
  router.get(
    '/moderator/history',
    read(req => listHistory(req.account, parse(historyQuery, req.query))),
  )
  router.get(
    '/moderator/history/:historyId',
    read(req => historyEntryDetail(parse(objectId, req.params.historyId))),
  )
  return router
}
