import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { withTransaction } from '../../../db/connection.js'
import {
  Account,
  Chapter,
  ContentRevision,
  EmbeddingArtifact,
  EvidenceBatch,
  LlmReview,
  ProcessingAttempt,
  PublicationSubmission,
  RightsDeclaration,
  SimilarityFinding,
  Story,
} from '../../../models/index.js'
import { terminalEvidenceReady } from '../review-evidence.js'
import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { digest, rightsFacts } from '../../authoring-publishing/submissions/submission-digests.js'
import { MAX_REVIEW_FINDINGS, SNIPPET_CHARS, spentUsd, worstCaseStageCostUsd } from './budget.js'
import { CHUNKING_VERSION, embeddingRequestBatches, revisionPassages } from './chunking.js'
import { costUsd } from './pricing.js'
import { resolveAiProviders } from './providers.js'
import {
  buildReviewInput,
  MAX_REVIEW_OUTPUT_TOKENS,
  MAX_REVIEW_TEXT_CHARS,
  REVIEW_CRITERIA_VERSION,
  REVIEW_INSTRUCTIONS,
  REVIEW_OUTPUT_SCHEMA,
  REVIEW_SCHEMA_NAME,
  reviewOutput,
} from './review-criteria.js'
import { RUNNER_ID } from './runner-id.js'
import { StageError } from './stage-error.js'
import { notifyModeratorsSubmissionReady } from '../moderation/submission-ready-notice.js'

const MAX_STAGE_ATTEMPTS = 3
const PERSIST_ERROR_ATTEMPTS = 2
const SWEEP_LIMIT = 10
const RETRY_BASE_MS = 60000
export const STAGE_BY_STATUS = {
  pending: 'embedding',
  'embedding-complete': 'comparison',
  'discovery-complete': 'llm',
}
const NEXT_STATUS = {
  embedding: 'embedding-complete',
  comparison: 'discovery-complete',
  llm: 'available-for-human-review',
}
const PROVIDER_BY_STAGE = {
  embedding: 'openai',
  comparison: 'mongodb-vector-search',
  llm: 'openai',
}
const OPEN_SUBMISSION_STATUSES = ['validated', 'pending-review', 'decision-pending']
const OUTCOME_COUNTERS = {
  advanced: 'advanced',
  completed: 'completed',
  failed: 'failed',
  retrying: 'retrying',
  skipped: 'skipped',
  'budget-blocked': 'budgetBlocked',
}
const leaseMs = config => Math.max(300000, 2 * config.ai.timeoutMs)
class LeaseLost extends Error {}
class LeaseExpiring extends Error {}
const clamp01 = score => Math.min(1, Math.max(0, score))

// Terminal evidence hands the submission to moderators; a closed submission does not match.
async function promoteSubmission(batch, session) {
  const promoted = await PublicationSubmission.updateOne(
    { _id: batch.submissionId, status: 'validated', currentEvidenceBatchId: batch._id },
    { $set: { status: 'pending-review' }, $inc: { version: 1 } },
    { session },
  )
  if (promoted.modifiedCount === 1)
    await notifyModeratorsSubmissionReady(batch.submissionId, session)
  return promoted
}

// Keeps provider spend in the ledger when the attempt's transition was rolled back.
async function recordLostCost(lease, cost, usage, sweep) {
  if (!(cost > 0)) return
  await ProcessingAttempt.updateOne(
    { _id: lease.attemptId },
    {
      $set: { responseMetadata: { runner: RUNNER_ID, costUsd: cost, ...(usage ? { usage } : {}) } },
    },
  )
  sweep.spentUsd += cost
}

/**
 * Embeds the passages of `revision` that have no artifact yet, in request groups below the
 * input and token caps. Calls `guard()` before every provider request. Returns unsaved
 * artifact documents; an error thrown after a billed request carries `partial` usage and cost.
 */
