import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import { afterEach, describe, expect, it } from 'vitest'
import { Category, ProcessingAttempt } from '../src/models/index.js'
import {
  moderationPreflight,
  preflightBlockers,
} from '../src/modules/moderation-ai/ai/rollout-preflight.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

// Read-only checks against the in-memory database; no test calls OpenAI.
useTestDatabase()
const config = testConfig()
let planDir
afterEach(async () => {
  if (planDir) await rm(planDir, { recursive: true, force: true })
  planDir = undefined
})

const ready = (facts = {}, backfillProblem = null) => ({
  facts: {
    openaiKey: true,
    freshLeaseRunners: [],
    backlogSubmissions: 0,
    backlogWorstCaseUsd: 0.5,
    backfillEstimatedUsd: 0.25,
    smokeWorstCaseUsd: 0.125,
    remainingUsd: 1,
    activeCategories: 1,
    ...facts,
  },
  backfillProblem,
})
const confirmed = { confirmSingleRunner: true }

async function documentCounts() {
  const collections = await mongoose.connection.db.collections()
  const counts = {}
  for (const collection of collections)
    counts[collection.collectionName] = await collection.countDocuments()
  return counts
}

describe('rollout preflight blockers', () => {
  it('passes when the worst case stays below the remaining budget', () => {
    expect(preflightBlockers(ready(), confirmed)).toEqual([])
  })

  it('blocks when the worst case exactly reaches the remaining budget', () => {
    expect(preflightBlockers(ready({ smokeWorstCaseUsd: 0.25 }), confirmed)).toEqual([
      'worst-case spend exceeds the remaining budget',
    ])
  })

  it('lists every other blocking reason', () => {
    expect(
      preflightBlockers(
        ready({
          openaiKey: false,
          freshLeaseRunners: ['other-host:7'],
          backlogSubmissions: 11,
          smokeWorstCaseUsd: null,
          activeCategories: 0,
        }),
        { confirmSingleRunner: false },
      ),
    ).toEqual([
      'OPENAI_API_KEY is not set',
      'operator has not confirmed a single runner',
      'another runner holds a fresh lease: other-host:7',
      'backlog above 10 submissions',
      'no price for the configured model',
      'no active category',
    ])
    expect(preflightBlockers(ready({}, 'over-budget'), confirmed)).toEqual([
      'backfill estimate exceeds the AI budget',
    ])
  })
})

describe('rollout preflight facts', () => {
  it('reports spend, leases and categories without writing to the database', async () => {
    const owner = new mongoose.Types.ObjectId()
    await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'ky ao ' + randomUUID(),
      createdBy: owner,
    })
    const lease = (runner, leaseExpiresAt) => ({
      batchId: new mongoose.Types.ObjectId(),
      revisionId: new mongoose.Types.ObjectId(),
      stage: 'embedding',
      attemptKey: randomUUID(),
      leaseId: randomUUID(),
      claimVersion: 1,
      leaseExpiresAt,
      status: 'started',
      responseMetadata: { runner },
    })
    const now = new Date()
    await ProcessingAttempt.create([
      lease('other-host:42', new Date(now.getTime() + 60000)),
      lease('stale-host:1', new Date(now.getTime() - 60000)),
    ])
    planDir = path.join(os.tmpdir(), 'novelhub-preflight-' + randomUUID())
    const before = await documentCounts()
    const result = await moderationPreflight(config, {
      now,
      planPath: path.join(planDir, 'plan.json'),
    })
    expect(await documentCounts()).toEqual(before)
    expect(result.backfillProblem).toBeNull()
    expect(result.facts).toMatchObject({
      nodeEnv: 'test',
      openaiKey: false,
      openaiKeySource: 'unset',
      workerEnabledInEnv: false,
      budgetUsd: config.ai.budgetUsd,
      spentUsd: 0,
      remainingUsd: config.ai.budgetUsd,
      backlogSubmissions: 0,
      backlogWorstCaseUsd: 0,
      backfillRevisions: 0,
      backfillEstimatedUsd: 0,
      freshLeaseRunners: ['other-host:42'],
      activeCategories: 1,
    })
    expect(result.facts.smokeWorstCaseUsd).toBeGreaterThan(0)
    expect(Object.keys(result.facts)).toEqual([
      'nodeEnv',
      'openaiKey',
      'openaiKeySource',
      'reviewModel',
      'embeddingModel',
      'workerEnabledInEnv',
      'budgetUsd',
      'spentUsd',
      'remainingUsd',
      'backlogSubmissions',
      'backlogWorstCaseUsd',
      'backfillRevisions',
      'backfillEstimatedUsd',
      'smokeWorstCaseUsd',
      'freshLeaseRunners',
      'activeCategories',
    ])
    expect(preflightBlockers(result, confirmed)).toEqual([
      'OPENAI_API_KEY is not set',
      'another runner holds a fresh lease: other-host:42',
    ])
  })
})
