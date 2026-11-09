import {
  Account,
  ContentRevision,
  EmbeddingArtifact,
  EvidenceBatch,
  ProcessingAttempt,
  PublicationSubmission,
} from '../../../models/index.js'
import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { revisionPassages } from './chunking.js'
import { estimateTokens, priceFor } from './pricing.js'
import {
  MAX_REVIEW_OUTPUT_TOKENS,
  MAX_REVIEW_TEXT_CHARS,
  REVIEW_INSTRUCTIONS,
} from './review-criteria.js'

export const MAX_REVIEW_FINDINGS = 20
export const SNIPPET_CHARS = 1000

const sumOf = async (Model, pipeline) => (await Model.aggregate(pipeline))[0]?.total ?? 0

/** Stored spend since the budget window: worker attempts plus backfill artifacts. */
export async function spentUsd(config) {
  const since = config.ai.budgetWindowStart
    ? { createdAt: { $gte: config.ai.budgetWindowStart } }
    : {}
  const [attempts, backfill] = await Promise.all([
    sumOf(ProcessingAttempt, [
      { $match: { ...since, 'responseMetadata.costUsd': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$responseMetadata.costUsd' } } },
    ]),
    sumOf(EmbeddingArtifact, [
      { $match: { ...since, source: 'backfill', costUsd: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$costUsd' } } },
    ]),
  ])
  return attempts + backfill
}

/** Worst-case embedding cost of `chars` characters; null when the model has no price. */
export function worstCaseEmbeddingUsd(config, chars) {
  const price = priceFor(config.ai.embeddingModel)
  if (!price) return null
  return (estimateTokens(chars) * price.input) / 1e6
}

/** Worst-case review cost: capped text, every finding snippet, instructions and full output. */
export function worstCaseReviewUsd(config, chars) {
  const price = priceFor(config.ai.reviewModel)
  if (!price) return null
  const inputChars =
    Math.min(chars, MAX_REVIEW_TEXT_CHARS) +
    MAX_REVIEW_FINDINGS * 2 * SNIPPET_CHARS +
    REVIEW_INSTRUCTIONS.length +
    4000
  return (estimateTokens(inputChars) * price.input + MAX_REVIEW_OUTPUT_TOKENS * price.output) / 1e6
}

const reviewTextLength = revision =>
  revision.contentType === 'story'
    ? [revision.content?.title, revision.content?.description].join('\n').length
    : chapterTextProjection(revision).join('\n').length

/** Worst-case cost of running `stage` for `batch`; comparison makes no provider call. */
export async function worstCaseStageCostUsd(config, stage, batch) {
  if (stage === 'comparison') return 0
  const revision = await ContentRevision.findById(batch.revisionId).lean()
  // A missing revision fails the stage before any provider call.
  if (!revision) return 0
  if (stage === 'embedding') {
    const chars = revisionPassages(revision).reduce((sum, passage) => sum + passage.text.length, 0)
    return worstCaseEmbeddingUsd(config, chars)
  }
  return worstCaseReviewUsd(config, reviewTextLength(revision))
}

/** Worst-case cost of every validated submission of an active author still waiting for evidence. */
export async function worstCaseBacklogUsd(config) {
  const inactive = await Account.distinct('_id', { status: { $ne: 'active' } })
  const submissions = await PublicationSubmission.find({
    status: 'validated',
    currentEvidenceBatchId: { $ne: null },
    authorAccountId: { $nin: inactive },
  })
    .select('currentEvidenceBatchId')
    .lean()
  const batches = await EvidenceBatch.find({
    _id: { $in: submissions.map(submission => submission.currentEvidenceBatchId) },
  }).lean()
  let usd = 0
  for (const batch of batches) {
    const costs = []
    if (batch.status === 'pending')
      costs.push(await worstCaseStageCostUsd(config, 'embedding', batch))
    if (['pending', 'embedding-complete', 'discovery-complete'].includes(batch.status))
      costs.push(await worstCaseStageCostUsd(config, 'llm', batch))
    for (const cost of costs) {
      if (cost === null) return { submissions: submissions.length, usd: null }
      usd += cost
    }
  }
  return { submissions: submissions.length, usd }
}