export async function prepareRevisionEmbeddings({
  revision,
  batchId,
  source = 'evidence-batch',
  authorAccountId,
  eligibilityStatus,
  ai,
  embed,
  guard = () => {},
}) {
  const passages = revisionPassages(revision)
  if (!passages.length) throw new StageError('no-text')
  const existing = await EmbeddingArtifact.find({
    revisionId: revision._id,
    model: ai.embeddingModel,
    chunkingVersion: CHUNKING_VERSION,
  })
    .select('passageId')
    .lean()
  const stored = new Set(existing.map(artifact => artifact.passageId))
  const missing = passages.filter(passage => !stored.has(passage.passageId))
  const groups = embeddingRequestBatches(missing.map(passage => passage.text))
  const vectors = []
  let dimensions
  let provider
  let promptTokens = 0
  let requests = 0
  const usage = () => ({ prompt_tokens: promptTokens, total_tokens: promptTokens })
  const spent = () => costUsd(ai.embeddingModel, { prompt_tokens: promptTokens }) ?? 0
  try {
    for (const group of groups) {
      guard()
      let response
      try {
        response = await embed(group.texts)
      } catch (error) {
        // A billed response the adapter rejected (e.g. a vector count mismatch) reports its usage.
        const billed = error?.metadata?.usage
        if (billed) {
          requests += 1
          promptTokens += billed.prompt_tokens ?? billed.total_tokens ?? 0
        }
        throw error
      }
      requests += 1
      promptTokens +=
        response.metadata?.usage?.prompt_tokens ?? response.metadata?.usage?.total_tokens ?? 0
      if (
        response.vectors?.length !== group.texts.length ||
        (dimensions !== undefined && response.dimensions !== dimensions)
      )
        throw new StageError('embedding-count-mismatch', { metadata: response.metadata })
      dimensions ??= response.dimensions
      provider ??= response.provider
      vectors.push(...response.vectors)
    }
  } catch (error) {
    if (error && typeof error === 'object')
      error.partial = { costUsd: spent(), usage: usage(), requests }
    throw error
  }
  const docs = missing.map((passage, index) => ({
    revisionId: revision._id,
    source,
    ...(source === 'evidence-batch' ? { batchId } : {}),
    model: ai.embeddingModel,
    dimensions,
    passageId: passage.passageId,
    passageOrder: passage.order,
    offsets: { start: passage.start, end: passage.end },
    textHash: digest(passage.text),
    authorAccountId,
    eligibilityStatus,
    vector: vectors[index],
    provider,
    status: 'stored',
    chunkingVersion: CHUNKING_VERSION,
  }))
  return {
    passages,
    docs,
    metadata: {
      model: ai.embeddingModel,
      usage: usage(),
      requests: groups.length,
      embedded: missing.length,
      reused: existing.length,
    },
    costUsd: spent(),
  }
}

/**
 * Revisions another author's passages may be compared with, keyed by revision id: current
 * published chapters of published stories and open chapter submissions.
 */
export async function eligibleSourceRevisions(submission) {
  const eligible = new Map()
  const stories = await Story.find({
    authorAccountId: { $ne: submission.authorAccountId },
    publicationStatus: 'published',
  })
    .select('_id authorAccountId')
    .lean()
  const storyAuthor = new Map(stories.map(story => [String(story._id), story.authorAccountId]))
  const chapters = await Chapter.find({
    status: 'published',
    publishedRevisionId: { $ne: null },
    storyId: { $in: stories.map(story => story._id) },
  })
    .select('_id storyId publishedRevisionId')
    .lean()
  for (const chapter of chapters) {
    eligible.set(String(chapter.publishedRevisionId), {
      chapterId: chapter._id,
      storyId: chapter.storyId,
      authorAccountId: storyAuthor.get(String(chapter.storyId)),
      origin: 'otherAuthor:published',
    })
  }
  const open = await PublicationSubmission.find({
    _id: { $ne: submission._id },
    chapterId: { $ne: null },
    status: { $in: OPEN_SUBMISSION_STATUSES },
    authorAccountId: { $ne: submission.authorAccountId },
  })
    .select('revisionId chapterId storyId authorAccountId')
    .lean()
  for (const row of open) {
    if (eligible.has(String(row.revisionId))) continue
    eligible.set(String(row.revisionId), {
      chapterId: row.chapterId,
      storyId: row.storyId,
      authorAccountId: row.authorAccountId,
      origin: 'otherAuthor:pending',
    })
  }
  return eligible
}

