import mongoose from 'mongoose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmbeddingArtifact } from '../src/models/index.js'
import {
  buildVectorSearchPipeline,
  createSimilaritySearch,
  syncVectorSearchIndex,
  vectorIndexDefinition,
} from '../src/modules/moderation-ai/ai/similarity-search.js'
import { testConfig } from './config.js'

// No database connection: index sync uses a fake Model and retrieval stops at the index check.
afterEach(() => vi.restoreAllMocks())

const name = 'embedding_vectors'
const definition = vectorIndexDefinition()
const revisionId = new mongoose.Types.ObjectId()
const inputs = {
  indexName: name,
  queryVector: [0.1, 0.2],
  limit: 5,
  model: 'text-embedding-3-small',
  chunkingVersion: 'v1',
  eligibleRevisionIds: [revisionId],
}
const fakeModel = responses => {
  let call = 0
  return {
    createCollection: vi.fn(async () => {}),
    listSearchIndexes: vi.fn(async () => responses[Math.min(call++, responses.length - 1)]),
    createSearchIndex: vi.fn(async () => name),
    updateSearchIndex: vi.fn(async () => {}),
  }
}
const quiet = { sleep: vi.fn(async () => {}), log: vi.fn() }
const ready = { name, status: 'READY', queryable: true, latestDefinition: definition }
const search = () => createSimilaritySearch(testConfig().ai)
const query = {
  queries: [{ passageId: 'p0000', vector: [0.1, 0.2] }],
  eligibleRevisionIds: [revisionId],
  model: 'text-embedding-3-small',
  chunkingVersion: 'v1',
  limit: 5,
}

describe('similarity search', () => {
  it('builds an exact $vectorSearch first stage with eligibility pre-filters', () => {
    expect(buildVectorSearchPipeline(inputs)[0]).toEqual({
      $vectorSearch: {
        index: name,
        path: 'vector',
        queryVector: [0.1, 0.2],
        exact: true,
        limit: 5,
        filter: {
          $and: [
            { model: { $eq: 'text-embedding-3-small' } },
            { chunkingVersion: { $eq: 'v1' } },
            { revisionId: { $in: [revisionId] } },
          ],
        },
      },
    })
  })

  it('projects the vector search score and passage identity', () => {
    expect(buildVectorSearchPipeline(inputs)[1]).toEqual({
      $project: {
        _id: 1,
        revisionId: 1,
        authorAccountId: 1,
        passageId: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    })
  })

  it('defines a 1536-dimension cosine index with four filter fields', () => {
    expect(vectorIndexDefinition()).toEqual({
      fields: [
        { type: 'vector', path: 'vector', numDimensions: 1536, similarity: 'cosine' },
        { type: 'filter', path: 'revisionId' },
        { type: 'filter', path: 'authorAccountId' },
        { type: 'filter', path: 'model' },
        { type: 'filter', path: 'chunkingVersion' },
      ],
    })
  })

  it('creates a missing index and waits until it is queryable', async () => {
    const Model = fakeModel([[], [{ name, status: 'BUILDING', queryable: false }], [ready]])
    const sleep = vi.fn(async () => {})
    const status = await syncVectorSearchIndex(Model, { name, definition }, { sleep, log: vi.fn() })
    expect(status).toBe('READY')
    expect(Model.createSearchIndex).toHaveBeenCalledTimes(1)
    expect(Model.createSearchIndex).toHaveBeenCalledWith({ name, type: 'vectorSearch', definition })
    expect(Model.updateSearchIndex).not.toHaveBeenCalled()
  })

  it('updates a changed definition and leaves a matching one alone', async () => {
    const changed = fakeModel([
      [{ ...ready, latestDefinition: vectorIndexDefinition(512) }],
      [{ ...ready, status: 'BUILDING', queryable: false }],
      [ready],
    ])
    expect(await syncVectorSearchIndex(changed, { name, definition }, quiet)).toBe('READY')
    expect(changed.updateSearchIndex).toHaveBeenCalledTimes(1)
    expect(changed.updateSearchIndex).toHaveBeenCalledWith(name, definition)
    expect(changed.createSearchIndex).not.toHaveBeenCalled()
    const same = fakeModel([[ready]])
    expect(await syncVectorSearchIndex(same, { name, definition }, quiet)).toBe('READY')
    expect(same.createSearchIndex).not.toHaveBeenCalled()
    expect(same.updateSearchIndex).not.toHaveBeenCalled()
  })

  it('fails when the index never becomes queryable', async () => {
    const Model = fakeModel([[{ name, status: 'BUILDING', queryable: false }]])
    await expect(
      syncVectorSearchIndex(
        Model,
        { name, definition },
        { timeoutMs: 10, pollMs: 1, log: vi.fn() },
      ),
    ).rejects.toThrow(/not queryable/)
  })

  it('reports a missing, failed or unsupported index as a non-retryable comparison failure', async () => {
    const spy = vi.spyOn(EmbeddingArtifact, 'listSearchIndexes')
    const terminal = { code: 'vector-index-unavailable', retryable: false }
    spy.mockResolvedValue([])
    await expect(search().findSimilar(query)).rejects.toMatchObject(terminal)
    spy.mockResolvedValue([{ name, status: 'FAILED', queryable: false }])
    await expect(search().findSimilar(query)).rejects.toMatchObject(terminal)
    spy.mockRejectedValue(Object.assign(new Error('SearchNotEnabled'), { code: 31082 }))
    await expect(search().findSimilar(query)).rejects.toMatchObject(terminal)
  })

  it('retries network errors and stale or still-building queryable indexes', async () => {
    const spy = vi.spyOn(EmbeddingArtifact, 'listSearchIndexes')
    const retryable = { code: 'vector-index-unavailable', retryable: true }
    spy.mockResolvedValue([{ name, status: 'STALE', queryable: true }])
    await expect(search().findSimilar(query)).rejects.toMatchObject(retryable)
    spy.mockResolvedValue([{ name, status: 'BUILDING', queryable: true }])
    await expect(search().findSimilar(query)).rejects.toMatchObject(retryable)
    spy.mockRejectedValue(Object.assign(new Error('socket closed'), { name: 'MongoNetworkError' }))
    await expect(search().findSimilar(query)).rejects.toMatchObject(retryable)
  })
})
