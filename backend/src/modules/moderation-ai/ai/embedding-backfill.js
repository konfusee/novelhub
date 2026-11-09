import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { withTransaction } from '../../../db/connection.js'
import { Chapter, ContentRevision, EmbeddingArtifact, Story } from '../../../models/index.js'
import { spentUsd } from './budget.js'
import { CHUNKING_VERSION, revisionPassages } from './chunking.js'
import { prepareRevisionEmbeddings } from './evidence-worker.js'
import { estimateTokens, priceFor } from './pricing.js'
import { resolveAiProviders } from './providers.js'

/**
 * Current published revisions of published chapters of published stories that have no
 * artifact for the configured model and chunking version, oldest story order first.
 */
export async function selectBackfillCandidates(config, { limit }) {
  const storyIds = await Story.distinct('_id', { publicationStatus: 'published' })
  const [result] = await Chapter.aggregate([
    {
      $match: {
        status: 'published',
        publishedRevisionId: { $ne: null },
        storyId: { $in: storyIds },
      },
    },
    {
      $lookup: {
        from: 'embeddingArtifacts',
        let: { rev: '$publishedRevisionId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$revisionId', '$$rev'] },
              model: config.ai.embeddingModel,
              chunkingVersion: CHUNKING_VERSION,
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'existing',
      },
    },
    { $match: { existing: { $size: 0 } } },
    { $sort: { storyId: 1, orderKey: 1, _id: 1 } },
    {
      $facet: {
        page: [{ $limit: limit }, { $project: { storyId: 1, publishedRevisionId: 1 } }],
        total: [{ $count: 'n' }],
      },
    },
  ])
  const page = result?.page ?? []
  return { candidates: page, remaining: (result?.total[0]?.n ?? 0) - page.length }
}

// Loads each planned revision with its story's author and estimates its embedding cost.
async function estimateRevisions(config, revisionIds) {
  const price = priceFor(config.ai.embeddingModel)
  if (!price) throw new Error('No price is known for ' + config.ai.embeddingModel)
  const revisions = await ContentRevision.find({ _id: { $in: revisionIds } }).lean()
  const stories = await Story.find({ _id: { $in: revisions.map(revision => revision.storyId) } })
    .select('authorAccountId')
    .lean()
  const authorByStory = new Map(stories.map(story => [String(story._id), story.authorAccountId]))
  const byId = new Map(revisions.map(revision => [String(revision._id), revision]))
  const items = []
  let passages = 0
  let estimatedTokens = 0
  for (const id of revisionIds.map(String)) {
    const revision = byId.get(id)
    if (!revision) continue
    const revisionPassageList = revisionPassages(revision)
    passages += revisionPassageList.length
    estimatedTokens += revisionPassageList.reduce(
      (sum, passage) => sum + estimateTokens(passage.text.length),
      0,
    )
    items.push({ revision, authorAccountId: authorByStory.get(String(revision.storyId)) })
  }
  return { items, passages, estimatedTokens, estimatedUsd: (estimatedTokens * price.input) / 1e6 }
}

function assertWithinCap(estimatedUsd, maxUsd) {
  if (estimatedUsd > maxUsd)
    throw new Error(
      'Estimated cost $' +
        estimatedUsd.toFixed(4) +
        ' exceeds the cap $' +
        maxUsd +
        '; lower --max-revisions or raise --max-usd',
    )
}

const OBJECT_ID = /^[a-f\d]{24}$/i

/**
 * Embeds published chapters that have no similarity source yet. A dry run writes a plan file
 * and touches nothing else; a real run embeds exactly the still-valid planned revisions, each in
 * its own transaction, after the cost cap and the AI budget are checked, and stops at the first
 * failed revision. The summary reports known provider usage separately from persisted spend.
 */