async function submittedRevision(batch) {
  const revision = await ContentRevision.findById(batch.revisionId).lean()
  if (!revision?.immutableAt || revision.packageDigest !== batch.packageDigest)
    throw new StageError('revision-unavailable')
  return revision
}

async function embeddingStage({ config, providers, batch, guard }) {
  const revision = await submittedRevision(batch)
  const prepared = await prepareRevisionEmbeddings({
    revision,
    batchId: batch._id,
    authorAccountId: revision.authorAccountId,
    eligibilityStatus: 'submitted',
    ai: config.ai,
    embed: providers.embed,
    guard,
  })
  return {
    requestFingerprint: digest({
      stage: 'embedding',
      model: config.ai.embeddingModel,
      chunkingVersion: CHUNKING_VERSION,
      textHashes: prepared.passages.map(passage => digest(passage.text)),
    }),
    responseMetadata: prepared.metadata,
    costUsd: prepared.costUsd,
    write: session =>
      prepared.docs.length ? EmbeddingArtifact.insertMany(prepared.docs, { session }) : undefined,
  }
}

async function comparisonStage({ config, providers, batch, submission, now, guard }) {
  if (!submission.chapterId) {
    return {
      requestFingerprint: digest({ stage: 'comparison', skipped: 'story-metadata' }),
      responseMetadata: { skipped: 'story-metadata', findings: 0 },
      costUsd: 0,
      write: async () => {},
    }
  }
  const model = config.ai.embeddingModel
  const artifacts = await EmbeddingArtifact.find({
    revisionId: batch.revisionId,
    model,
    chunkingVersion: CHUNKING_VERSION,
  })
    .sort({ passageOrder: 1 })
    .lean()
  if (!artifacts.length) throw new StageError('embeddings-missing')
  const eligible = await eligibleSourceRevisions(submission)
  const eligibleIds = [...eligible.keys()].sort()
  guard()
  const results = await providers.findSimilar({
    queries: artifacts.map(artifact => ({
      passageId: artifact.passageId,
      vector: artifact.vector,
    })),
    eligibleRevisionIds: eligibleIds.map(id => new mongoose.Types.ObjectId(id)),
    model,
    chunkingVersion: CHUNKING_VERSION,
    limit: config.ai.similarityTopK,
  })
  // Sources can close while the search runs; only still-eligible passages become findings.
  const current = await eligibleSourceRevisions(submission)
  const submitter = String(submission.authorAccountId)
  const usable = hit =>
    current.has(hit.revisionId) &&
    String(current.get(hit.revisionId).authorAccountId) !== submitter &&
    String(hit.authorAccountId) !== submitter
  const sourceIds = [
    ...new Set(results.flatMap(result => result.hits.filter(usable).map(hit => hit.revisionId))),
  ]
  const [queryRevision, sources] = await Promise.all([
    ContentRevision.findById(batch.revisionId).lean(),
    ContentRevision.find({ _id: { $in: sourceIds } }).lean(),
  ])
  const byPassageId = revision =>
    new Map(revisionPassages(revision).map(passage => [passage.passageId, passage]))
  const queryPassages = queryRevision ? byPassageId(queryRevision) : new Map()
  const sourcePassages = new Map(
    sources.map(revision => [String(revision._id), byPassageId(revision)]),
  )
  const docs = []
  let hits = 0
  for (const result of results) {
    hits += result.hits.length
    const queryPassage = queryPassages.get(result.queryPassageId)
    let rank = 0
    for (const hit of result.hits) {
      const sourcePassage = usable(hit) && sourcePassages.get(hit.revisionId)?.get(hit.passageId)
      if (!sourcePassage || !queryPassage) continue
      rank += 1
      const source = current.get(hit.revisionId)
      const score = clamp01(hit.score)
      docs.push({
        batchId: batch._id,
        revisionId: batch.revisionId,
        sourceChapterId: source.chapterId,
        sourceRevisionId: new mongoose.Types.ObjectId(hit.revisionId),
        sourceAuthorAccountId: source.authorAccountId,
        queryPassageId: result.queryPassageId,
        sourcePassageId: hit.passageId,
        rank,
        score,
        matchedSnippets: [
          {
            queryText: queryPassage.text.slice(0, SNIPPET_CHARS),
            sourceText: sourcePassage.text.slice(0, SNIPPET_CHARS),
          },
        ],
        evidenceHash: digest({
          queryPassageId: result.queryPassageId,
          sourceRevisionId: hit.revisionId,
          sourcePassageId: hit.passageId,
          score,
        }),
        occurredAt: now,
      })
    }
  }
  return {
    requestFingerprint: digest({
      stage: 'comparison',
      queries: artifacts.map(artifact => artifact.passageId + ':' + artifact.textHash),
      eligible: eligibleIds,
      topK: config.ai.similarityTopK,
    }),
    responseMetadata: {
      queries: artifacts.length,
      eligibleRevisions: eligibleIds.length,
      hits,
      findings: docs.length,
    },
    costUsd: 0,
    write: session => (docs.length ? SimilarityFinding.insertMany(docs, { session }) : undefined),
  }
}

