import os from 'node:os'
import path from 'node:path'
import { Category, ProcessingAttempt } from '../../models/index.js'
import {
  spentUsd,
  worstCaseBacklogUsd,
  worstCaseEmbeddingUsd,
  worstCaseReviewUsd,
} from './budget.js'
import { backfillEmbeddings } from './embedding-backfill.js'

export const MAX_BACKLOG_SUBMISSIONS = 10
// The live smoke submits two stories and two chapters of at most 4,000 characters each.
const SMOKE_SUBMISSIONS = 4
const SMOKE_MAX_CHARS = 4000
const DEFAULT_PLAN = path.join(os.tmpdir(), 'novelhub-preflight-plan.json')

// Backfill dry-run errors that are findings of the preflight rather than failures to inspect.
function backfillProblem(error) {
  if (/^Estimated cost \$/.test(error?.message)) return 'over-budget'
  if (/^No price is known for /.test(error?.message)) return 'no-price'
  return null
}

/**
 * Read-only readiness facts for the live moderation rollout: spend, worst-case backlog, the
 * backfill plan (written to a temporary file outside the repository), the smoke's worst case,
 * fresh evidence leases and active categories. `facts` holds no secret or connection value.
 */
export async function moderationPreflight(
  config,
  { now = new Date(), planPath = DEFAULT_PLAN } = {},
) {
  const spent = await spentUsd(config)
  const backlog = await worstCaseBacklogUsd(config)
  let backfill = { revisions: null, estimatedUsd: null, problem: null }
  try {
    const plan = await backfillEmbeddings(config, {
      dryRun: true,
      maxUsd: config.ai.budgetUsd,
      planPath,
      log: () => {},
    })
    backfill = { revisions: plan.candidates.length, estimatedUsd: plan.estimatedUsd, problem: null }
  } catch (error) {
    const problem = backfillProblem(error)
    if (!problem) throw error
    backfill.problem = problem
  }
  const embeddingUsd = worstCaseEmbeddingUsd(config, SMOKE_MAX_CHARS)
  const reviewUsd = worstCaseReviewUsd(config, SMOKE_MAX_CHARS)
  const leases = await ProcessingAttempt.find({
    status: { $in: ['claimed', 'started'] },
    leaseExpiresAt: { $gt: now },
  })
    .select('responseMetadata.runner')
    .lean()
  return {
    facts: {
      nodeEnv: config.nodeEnv,
      openaiKey: Boolean(config.ai.openai),
      openaiKeySource: config.ai.openaiKeySource,
      reviewModel: config.ai.reviewModel,
      embeddingModel: config.ai.embeddingModel,
      workerEnabledInEnv: config.ai.workerEnabled,
      budgetUsd: config.ai.budgetUsd,
      spentUsd: spent,
      remainingUsd: config.ai.budgetUsd - spent,
      backlogSubmissions: backlog.submissions,
      backlogWorstCaseUsd: backlog.usd,
      backfillRevisions: backfill.revisions,
      backfillEstimatedUsd: backfill.estimatedUsd,
      smokeWorstCaseUsd:
        embeddingUsd === null || reviewUsd === null
          ? null
          : SMOKE_SUBMISSIONS * (embeddingUsd + reviewUsd),
      freshLeaseRunners: [
        ...new Set(leases.map(lease => String(lease.responseMetadata?.runner ?? 'unknown'))),
      ].sort(),
      activeCategories: await Category.countDocuments({ status: 'active' }),
    },
    backfillProblem: backfill.problem,
  }
}

/**
 * Reasons that block a live rollout step. Spend blocks at `>=` the remaining budget, the same
 * non-spending boundary as the worker's budget gate and the real backfill guard.
 */
export function preflightBlockers({ facts, backfillProblem }, { confirmSingleRunner }) {
  const reasons = []
  if (!facts.openaiKey) reasons.push('OPENAI_API_KEY is not set')
  if (!confirmSingleRunner) reasons.push('operator has not confirmed a single runner')
  if (facts.freshLeaseRunners.length)
    reasons.push('another runner holds a fresh lease: ' + facts.freshLeaseRunners.join(', '))
  if (facts.backlogSubmissions > MAX_BACKLOG_SUBMISSIONS)
    reasons.push(`backlog above ${MAX_BACKLOG_SUBMISSIONS} submissions`)
  const unpriced =
    backfillProblem === 'no-price' ||
    facts.backlogWorstCaseUsd === null ||
    facts.smokeWorstCaseUsd === null
  if (unpriced) reasons.push('no price for the configured model')
  if (backfillProblem === 'over-budget') reasons.push('backfill estimate exceeds the AI budget')
  if (
    !unpriced &&
    !backfillProblem &&
    facts.backlogWorstCaseUsd + facts.backfillEstimatedUsd + facts.smokeWorstCaseUsd >=
      facts.remainingUsd
  )
    reasons.push('worst-case spend exceeds the remaining budget')
  if (facts.activeCategories === 0) reasons.push('no active category')
  return reasons
}