export async function backfillEmbeddings(
  config,
  {
    dryRun = true,
    plan,
    planPath,
    maxUsd = 0.5,
    maxRevisions = 500,
    providers = resolveAiProviders(config.ai),
    log = console.log,
  } = {},
) {
  if (!Number.isFinite(maxUsd) || maxUsd < 0) throw new Error('Invalid --max-usd')
  if (!Number.isInteger(maxRevisions) || maxRevisions < 1)
    throw new Error('Invalid --max-revisions')
  const model = config.ai.embeddingModel
  const skipped = { hasArtifacts: 0, notCandidate: 0 }
  if (dryRun) {
    const { candidates, remaining } = await selectBackfillCandidates(config, {
      limit: maxRevisions,
    })
    const estimate = await estimateRevisions(
      config,
      candidates.map(candidate => candidate.publishedRevisionId),
    )
    log(
      `Backfill plan: ${candidates.length} revisions, ${estimate.passages} passages, ~${estimate.estimatedTokens} tokens, ~$${estimate.estimatedUsd.toFixed(4)} (cap $${maxUsd}); ${remaining} more remain`,
    )
    assertWithinCap(estimate.estimatedUsd, maxUsd)
    await mkdir(path.dirname(planPath), { recursive: true })
    await writeFile(
      planPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          model,
          chunkingVersion: CHUNKING_VERSION,
          maxUsd,
          estimatedUsd: estimate.estimatedUsd,
          revisionIds: candidates.map(candidate => String(candidate.publishedRevisionId)),
        },
        null,
        2,
      ),
    )
    log(`Plan written to ${planPath}`)
    log('DRY RUN: nothing was embedded or written to the database.')
    return {
      candidates,
      remaining,
      passages: estimate.passages,
      estimatedTokens: estimate.estimatedTokens,
      estimatedUsd: estimate.estimatedUsd,
      skipped,
      failures: 0,
      stopped: false,
      embeddedRevisions: 0,
      providerUsageTokens: 0,
      providerUsageUsd: 0,
      persistedUsageTokens: 0,
      persistedUsageUsd: 0,
    }
  }
  if (!plan) throw new Error('A real run needs --plan from a dry run')
  if (plan.model !== model || plan.chunkingVersion !== CHUNKING_VERSION)
    throw new Error('The plan was made for another model or chunking version')
  if (!Array.isArray(plan.revisionIds) || !plan.revisionIds.every(id => OBJECT_ID.test(id)))
    throw new Error('The plan has no valid revisionIds')
  const storyIds = await Story.distinct('_id', { publicationStatus: 'published' })
  const candidates = []
  for (const id of plan.revisionIds) {
    const revisionId = new mongoose.Types.ObjectId(id)
    const chapter = await Chapter.exists({
      status: 'published',
      publishedRevisionId: revisionId,
      storyId: { $in: storyIds },
    })
    const embedded =
      chapter &&
      (await EmbeddingArtifact.exists({ revisionId, model, chunkingVersion: CHUNKING_VERSION }))
    if (!chapter || embedded) skipped.notCandidate += 1
    else candidates.push(revisionId)
  }
  const estimate = await estimateRevisions(config, candidates)
  log(
    `Backfill plan: ${candidates.length} revisions, ${estimate.passages} passages, ~${estimate.estimatedTokens} tokens, ~$${estimate.estimatedUsd.toFixed(4)} (cap $${maxUsd}); ${skipped.notCandidate} planned revisions are no longer candidates`,
  )
  assertWithinCap(estimate.estimatedUsd, maxUsd)
  // A plan with nothing left to embed costs nothing: it is a valid no-op even on a spent budget.
  if (estimate.estimatedUsd > 0) {
    const spent = await spentUsd(config)
    if (spent + estimate.estimatedUsd >= config.ai.budgetUsd)
      throw new Error(
        'AI budget would be exceeded: spent $' + spent + ' of $' + config.ai.budgetUsd,
      )
  }
  // Provider usage counts every known billed request, persisted or not (partial failures,
  // duplicate-key races); persisted usage is what the artifacts record in the budget ledger.
  const provider = { tokens: 0, usd: 0 }
  const persisted = { tokens: 0, usd: 0 }
  let failures = 0
  let embeddedRevisions = 0
  let embeddedPassages = 0
  for (const { revision, authorAccountId } of estimate.items) {
    let prepared
    try {
      prepared = await prepareRevisionEmbeddings({
        revision,
        source: 'backfill',
        authorAccountId,
        eligibilityStatus: 'published',
        ai: config.ai,
        embed: providers.embed,
      })
      provider.tokens += prepared.metadata.usage.prompt_tokens
      provider.usd += prepared.costUsd
      const share = prepared.docs.length ? prepared.costUsd / prepared.docs.length : 0
      await withTransaction(session =>
        EmbeddingArtifact.insertMany(
          prepared.docs.map(doc => ({ ...doc, costUsd: share })),
          { session },
        ),
      )
    } catch (error) {
      if (!prepared) {
        provider.tokens += error?.partial?.usage?.prompt_tokens ?? 0
        provider.usd += error?.partial?.costUsd ?? 0
      }
      if (prepared && error?.code === 11000) {
        skipped.hasArtifacts += 1
        continue
      }
      // Stop paying for more requests until the operator has looked at the failure.
      failures += 1
      log(`Backfill failed for revision ${revision._id}: ${error?.code ?? error?.message}`)
      log(
        'Backfill stopped after a failure; reconcile provider-side usage before another paid run.',
      )
      break
    }
    embeddedRevisions += 1
    embeddedPassages += prepared.docs.length
    persisted.tokens += prepared.metadata.usage.prompt_tokens
    persisted.usd += prepared.costUsd
  }
  log(
    `Embedded ${embeddedRevisions} revisions (${embeddedPassages} passages, ~$${persisted.usd.toFixed(4)} recorded in the budget ledger); provider usage ${provider.tokens} tokens (~$${provider.usd.toFixed(4)}); ${failures} failed`,
  )
  const after = await selectBackfillCandidates(config, { limit: 1 })
  return {
    candidates,
    remaining: after.candidates.length + after.remaining,
    passages: estimate.passages,
    estimatedTokens: estimate.estimatedTokens,
    estimatedUsd: estimate.estimatedUsd,
    skipped,
    failures,
    stopped: failures > 0,
    embeddedRevisions,
    providerUsageTokens: provider.tokens,
    providerUsageUsd: provider.usd,
    persistedUsageTokens: persisted.tokens,
    persistedUsageUsd: persisted.usd,
  }
}

/** One stable CLI line with the usage fields of a summary; it holds no configuration value. */
export function backfillSummaryLine(summary) {
  return (
    'Backfill summary: ' +
    JSON.stringify({
      providerUsageTokens: summary.providerUsageTokens,
      providerUsageUsd: summary.providerUsageUsd,
      persistedUsageTokens: summary.persistedUsageTokens,
      persistedUsageUsd: summary.persistedUsageUsd,
      stopped: summary.stopped,
      failures: summary.failures,
    })
  )
}