async function llmStage({ config, providers, batch, submission, now, guard }) {
  const revision = await submittedRevision(batch)
  const rights = revision.rightsDeclarationId
    ? await RightsDeclaration.findById(revision.rightsDeclarationId).lean()
    : null
  if (!rights) throw new StageError('rights-unavailable')
  const findings = await SimilarityFinding.find({ batchId: batch._id })
    .sort({ score: -1, rank: 1 })
    .limit(MAX_REVIEW_FINDINGS)
    .lean()
  // Never send a passage whose source closed or was unpublished after comparison.
  const eligible = await eligibleSourceRevisions(submission)
  const kept = findings.filter(finding => eligible.has(String(finding.sourceRevisionId)))
  const dropped = findings.filter(finding => !eligible.has(String(finding.sourceRevisionId)))
  const chapters = await Chapter.find({
    _id: { $in: kept.map(finding => finding.sourceChapterId) },
  })
    .select('title storyId')
    .lean()
  const stories = await Story.find({ _id: { $in: chapters.map(chapter => chapter.storyId) } })
    .select('title')
    .lean()
  const chapterById = new Map(chapters.map(chapter => [String(chapter._id), chapter]))
  const storyById = new Map(stories.map(story => [String(story._id), story]))
  const text =
    revision.contentType === 'story'
      ? [revision.content?.title, revision.content?.description].join('\n')
      : chapterTextProjection(revision).join('\n')
  const keptIds = kept.map(finding => String(finding._id))
  const input = buildReviewInput({
    submissionType: submission.chapterId ? 'chapter' : 'story',
    title: revision.content?.title ?? '',
    text,
    rights: rightsFacts(rights),
    findings: kept.map(finding => {
      const chapter = chapterById.get(String(finding.sourceChapterId))
      return {
        findingId: String(finding._id),
        score: finding.score,
        rank: finding.rank,
        queryText: finding.matchedSnippets?.[0]?.queryText ?? '',
        sourceText: finding.matchedSnippets?.[0]?.sourceText ?? '',
        origin: eligible.get(String(finding.sourceRevisionId)).origin,
        sourceStoryTitle: storyById.get(String(chapter?.storyId))?.title ?? '',
        sourceChapterTitle: chapter?.title ?? '',
      }
    }),
  })
  const inputFingerprint = digest({
    criteriaVersion: REVIEW_CRITERIA_VERSION,
    model: config.ai.reviewModel,
    packageDigest: batch.packageDigest,
    findingIds: keptIds,
  })
  guard()
  const { output, provider, metadata } = await providers.review({
    instructions: REVIEW_INSTRUCTIONS,
    input,
    schemaName: REVIEW_SCHEMA_NAME,
    schema: REVIEW_OUTPUT_SCHEMA,
    maxOutputTokens: MAX_REVIEW_OUTPUT_TOKENS,
  })
  const parsed = reviewOutput.safeParse(output)
  if (!parsed.success) throw new StageError('llm-output-invalid', { metadata })
  const keptIdSet = new Set(keptIds)
  const assessments = parsed.data.findingAssessments.filter(item => keptIdSet.has(item.findingId))
  const evidenceRefs = [
    ...assessments,
    ...(dropped.length
      ? [{ droppedIneligibleFindings: dropped.map(finding => String(finding._id)) }]
      : []),
  ]
  return {
    requestFingerprint: inputFingerprint,
    responseMetadata: metadata,
    costUsd: costUsd(config.ai.reviewModel, metadata?.usage) ?? 0,
    write: session =>
      LlmReview.create(
        [
          {
            batchId: batch._id,
            revisionId: batch.revisionId,
            status: 'succeeded',
            criteriaVersion: REVIEW_CRITERIA_VERSION,
            inputFingerprint,
            summary: parsed.data.summary,
            riskLevel: parsed.data.riskLevel,
            riskReasons: parsed.data.riskReasons,
            suggestions: parsed.data.suggestions,
            evidenceRefs,
            reviewedChars: Math.min(text.length, MAX_REVIEW_TEXT_CHARS),
            totalChars: text.length,
            provider,
            providerResponseRef: metadata?.responseId,
            completedAt: now,
          },
        ],
        { session },
      ),
  }
}

