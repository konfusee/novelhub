import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Chapter,
  ContentRevision,
  EmbeddingArtifact,
  PublicationSubmission,
  Story,
} from '../src/models/index.js'
import { spentUsd } from '../src/modules/moderation-ai/ai/budget.js'
import {
  backfillEmbeddings,
  backfillSummaryLine,
} from '../src/modules/moderation-ai/ai/embedding-backfill.js'
import { costUsd } from '../src/modules/moderation-ai/ai/pricing.js'
import { StageError } from '../src/modules/moderation-ai/ai/stage-error.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { apiClient, approvedStory, origin, submitChapter } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

// Injected embed double only: no test calls OpenAI.
useTestDatabase()
const config = testConfig({ cookieName: 'novelhub_session', corsOrigin: origin })
const api = apiClient(createApp(config))
const log = vi.fn()
let planDir
let planPath
beforeEach(() => {
  planDir = path.join(os.tmpdir(), 'novelhub-backfill-' + randomUUID())
  planPath = path.join(planDir, 'plan.json')
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(planDir, { recursive: true, force: true })
})

const embedDouble = () =>
  vi.fn(async texts => ({
    vectors: texts.map((_, i) => [1, i + 1]),
    dimensions: 2,
    provider: 'test',
    metadata: { usage: { prompt_tokens: texts.length * 10, total_tokens: texts.length * 10 } },
  }))
const readPlan = async () => JSON.parse(await readFile(planPath, 'utf8'))

// Two published chapters of one published story: one went through a submission, one was
// published from a directly created immutable revision with no submission.
async function publishedChapters() {
  const moderator = await authenticatedAccount('moderator')
  const author = await authenticatedAccount('author')
  const { storyId } = await approvedStory(api, moderator, { author })
  const { chapterId, submissionId } = await submitChapter(api, {
    author,
    storyId,
    paragraphs: ['Chương đã xuất bản qua kiểm duyệt.'],
  })
  const submitted = (await PublicationSubmission.findById(submissionId)).revisionId
  await Chapter.updateOne(
    { _id: chapterId },
    { $set: { status: 'published', publishedRevisionId: submitted } },
  )
  await Story.updateOne({ _id: storyId }, { $set: { publicationStatus: 'published' } })
  const directChapterId = new mongoose.Types.ObjectId()
  const [direct] = await ContentRevision.create([
    {
      contentType: 'chapter',
      storyId,
      chapterId: directChapterId,
      authorAccountId: author.account._id,
      revisionNumber: 1,
      formatVersion: 'blocks-v1',
      content: {
        title: 'Chương cũ',
        blocks: [{ type: 'paragraph', text: 'Chương cũ chưa từng có gói gửi duyệt.' }],
      },
      status: 'immutable',
      immutableAt: new Date(),
    },
  ])
  await Chapter.create({
    _id: directChapterId,
    storyId,
    orderKey: 100,
    title: 'Chương cũ',
    status: 'published',
    publishedRevisionId: direct._id,
  })
  return { author, storyId, chapterId, revisionIds: [String(submitted), String(direct._id)] }
}

