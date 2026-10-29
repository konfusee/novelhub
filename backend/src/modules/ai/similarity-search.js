import { EmbeddingArtifact } from '../../models/index.js'
import { StageError } from './stage-error.js'

export const VECTOR_DIMENSIONS = 1536

/** The one MongoDB Vector Search index definition on `embeddingArtifacts`. */
export function vectorIndexDefinition(dimensions = VECTOR_DIMENSIONS) {
  return {
    fields: [
      { type: 'vector', path: 'vector', numDimensions: dimensions, similarity: 'cosine' },
      { type: 'filter', path: 'revisionId' },
      { type: 'filter', path: 'authorAccountId' },
      { type: 'filter', path: 'model' },
      { type: 'filter', path: 'chunkingVersion' },
    ],
  }
}

/** Exact `$vectorSearch` limited to eligible source revisions of the same model and chunking. */
export function buildVectorSearchPipeline({
  indexName,
  queryVector,
  limit,
  model,
  chunkingVersion,
  eligibleRevisionIds,
}) {
  return [
    {
      $vectorSearch: {
        index: indexName,
        path: 'vector',
        queryVector,
        exact: true,
        limit,
        filter: {
          $and: [
            { model: { $eq: model } },
            { chunkingVersion: { $eq: chunkingVersion } },
            { revisionId: { $in: eligibleRevisionIds } },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        revisionId: 1,
        authorAccountId: 1,
        passageId: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]
}

export function indexQueryable(index) {
  return index?.status === 'READY' && index?.queryable === true
}

const fieldKeys = definition =>
  new Set((definition?.fields ?? []).map(field => field.type + ':' + field.path))
const vectorField = definition => definition?.fields?.find(field => field.type === 'vector')

export function sameVectorIndexDefinition(existing, desired) {
  if (!existing) return false
  const have = fieldKeys(existing)
  const want = fieldKeys(desired)
  if (have.size !== want.size || [...want].some(key => !have.has(key))) return false
  const a = vectorField(existing)
  const b = vectorField(desired)
  return a?.numDimensions === b?.numDimensions && a?.similarity === b?.similarity
}

/**
 * Creates or updates the vector index and waits until it is queryable. Operator use only:
 * it needs a deployment with mongot (`npm run db:sync-indexes` never creates search indexes).
 */
export async function syncVectorSearchIndex(
  Model,
  { name, definition },
  {
    pollMs = 5000,
    timeoutMs = 300000,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    log = console.log,
  } = {},
) {
  const find = async () =>
    (await Model.listSearchIndexes(name)).filter(index => index.name === name)[0]
  await Model.createCollection()
  const current = await find()
  if (!current) {
    await Model.createSearchIndex({ name, type: 'vectorSearch', definition })
    log(name + ': created')
  } else if (!sameVectorIndexDefinition(current.latestDefinition, definition)) {
    await Model.updateSearchIndex(name, definition)
    log(name + ': updated')
  } else {
    log(name + ': unchanged')
  }
  let waited = 0
  let status
  for (;;) {
    const index = await find()
    if (indexQueryable(index)) return 'READY'
    status = index?.status ?? 'missing'
    if (waited >= timeoutMs) break
    await sleep(pollMs)
    waited += pollMs
  }
  throw new Error(
    'Vector search index ' +
      name +
      ' is not queryable after ' +
      timeoutMs +
      ' ms (status ' +
      status +
      ')',
  )
}

const NETWORK_ERRORS = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
])
const transient = error => NETWORK_ERRORS.has(error?.name)

/**
 * Similarity retrieval for the comparison stage. A missing, failed or unsupported index is a
 * terminal failure, never "no similar passages"; a stale or still-building queryable index and
 * network errors are retryable. `$vectorSearch` cannot run in a transaction, so no session.
 */
export function createSimilaritySearch(ai) {
  return {
    async findSimilar({ queries, eligibleRevisionIds, model, chunkingVersion, limit }) {
      let indexes
      try {
        indexes = await EmbeddingArtifact.listSearchIndexes(ai.vectorSearchIndex)
      } catch (error) {
        throw new StageError('vector-index-unavailable', {
          retryable: transient(error),
          cause: error,
        })
      }
      const index = indexes.find(item => item.name === ai.vectorSearchIndex)
      if (!indexQueryable(index)) {
        if (
          index?.status === 'STALE' ||
          (index?.status === 'BUILDING' && index?.queryable === true)
        )
          throw new StageError('vector-index-unavailable', { retryable: true })
        throw new StageError('vector-index-unavailable')
      }
      if (eligibleRevisionIds.length === 0)
        return queries.map(query => ({ queryPassageId: query.passageId, hits: [] }))
      const results = []
      for (const query of queries) {
        let rows
        try {
          rows = await EmbeddingArtifact.aggregate(
            buildVectorSearchPipeline({
              indexName: ai.vectorSearchIndex,
              queryVector: query.vector,
              limit,
              model,
              chunkingVersion,
              eligibleRevisionIds,
            }),
          ).option({ maxTimeMS: 10000 })
        } catch (error) {
          throw new StageError(
            error.code === 50 ? 'vector-search-timeout' : 'vector-index-unavailable',
            { retryable: error.code === 50 || transient(error), cause: error },
          )
        }
        results.push({
          queryPassageId: query.passageId,
          hits: rows.map(row => ({
            artifactId: String(row._id),
            revisionId: String(row.revisionId),
            passageId: row.passageId,
            authorAccountId: String(row.authorAccountId),
            score: row.score,
          })),
        })
      }
      return results
    },
  }
}