const STAGES = { embedding: embeddingStage, comparison: comparisonStage, llm: llmStage }

async function completeStage(config, batch, lease, stage, attemptNumber, result, now, sweep) {
  const cost = result.costUsd ?? 0
  try {
    await withTransaction(async session => {
      await result.write(session)
      const attempt = await ProcessingAttempt.updateOne(
        { _id: lease.attemptId, status: 'started' },
        {
          $set: {
            status: 'succeeded',
            finishedAt: now,
            requestFingerprint: result.requestFingerprint,
            responseMetadata: { ...result.responseMetadata, runner: RUNNER_ID, costUsd: cost },
          },
          $inc: { version: 1 },
        },
        { session },
      )
      if (attempt.modifiedCount !== 1) throw new LeaseLost()
      const moved = await EvidenceBatch.updateOne(
        { _id: batch._id, version: lease.batchVersion, activeLeaseId: lease.leaseId },
        {
          $set: {
            status: NEXT_STATUS[stage],
            ...(stage === 'llm' ? { outputSchemaVersion: REVIEW_CRITERIA_VERSION } : {}),
          },
          $unset: { activeLeaseId: 1 },
          $inc: { version: 1 },
        },
        { session },
      )
      if (moved.modifiedCount !== 1) throw new LeaseLost()
      if (stage === 'llm') await promoteSubmission(batch, session)
    })
  } catch (error) {
    // A late result after losing the lease is discarded; its spend stays in the ledger.
    if (error instanceof LeaseLost) {
      await recordLostCost(lease, cost, result.responseMetadata?.usage, sweep)
      return 'skipped'
    }
    const persistError = new StageError('persist-error', {
      retryable: attemptNumber < PERSIST_ERROR_ATTEMPTS,
      cause: error,
      metadata: result.responseMetadata,
    })
    persistError.partial = { costUsd: cost, usage: result.responseMetadata?.usage }
    return failStage(config, batch, lease, stage, attemptNumber, persistError, now, sweep)
  }
  sweep.spentUsd += cost
  return stage === 'llm' ? 'completed' : 'advanced'
}