describe('embedding backfill', () => {
  it('plans every published chapter without embeddings and writes only the plan file on a dry run', async () => {
    const { revisionIds } = await publishedChapters()
    const embed = embedDouble()
    const summary = await backfillEmbeddings(config, {
      dryRun: true,
      planPath,
      providers: { embed },
      log,
    })
    expect(summary.candidates).toHaveLength(2)
    expect((await readPlan()).revisionIds.sort()).toEqual([...revisionIds].sort())
    expect(await EmbeddingArtifact.countDocuments()).toBe(0)
    expect(embed).not.toHaveBeenCalled()
  })

  it('embeds exactly the planned revisions as backfill artifacts with cost', async () => {
    const { author, revisionIds } = await publishedChapters()
    const embed = embedDouble()
    await backfillEmbeddings(config, { dryRun: true, planPath, providers: { embed }, log })
    const summary = await backfillEmbeddings(config, {
      dryRun: false,
      plan: await readPlan(),
      providers: { embed },
      log,
    })
    expect(summary.embeddedRevisions).toBe(2)
    expect(summary.persistedUsageUsd).toBeGreaterThan(0)
    expect(summary.providerUsageUsd).toBe(summary.persistedUsageUsd)
    expect(summary.providerUsageTokens).toBe(summary.persistedUsageTokens)
    const artifacts = await EmbeddingArtifact.find().lean()
    expect(new Set(artifacts.map(artifact => String(artifact.revisionId)))).toEqual(
      new Set(revisionIds),
    )
    for (const artifact of artifacts) {
      expect(artifact.source).toBe('backfill')
      expect(artifact.batchId).toBeUndefined()
      expect(artifact.eligibilityStatus).toBe('published')
      expect(String(artifact.authorAccountId)).toBe(String(author.account._id))
    }
    const stored = artifacts.reduce((sum, artifact) => sum + artifact.costUsd, 0)
    expect(stored).toBeCloseTo(summary.persistedUsageUsd, 12)
    expect(await spentUsd(config)).toBeCloseTo(summary.persistedUsageUsd, 12)
    const next = await backfillEmbeddings(config, {
      dryRun: true,
      planPath,
      providers: { embed },
      log,
    })
    expect(next.candidates).toHaveLength(0)
    expect(next.remaining).toBe(0)
  })

  it('refuses to run above the cost cap or the AI budget before calling the provider', async () => {
    await publishedChapters()
    const embed = embedDouble()
    await expect(
      backfillEmbeddings(config, { dryRun: true, planPath, maxUsd: 0, providers: { embed }, log }),
    ).rejects.toThrow(/exceeds the cap/)
    await backfillEmbeddings(config, { dryRun: true, planPath, providers: { embed }, log })
    const broke = { ...config, ai: { ...config.ai, budgetUsd: 0 } }
    await expect(
      backfillEmbeddings(broke, {
        dryRun: false,
        plan: await readPlan(),
        providers: { embed },
        log,
      }),
    ).rejects.toThrow(/AI budget would be exceeded/)
    expect(embed).not.toHaveBeenCalled()
  })

  it('runs a zero-revision plan as a no-op even when the AI budget is exhausted', async () => {
    const embed = embedDouble()
    await backfillEmbeddings(config, { dryRun: true, planPath, providers: { embed }, log })
    const plan = await readPlan()
    expect(plan.revisionIds).toEqual([])
    const broke = { ...config, ai: { ...config.ai, budgetUsd: 0 } }
    const summary = await backfillEmbeddings(broke, {
      dryRun: false,
      plan,
      providers: { embed },
      log,
    })
    expect(summary.estimatedUsd).toBe(0)
    expect(summary.embeddedRevisions).toBe(0)
    expect(summary.stopped).toBe(false)
    expect(embed).not.toHaveBeenCalled()
    expect(await EmbeddingArtifact.countDocuments()).toBe(0)
  })

  it('selects past already embedded revisions instead of the same window', async () => {
    const { revisionIds } = await publishedChapters()
    const embed = embedDouble()
    const first = await backfillEmbeddings(config, {
      dryRun: true,
      planPath,
      maxRevisions: 1,
      providers: { embed },
      log,
    })
    expect(first.candidates).toHaveLength(1)
    expect(first.remaining).toBe(1)
    const firstPlan = await readPlan()
    await backfillEmbeddings(config, { dryRun: false, plan: firstPlan, providers: { embed }, log })
    const second = await backfillEmbeddings(config, {
      dryRun: true,
      planPath,
      maxRevisions: 1,
      providers: { embed },
      log,
    })
    expect(second.remaining).toBe(0)
    const secondPlan = await readPlan()
    expect(secondPlan.revisionIds).toHaveLength(1)
    expect(secondPlan.revisionIds[0]).not.toBe(firstPlan.revisionIds[0])
    expect([...firstPlan.revisionIds, ...secondPlan.revisionIds].sort()).toEqual(
      [...revisionIds].sort(),
    )
  })

  it('stops at the first failed revision and reports its known provider usage', async () => {
    await publishedChapters()
    const working = embedDouble()
    // A billed response the adapter rejected: its usage is known but nothing is persisted.
    const embed = vi.fn(async texts => {
      if (embed.mock.calls.length === 1)
        throw new StageError('embedding-count-mismatch', {
          metadata: { usage: { prompt_tokens: 40, total_tokens: 40 } },
        })
      return working(texts)
    })
    await backfillEmbeddings(config, { dryRun: true, planPath, providers: { embed }, log })
    const summary = await backfillEmbeddings(config, {
      dryRun: false,
      plan: await readPlan(),
      providers: { embed },
      log,
    })
    expect(summary.failures).toBe(1)
    expect(summary.stopped).toBe(true)
    expect(summary.embeddedRevisions).toBe(0)
    expect(embed).toHaveBeenCalledTimes(1)
    expect(await EmbeddingArtifact.countDocuments()).toBe(0)
    expect(summary.providerUsageTokens).toBe(40)
    expect(summary.providerUsageUsd).toBe(costUsd('text-embedding-3-small', { prompt_tokens: 40 }))
    expect(summary.persistedUsageUsd).toBe(0)
    expect(log).toHaveBeenCalledWith(
      'Backfill stopped after a failure; reconcile provider-side usage before another paid run.',
    )
    expect(backfillSummaryLine(summary)).toBe(
      'Backfill summary: ' +
        JSON.stringify({
          providerUsageTokens: 40,
          providerUsageUsd: summary.providerUsageUsd,
          persistedUsageTokens: 0,
          persistedUsageUsd: 0,
          stopped: true,
          failures: 1,
        }),
    )
  })

  it('counts provider usage of a duplicate-key race separately from persisted spend', async () => {
    const { revisionIds } = await publishedChapters()
    const embed = embedDouble()
    await backfillEmbeddings(config, { dryRun: true, planPath, providers: { embed }, log })
    const plan = await readPlan()
    vi.spyOn(EmbeddingArtifact, 'insertMany').mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: 11000 }),
    )
    const summary = await backfillEmbeddings(config, {
      dryRun: false,
      plan,
      providers: { embed },
      log,
    })
    expect(summary.skipped.hasArtifacts).toBe(1)
    expect(summary.failures).toBe(0)
    expect(summary.embeddedRevisions).toBe(1)
    expect(embed).toHaveBeenCalledTimes(2)
    expect(summary.providerUsageTokens).toBe(20)
    expect(summary.persistedUsageTokens).toBe(10)
    expect(summary.providerUsageUsd).toBeGreaterThan(summary.persistedUsageUsd)
    expect(await spentUsd(config)).toBeCloseTo(summary.persistedUsageUsd, 12)
    const embedded = await EmbeddingArtifact.distinct('revisionId')
    expect(embedded.map(String)).toEqual([plan.revisionIds[1]])
    expect(revisionIds).toContain(plan.revisionIds[1])
  })

  it('requires a dry-run plan and skips planned revisions that are no longer candidates', async () => {
    const { chapterId } = await publishedChapters()
    const embed = embedDouble()
    await expect(
      backfillEmbeddings(config, { dryRun: false, providers: { embed }, log }),
    ).rejects.toThrow(/needs --plan/)
    await backfillEmbeddings(config, {
      dryRun: true,
      planPath,
      maxRevisions: 1,
      providers: { embed },
      log,
    })
    const plan = await readPlan()
    expect(plan.revisionIds).toHaveLength(1)
    await Chapter.updateOne({ _id: chapterId }, { $set: { status: 'unpublished' } })
    const summary = await backfillEmbeddings(config, {
      dryRun: false,
      plan,
      providers: { embed },
      log,
    })
    expect(summary.skipped.notCandidate).toBe(1)
    expect(embed).not.toHaveBeenCalled()
  })
})