async function failStage(config, batch, lease, stage, attemptNumber, error, now, sweep) {
  const stageError =
    error instanceof StageError ? error : new StageError('stage-error', { cause: error })
  if (!(error instanceof StageError))
    config.logger?.error({ err: error, batchId: String(batch._id), stage }, 'Evidence stage failed')
  const terminal = !stageError.retryable || attemptNumber >= MAX_STAGE_ATTEMPTS
  const partial = error?.partial
  const usage = partial?.usage ?? stageError.metadata?.usage
  const cost =
    stage === 'comparison'
      ? 0
      : (partial?.costUsd ??
        costUsd(
          stage === 'llm' ? config.ai.reviewModel : config.ai.embeddingModel,
          stageError.metadata?.usage,
        ) ??
        0)
  try {
    await withTransaction(async session => {
      const attempt = await ProcessingAttempt.updateOne(
        { _id: lease.attemptId, status: 'started' },
        {
          $set: {
            status: 'failed',
            failureCode: stageError.code,
            finishedAt: now,
            responseMetadata: {
              ...(stageError.metadata ?? {}),
              ...(usage ? { usage } : {}),
              runner: RUNNER_ID,
              costUsd: cost,
            },
          },
          $inc: { version: 1 },
        },
        { session },
      )
      if (attempt.modifiedCount !== 1) throw new LeaseLost()
      const released = await EvidenceBatch.updateOne(
        { _id: batch._id, version: lease.batchVersion, activeLeaseId: lease.leaseId },
        {
          $unset: { activeLeaseId: 1 },
          $inc: { version: 1 },
          ...(terminal ? { $set: { status: 'failed', failedStage: stage } } : {}),
        },
        { session },
      )
      if (released.modifiedCount !== 1) throw new LeaseLost()
      if (terminal) await promoteSubmission(batch, session)
    })
  } catch (txError) {
    if (txError instanceof LeaseLost) {
      await recordLostCost(lease, cost, usage, sweep)
      return 'skipped'
    }
    throw txError
  }
  sweep.spentUsd += cost
  return terminal ? 'failed' : 'retrying'
}

// Gives back a claim whose lease is too close to expiry; spend so far stays on the stale attempt.
// The last allowed attempt fails the batch to manual review, as expired-lease recovery does.
async function releaseLease(batch, lease, stage, attemptNumber, error, clock, sweep) {
  const cost = error.partial?.costUsd ?? 0
  const usage = error.partial?.usage
  const terminal = attemptNumber >= MAX_STAGE_ATTEMPTS
  try {
    await withTransaction(async session => {
      const attempt = await ProcessingAttempt.updateOne(
        { _id: lease.attemptId, status: 'started' },
        {
          $set: {
            status: 'stale',
            staleAt: new Date(clock()),
            responseMetadata: { runner: RUNNER_ID, costUsd: cost, ...(usage ? { usage } : {}) },
          },
          $inc: { version: 1 },
        },
        { session },
      )
      if (attempt.modifiedCount !== 1) throw new LeaseLost()
      const released = await EvidenceBatch.updateOne(
        { _id: batch._id, version: lease.batchVersion, activeLeaseId: lease.leaseId },
        {
          $unset: { activeLeaseId: 1 },
          $inc: { version: 1 },
          ...(terminal ? { $set: { status: 'failed', failedStage: stage } } : {}),
        },
        { session },
      )
      if (released.modifiedCount !== 1) throw new LeaseLost()
      if (terminal) await promoteSubmission(batch, session)
    })
  } catch (txError) {
    if (!(txError instanceof LeaseLost)) throw txError
    await recordLostCost(lease, cost, usage, sweep)
    return 'skipped'
  }
  sweep.spentUsd += cost
  return terminal ? 'failed' : 'skipped'
}

// Marks an expired lease stale; after the last attempt the batch fails to manual review.
async function recoverExpiredLease(batch, stage, active, now) {
  const terminal = (active?.claimVersion ?? 0) >= MAX_STAGE_ATTEMPTS
  try {
    await withTransaction(async session => {
      if (active && ['claimed', 'started'].includes(active.status)) {
        await ProcessingAttempt.updateOne(
          { _id: active._id, status: active.status },
          { $set: { status: 'stale', staleAt: now }, $inc: { version: 1 } },
          { session },
        )
      }
      const released = await EvidenceBatch.updateOne(
        { _id: batch._id, version: batch.version, activeLeaseId: batch.activeLeaseId },
        {
          $unset: { activeLeaseId: 1 },
          $inc: { version: 1 },
          ...(terminal ? { $set: { status: 'failed', failedStage: stage } } : {}),
        },
        { session },
      )
      if (released.modifiedCount !== 1) throw new LeaseLost()
      if (terminal) await promoteSubmission(batch, session)
    })
  } catch (error) {
    if (error instanceof LeaseLost) return 'skipped'
    throw error
  }
  return terminal ? 'failed' : 'recovered'
}

async function claimStage(config, batch, submission, stage, attemptNumber, previous, now, clock) {
  const attemptKey = batch._id + ':' + stage + ':' + attemptNumber
  try {
    return await withTransaction(async session => {
      const fresh = await PublicationSubmission.findById(submission._id).session(session).lean()
      const author = await Account.findById(submission.authorAccountId)
        .select('status')
        .session(session)
        .lean()
      // Resumes after reinstatement: nothing is written for an inactive author.
      if (author?.status !== 'active') return { outcome: 'skipped' }
      if (
        fresh?.status !== 'validated' ||
        String(fresh.currentEvidenceBatchId) !== String(batch._id)
      ) {
        await ProcessingAttempt.create(
          [
            {
              batchId: batch._id,
              revisionId: batch.revisionId,
              stage,
              attemptKey,
              claimVersion: attemptNumber,
              provider: PROVIDER_BY_STAGE[stage],
              status: 'failed',
              failureCode: 'submission-closed',
              startedAt: now,
              finishedAt: now,
              responseMetadata: { runner: RUNNER_ID, costUsd: 0 },
            },
          ],
          { session },
        )
        const closed = await EvidenceBatch.updateOne(
          { _id: batch._id, version: batch.version, activeLeaseId: null },
          { $set: { status: 'failed', failedStage: stage }, $inc: { version: 1 } },
          { session },
        )
        if (closed.modifiedCount !== 1) throw new LeaseLost()
        return { outcome: 'failed' }
      }
      const leaseId = randomUUID()
      const expiresAt = new Date(clock() + leaseMs(config))
      const [attempt] = await ProcessingAttempt.create(
        [
          {
            batchId: batch._id,
            revisionId: batch.revisionId,
            stage,
            attemptKey,
            leaseId,
            claimVersion: attemptNumber,
            leaseExpiresAt: expiresAt,
            provider: PROVIDER_BY_STAGE[stage],
            status: 'claimed',
            responseMetadata: { runner: RUNNER_ID },
            ...(previous ? { retryOf: previous._id } : {}),
          },
        ],
        { session },
      )
      const claimed = await EvidenceBatch.updateOne(
        { _id: batch._id, version: batch.version, activeLeaseId: null, status: batch.status },
        { $set: { activeLeaseId: leaseId, stage }, $inc: { version: 1 } },
        { session },
      )
      if (claimed.modifiedCount !== 1) throw new LeaseLost()
      return {
        lease: { attemptId: attempt._id, leaseId, batchVersion: batch.version + 1, expiresAt },
      }
    })
  } catch (error) {
    if (error instanceof LeaseLost || error?.code === 11000) return { outcome: 'skipped' }
    throw error
  }
}

async function advanceBatch(config, providers, submission, now, sweep, clock) {
  let batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId).lean()
  if (!batch) return 'skipped'
  if (terminalEvidenceReady(batch)) {
    await withTransaction(session => promoteSubmission(batch, session))
    return batch.status === 'failed' ? 'failed' : 'completed'
  }
  let stage = STAGE_BY_STATUS[batch.status]
  if (!stage) return 'skipped'
  if (batch.activeLeaseId) {
    const active = await ProcessingAttempt.findOne({
      batchId: batch._id,
      leaseId: batch.activeLeaseId,
    }).lean()
    if (active && active.leaseExpiresAt > now) return 'skipped'
    const recovered = await recoverExpiredLease(batch, stage, active, now)
    if (recovered !== 'recovered') return recovered
    batch = await EvidenceBatch.findById(batch._id).lean()
    stage = STAGE_BY_STATUS[batch?.status]
    if (!stage || batch.activeLeaseId) return 'skipped'
  }
  const previous = await ProcessingAttempt.findOne({ batchId: batch._id, stage })
    .sort({ claimVersion: -1 })
    .lean()
  const attemptNumber = (previous?.claimVersion ?? 0) + 1
  if (
    previous?.status === 'failed' &&
    now.getTime() < (previous.finishedAt?.getTime() ?? 0) + RETRY_BASE_MS * 2 ** (attemptNumber - 2)
  )
    return 'skipped'
  if (stage !== 'comparison') {
    const stageCost = await worstCaseStageCostUsd(config, stage, batch)
    if (stageCost === null) {
      if (!sweep.pricingLogged) {
        sweep.pricingLogged = true
        config.logger?.warn(
          { model: stage === 'llm' ? config.ai.reviewModel : config.ai.embeddingModel },
          'ai pricing unknown; provider stages paused',
        )
      }
      return 'budget-blocked'
    }
    if (sweep.spentUsd + stageCost >= config.ai.budgetUsd) {
      if (!sweep.budgetLogged) {
        sweep.budgetLogged = true
        config.logger?.warn(
          { spentUsd: sweep.spentUsd, budgetUsd: config.ai.budgetUsd },
          'ai budget exhausted',
        )
      }
      return 'budget-blocked'
    }
  }
  const claimed = await claimStage(
    config,
    batch,
    submission,
    stage,
    attemptNumber,
    previous,
    now,
    clock,
  )
  if (!claimed.lease) return claimed.outcome
  const { lease } = claimed
  const started = await ProcessingAttempt.updateOne(
    { _id: lease.attemptId, status: 'claimed' },
    { $set: { status: 'started', startedAt: new Date(clock()) }, $inc: { version: 1 } },
  )
  if (started.modifiedCount !== 1) return 'skipped'
  const guard = () => {
    if (clock() >= lease.expiresAt.getTime() - config.ai.timeoutMs) throw new LeaseExpiring()
  }
  let result
  try {
    result = await STAGES[stage]({ config, providers, batch, submission, now, guard })
  } catch (error) {
    if (error instanceof LeaseExpiring)
      return releaseLease(batch, lease, stage, attemptNumber, error, clock, sweep)
    return failStage(config, batch, lease, stage, attemptNumber, error, now, sweep)
  }
  return completeStage(config, batch, lease, stage, attemptNumber, result, now, sweep)
}

/**
 * One evidence sweep: advances up to SWEEP_LIMIT validated submissions of active authors by up
 * to three stages each. Every provider call follows a persisted claim, a budget gate and a
 * lease guard; one failing candidate never stops the sweep.
 */
export async function processEvidenceBatches(
  config,
  { now = new Date(), providers = resolveAiProviders(config.ai), clock = () => Date.now() } = {},
) {
  const counters = {
    advanced: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
    budgetBlocked: 0,
    errors: 0,
  }
  const inactive = await Account.distinct('_id', { status: { $ne: 'active' } })
  const candidates = await PublicationSubmission.find({
    status: 'validated',
    currentEvidenceBatchId: { $ne: null },
    authorAccountId: { $nin: inactive },
  })
    .sort({ submittedAt: 1, _id: 1 })
    .limit(SWEEP_LIMIT)
    .lean()
  const sweep = { spentUsd: await spentUsd(config), budgetLogged: false, pricingLogged: false }
  for (const candidate of candidates) {
    try {
      for (let step = 0; step < 3; step += 1) {
        const outcome = await advanceBatch(config, providers, candidate, now, sweep, clock)
        counters[OUTCOME_COUNTERS[outcome]] += 1
        if (outcome !== 'advanced') break
      }
    } catch (error) {
      counters.errors += 1
      config.logger?.error(
        { err: error, submissionId: String(candidate._id) },
        'Evidence sweep candidate failed',
      )
    }
  }
  return counters
}

/** Starts the periodic evidence sweep; refuses to start without an OpenAI key or test double. */
export function startEvidenceWorker(
  config,
  logger,
  { intervalMs = config.ai.intervalSeconds * 1000 } = {},
) {
  if (!config.ai.openai && !config.ai.embed) {
    logger.warn('AI evidence worker not started: OPENAI_API_KEY is not set')
    return async () => {}
  }
  const providers = resolveAiProviders(config.ai)
  let stopped = false
  let running
  const tick = () => {
    if (stopped || running) return
    running = processEvidenceBatches(config, { providers })
      .catch(error => {
        logger.error({ err: error }, 'AI evidence worker sweep failed')
      })
      .finally(() => {
        running = undefined
      })
  }
  const timer = setInterval(tick, intervalMs)
  timer.unref()
  tick()
  logger.info({ runner: RUNNER_ID }, 'AI evidence worker started')
  return async () => {
    stopped = true
    clearInterval(timer)
    await running
  }
}
