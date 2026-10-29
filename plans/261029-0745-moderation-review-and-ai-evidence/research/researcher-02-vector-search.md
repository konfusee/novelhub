# Research 02: MongoDB `$vectorSearch` for NovelHub similarity retrieval

Researched 2026-10-29. Targets MongoDB 8.3.13 Community with mongot 1.70, Mongoose 9.11.1, Node driver `mongodb` 7.5.0, and `bson` 7.3.3. The installed versions were checked in `node_modules`, and `backend/package.json:22` pins `mongoose ^9.11.1`.

## Summary

- **Index.** Create one `vectorSearch` index on `embeddingArtifacts`. Index `vector` as a `vector` field (1536 dimensions, `cosine`, no quantization), and index the immutable fields `authorAccountId`, `revisionId`, `model`, and `chunkingVersion` as `filter` fields. Do not filter on `eligibilityStatus`. The collection is append-only (`backend/src/models/review/embedding-artifact.model.js:29-31`), so that field can never track the current publication state. The baseline also requires eligibility to come from the current revision and publication state (`docs/requirements-baseline.md:124-126`).
- **Query.** Make `$vectorSearch` the first stage, use `exact: true` (ENN) while the corpus is around 10k passages, and pre-filter on `authorAccountId: {$ne: submitter}`, `model`, `chunkingVersion`, and `revisionId: {$in: eligibleRevisionIds}`, where `eligibleRevisionIds` is computed at query time. Project `{$meta: 'vectorSearchScore'}`. For cosine, the score is `(1 + cos) / 2`, which fits `SimilarityFinding.score` in [0, 1] (`similarity-finding.model.js:12`). Re-check eligibility after retrieval, before anything reaches the LLM.
- **Transactions.** `$vectorSearch` cannot run inside a transaction. MongoDB 8.3.13 returned `OperationNotSupportedInTransaction` (code 263, "Aggregation stage $vectorSearch cannot run within a multi-document transaction") in a local test on mongodb-memory-server. The comparison stage therefore has to query outside `withTransaction` (`backend/src/db/connection.js:27-43`) and then persist its findings with CAS inside a transaction.
- **A missing index looks like no results.** The docs say `$vectorSearch` "doesn't return results" when the index is missing or misspelled. Before every comparison run, check that the index is `queryable` and `READY`. Any other state must be recorded as a comparison-stage failure, never as a successful empty discovery.
- **Mongoose.** Mongoose 9 has `schema.searchIndex()`, `Model.createSearchIndex/updateSearchIndex/listSearchIndexes/dropSearchIndex`, and an `autoSearchIndex` option that defaults to `false`. `syncIndexes()` does not touch search indexes. Add a separate, idempotent "sync search indexes" step that runs against the VPS only.
- **Tests.** mongodb-memory-server 8.3.13 rejects `createSearchIndex`, `listSearchIndexes`, and `$vectorSearch` with code 31082 `SearchNotEnabled` (tested locally). Recommendation: put retrieval behind one small function, build the pipeline in a pure function covered by unit tests, and replace the retrieval function with a test double in service and route tests. An optional integration test against `mongodb/mongodb-atlas-local` can be added later, gated by an environment variable.
- **Sizing.** 10k × 1536 float32 vectors take about 61 MB raw (about 77 MB with the recommended 25% buffer). At 512 dimensions they take about 20 MB (about 26 MB). On a 4 GB VPS the real memory pressure comes from the defaults of mongot (JVM heap, 25% of RAM, about 1 GB) and mongod (WiredTiger cache, 1.5 GB), not from the vectors. Keep 1536 dimensions. Cap both processes' memory explicitly.

## Contents
1. Index definition
2. `$vectorSearch` syntax, score, and constraints
3. Index lifecycle from the Node driver
4. Mongoose support
5. Testing strategy
6. Operational limits on a 4 GB VPS
7. Open risks / unknowns

---

## 1. Vector search index definition

**Shape** ([vector-search-type](https://www.mongodb.com/docs/vector-search/indexes/vector-search-type/)):
- The index has `type: 'vectorSearch'` and `definition.fields[]`. The `fields` array must contain at least one `vector` field.
- A `vector` field has `path`, `numDimensions` (at most 8192), and `similarity` (`euclidean | cosine | dotProduct`).
- Optional `vector` settings: `quantization` (`none` by default, or `scalar` / `binary`), `indexingMethod` (`hnsw` by default, or `flat`), and `hnswOptions` (`maxEdges` 16–64, default 16).
- A `filter` field has `type: 'filter'` and `path`.
- The `type` value goes at the top level of the createSearchIndexes command. If it is omitted, the index type is `search` ([createSearchIndexes](https://www.mongodb.com/docs/manual/reference/command/createSearchIndexes/)). The driver types `type` as `'search' | 'vectorSearch'` (`node_modules/mongodb/mongodb.d.ts:7981-7988`).

**Filter field types.** Filter fields support boolean, date, objectId, numeric, string, and UUID values, including arrays of these types (vector-search-type, [vector-search-stage](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/)). ObjectId, string, boolean, and date all work.

**Filter operators** (vector-search-stage, "MongoDB Vector Search Filtering"):
- `$eq` and `$ne`
- `$gt`, `$lt`, `$gte`, `$lte`
- `$in` and `$nin`
- `$exists`
- `$not`, `$nor`, `$and`, `$or`
- The short form of `$eq` (`{field: value}`)

No other query operators, aggregation expressions, or Search operators are accepted. Every filtered path must be indexed as `type: 'filter'`.

**Similarity choice.** For `cosine`, MongoDB says "we recommend that you normalize your vectors and use `dotProduct` instead". Zero-magnitude vectors are rejected under `cosine`. With `dotProduct`, vectors must be unit length at index time and at query time (vector-search-type, "About the Similarity Functions"). OpenAI embeddings are normalized to length 1 ([OpenAI embeddings guide](https://platform.openai.com/docs/guides/embeddings), FAQ "Which distance function should I use?"). For unit vectors, `cosine` and `dotProduct` give the same ranking and the same score. Use `cosine` anyway: it matches decision-log item 28 (`docs/decision-log.md:284-286`) and stays correct if a vector is ever not normalized.

**Indexing method** (vector-search-type, "About the Indexing Methods"):
- `flat` gives 100% recall, uses less CPU and memory, and fits "small to medium datasets where high recall is mandatory".
- `hnsw` is the default and suits large ANN workloads. `exact: true` also runs ENN on an HNSW index.
- Recommendation: keep the default `hnsw` so the corpus can grow, and query with `exact: true` (see §2).

**Quantization.** MongoDB recommends it above about 100,000 vectors (vector-search-type, "About Quantization"). At around 10k vectors, `none` is correct.

**Recommended index for `embeddingArtifacts`.** It uses the current field names from `embedding-artifact.model.js:4-27`.

```json
{
  "name": "embedding_passages_v1",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      { "type": "vector", "path": "vector", "numDimensions": 1536, "similarity": "cosine" },
      { "type": "filter", "path": "authorAccountId" },
      { "type": "filter", "path": "revisionId" },
      { "type": "filter", "path": "model" },
      { "type": "filter", "path": "chunkingVersion" }
    ]
  }
}
```

The task asked about filtering on `authorAccountId`, `eligibilityStatus`, and `revisionId`. The definition above drops `eligibilityStatus` on purpose:

- `EmbeddingArtifact` uses the `appendOnly` plugin (`embedding-artifact.model.js:31`, `backend/src/models/shared/schema.js:42-62`). Its `eligibilityStatus` (`embedding-artifact.model.js:14`) is fixed at insert time, so it goes stale as soon as a chapter is unpublished, rejected, superseded, or cancelled.
- The baseline explicitly forbids letting stale embedding metadata admit content (`docs/requirements-baseline.md:124-126`).
- Remove the field, or at least never use it as a gate.
- Make `authorAccountId` required. It is currently optional (`embedding-artifact.model.js:13`), and a document without it would weaken the `$ne` self-exclusion (see Open risks).
- Including `model` and `chunkingVersion` keeps vectors from a different model, dimension count, or chunker out of the comparison. `numDimensions` is enforced at index time, so a model or dimension change needs a new index anyway.

## 2. `$vectorSearch` stage

**Syntax** (vector-search-stage). `{ $vectorSearch: { index, path, queryVector, limit, numCandidates?, exact?, filter? } }`:
- `limit` must be an int no greater than `numCandidates`.
- `numCandidates` is required unless `exact: true`, and must be ≤ 10000. MongoDB "recommend[s] … at least 20 times higher than the number of documents to return (`limit`)".
- `exact: true` runs ENN and is recommended when "you want to query less than 10000 documents without having to tune the number of nearest neighbors" and for selective pre-filters that match under 5% of documents.
- `queryVector` must have the index's `numDimensions` and come from the same model.
- `maxTimeMS` cancels the query. Starting in 8.3, a timeout also stops the Lucene search inside mongot.

**Placement and limits** (vector-search-stage, "Considerations" / "Limitations"):
- "`$vectorSearch` must be the first stage of any pipeline where it appears."
- It cannot appear in a view definition, in a `$lookup` sub-pipeline, or inside `$facet`. Its results can be passed into those stages.
- Run one aggregate per query passage. Do not try to batch several queries into one pipeline.

**Score.**
- Read it with `{ $project: { score: { $meta: 'vectorSearchScore' } } }`. The score is in [0, 1].
- For cosine, MongoDB normalizes it as `score = (1 + cosine(v1, v2)) / 2` (vector-search-type, "About the Similarity Functions"). The dotProduct formula is identical, and euclidean uses `1 / (1 + d)`. To recover the raw cosine: `cos = 2*score - 1`.
- Pre-filtering does not change the score (vector-search-stage).
- Store the MongoDB score as is. It already satisfies `SimilarityFinding.score` `min: 0, max: 1` (`similarity-finding.model.js:12`). No threshold is applied (decision-log item 28).

**Transactions.**
- The documentation pages fetched for this report never mention `$vectorSearch` in transactions. The general list in [Transactions and Operations](https://www.mongodb.com/docs/manual/core/transactions-operations/) does not name it either.
- A local test on mongod 8.3.13 (mongodb-memory-server, single-node replica set) gave a definitive answer. Running `aggregate([{ $vectorSearch: … }], { session })` inside `session.withTransaction` returned **code 263 `OperationNotSupportedInTransaction`: "Aggregation stage $vectorSearch cannot run within a multi-document transaction."** The server checks this before its search-enabled check.
- So the comparison stage must:
  1. Claim the attempt (transaction/CAS).
  2. Run the retrieval queries with no session.
  3. Re-validate eligibility with plain reads.
  4. Write `SimilarityFinding` rows and advance the batch in a CAS transaction (`backend/src/db/connection.js:27-43`).

**Recommended pipeline** (one per query passage):

```js
const pipeline = [
  {
    $vectorSearch: {
      index: 'embedding_passages_v1',
      path: 'vector',
      queryVector, // number[1536] from the submitting revision's passage
      exact: true, // ENN: deterministic, full recall at ~10k passages
      limit: TOP_K, // e.g. 5–8; implementation parameter (decision-log 28)
      filter: {
        $and: [
          { authorAccountId: { $ne: submitterAccountId } },
          { model: EMBEDDING_MODEL },
          { chunkingVersion: CHUNKING_VERSION },
          { revisionId: { $in: eligibleRevisionIds } }, // computed now from current state
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
      passageOrder: 1,
      offsets: 1,
      textReference: 1,
      score: { $meta: 'vectorSearchScore' },
    },
  },
]
const hits = await EmbeddingArtifact.aggregate(pipeline).option({ maxTimeMS: 10_000 })
```

How `eligibleRevisionIds` is built:
- Take the published revisions of chapters in a live published state. The pointer is `Chapter.publishedRevisionId` (`backend/src/models/content/chapter.model.js:44`), and the statuses are listed at `chapter.model.js:3-13`.
- Add the revisions of pending chapter submissions: `PublicationSubmission.revisionId` with status `pending-review` or `decision-pending` (`publication-submission.model.js:2-9`, `:15`).
- Exclude cancelled and unreleased content (`docs/decision-log.md:43`). Leave out the submitter's own work.
- Collect the IDs with plain reads right before the query, and check them again after retrieval. The comparison stage is the only gate before the LLM, and stored evidence may only contain passages that are eligible at that point.

`ContentRevision` carries `chapterId` (`content-revision.model.js:17-23`), which is how a hit is mapped to `sourceChapterId` for `SimilarityFinding` (`similarity-finding.model.js:6`).

**Mongoose note.** `Model.aggregate()` sends the pipeline unchanged, so `$vectorSearch` works through Mongoose. Do not attach `.session()`.

## 3. Index lifecycle from the Node driver (mongodb 7.5.0)

**API.** The driver exposes:
- `collection.createSearchIndex({ name, type: 'vectorSearch', definition })`, which returns the name.
- `createSearchIndexes([...])`, which issues the `createSearchIndexes` command (`node_modules/mongodb/lib/operations/search_indexes/create.js:17-24`).
- `listSearchIndexes(name?)`, which returns a cursor (`node_modules/mongodb/lib/collection.js:694`).
- `updateSearchIndex(name, definition)` and `dropSearchIndex(name)`.

Community 8.2+ with mongot supports these commands ([createSearchIndexes](https://www.mongodb.com/docs/manual/reference/command/createSearchIndexes/), [$search](https://www.mongodb.com/docs/search/query/aggregation-stages/search/) both list "MongoDB Community deployments running version 8.2 or later"). Each listed index contains `status`, `queryable`, `latestDefinition`, `latestDefinitionVersion`, and per-mongot `statusDetail` ([$listSearchIndexes](https://www.mongodb.com/docs/manual/reference/operator/aggregation/listSearchIndexes/)).

**Status values** ($listSearchIndexes, "MongoDB Search Index Statuses"):

| Status | Meaning |
| --- | --- |
| `PENDING` | Build not started. Never queryable. |
| `BUILDING` | Initial build, a rebuild after an edit, or a rebuild after falling behind. A new index is not queryable. An existing index keeps serving the old definition. |
| `READY` | Always queryable. |
| `STALE` | Queryable, but has stopped replicating, so results may be out of date. |
| `FAILED` | Usually an invalid definition. May or may not be queryable. |
| `DELETING` | Being dropped. |
| `DOES_NOT_EXIST` | No such index. |

**Eventual consistency.**
- "mongot monitors the change streams and updates stored copies of data, making MongoDB Vector Search indexes eventually consistent". The latest data "might not be available immediately for queries" (vector-search-type, Considerations).
- mongot "synchronizes index data from mongod over a permanent connection driven by change streams" ([self-managed overview](https://www.mongodb.com/docs/search/self-managed/current/)).
- Under heavy writes, `$vectorSearch` "might return stale data … due to a replication lag" (vector-search-stage).

**What this means for "search right after insert":**
1. Read-after-write on the submission's own vectors is not needed. The query vectors come straight from the OpenAI response or the `EmbeddingArtifact` documents, and the submitter's own artifacts are filtered out anyway.
2. Another author's chapter that was embedded seconds earlier may not be searchable yet. For advisory evidence this is acceptable. No polling and no sleeps. If useful, record the index status and check time in the batch evidence for auditability.
3. A missing index makes `$vectorSearch` return nothing ("doesn't return results if you misspell the index name or if the specified index doesn't already exist", vector-search-stage). Before each comparison stage, run `listSearchIndexes('embedding_passages_v1')`, require `queryable === true && status === 'READY'`, and otherwise record the failure as a comparison-stage failure that sends the submission to manual review (`docs/requirements-baseline.md:127-130`). Treat `STALE` as a failure as well, because it means replication has stopped.
4. On mongod without mongot, both `listSearchIndexes` and `$vectorSearch` fail with code **31082 `SearchNotEnabled`** (tested on mongodb-memory-server 8.3.13). Map that code to the same comparison failure.

**Idempotent provisioning** (VPS only, never in tests):

```js
// backend/scripts/sync-search-indexes.js (proposed). Runs after db:sync-indexes.
const [existing] = await EmbeddingArtifact.listSearchIndexes({ name: INDEX.name }) // Mongoose wraps the cursor
if (!existing) await EmbeddingArtifact.createSearchIndex(INDEX)
else if (!isDeepStrictEqual(normalize(existing.latestDefinition), normalize(INDEX.definition)))
  await EmbeddingArtifact.updateSearchIndex(INDEX.name, INDEX.definition) // triggers a rebuild
// then poll listSearchIndexes until queryable (docs show a 5 s polling loop)
```

`updateSearchIndex` rebuilds the index in the background and keeps the old one serving until the new one is ready. mongot needs free disk equal to at least 125% of the current index size during a rebuild ([resource allocation](https://www.mongodb.com/docs/search/self-managed/current/resource-planning-sizing/resource-allocation/)).

## 4. Mongoose 9 support

These references were checked in installed Mongoose 9.11.1 and in the [Mongoose guide](https://mongoosejs.com/docs/guide.html#autoSearchIndex):

- `Schema.prototype.searchIndex(description)` pushes to `schema._searchIndexes` (`node_modules/mongoose/lib/schema.js:1190-1194`). The guide shows a `vectorSearch` example: `schema.searchIndex({ name, type: 'vectorSearch', definition: { fields: [{ type: 'vector', path, numDimensions: 1536, similarity: 'cosine' }] } })`.
- `autoSearchIndex` works like `autoIndex` but "unlike autoIndex, this option defaults to false" (guide). The global default is `autoSearchIndex: false` (`node_modules/mongoose/lib/mongoose.js:72`). If enabled, `Model.init()` calls `createSearchIndexes()` (`node_modules/mongoose/lib/model.js:1142-1154`, `:1183`).
- `Model.createSearchIndexes()` blindly calls `createSearchIndex` for every declared index (`model.js:1854-1860`). It never compares or updates existing indexes, so it is not idempotent and cannot apply a definition change.
- `Model.createSearchIndex`, `updateSearchIndex`, and `dropSearchIndex` delegate to the driver (`model.js:1375-1422`). `Model.listSearchIndexes` returns an array (`model.js:1442-1448`).
- `Model.syncIndexes()` only runs `createCollection`, `diffIndexes`, `cleanIndexes`, and `createIndexes` on regular indexes (`model.js:1329-1355`). **It never touches search indexes.** As a result:
  - `scripts/sync-indexes.js:15-24` (`npm run db:sync-indexes`, `backend/package.json:11`) will not create the vector index.
  - The test helper's `syncIndexes()` loop (`backend/test/db.js:12-16`) is safe even when a schema declares `searchIndex`.

**Recommendation.**
- Declare the definition once and export it as a constant from `embedding-artifact.model.js`. Optionally also register it with `schema.searchIndex(EMBEDDING_VECTOR_INDEX)` for discoverability, keeping `autoSearchIndex` off.
- Provision it with a dedicated idempotent script (§3), either a new `db:sync-search-indexes` script or a flag-gated step in `sync-indexes.js`.
- Never enable `autoSearchIndex`. Model init would throw 31082 in tests, and on the VPS it would re-issue a create for an index that already exists.

## 5. Testing strategy (mongodb-memory-server has no mongot)

**Facts.**
- Tests run on `MongoMemoryReplSet` 8.3.13 (`backend/test/global-setup.js:6-10`, `mongodb-memory-server ^11.3.0` at `backend/package.json:36`).
- CI is a single Ubuntu job running `npm test` (`.github/workflows/ci.yml:9-29`).
- Docker is not installed on this workstation (`docker: command not found`).
- On memory-server, `createSearchIndex`, `listSearchIndexes`, and `$vectorSearch` all fail with 31082 `SearchNotEnabled` (tested).

| Option | How | Fidelity | Cost / risk |
| --- | --- | --- | --- |
| **A. Retrieval seam with a test double (recommended)** | Add one module, e.g. `modules/ai/similarity-retrieval.js`, with `buildVectorSearchPipeline(args)` (a pure function) and `findNearestPassages(args)` (runs the aggregate and maps errors 31082 / 263 / index-not-ready to a comparison failure). The comparison stage receives the retriever as a parameter, or tests use `vi.mock` on the module. | Unit tests cover the exact pipeline JSON (filter, `exact`, `limit`, `$meta`) and the error mapping. Stage tests cover claim/CAS, eligibility re-check, empty discovery, and failure → manual review. | Zero infrastructure and fast. Does not catch server-side syntax or semantics problems. |
| B. `mongodb/mongodb-atlas-local` container | The official image bundles mongod and mongot and is described as suitable to "develop and run integration tests in CI" ([self-managed overview](https://www.mongodb.com/docs/search/self-managed/current/), [Docker deploy](https://www.mongodb.com/docs/atlas/cli/current/atlas-cli-deploy-docker/); needs ≥ 2 GB free RAM and 2 cores). Run it as a GitHub Actions service in a separate job, with a gated `*.search.test.js` (for example, skipped unless `SEARCH_TEST_URI` is set). | Real `$vectorSearch`, index build, status, and score. | The test must poll until the index is queryable and wait for change-stream lag after inserts, which makes it slow and potentially flaky. The image's mongod version may not match 8.3.13. Developers on Windows without Docker cannot run it. |
| C. Aggregation-expression ENN emulation on memory-server | Compute the cosine with `$reduce`/`$zip` in a normal pipeline. | Not the production code path. | It becomes a second implementation that has to be maintained. Rejected. |
| D. Shared VPS DB | — | — | Forbidden: tests would write to the shared database. |

**Recommendation.** Do **A** now. It covers every acceptance path except the server parser. Before merging, run a single manual smoke check of the pipeline against the VPS (read-only; the index is created by the provisioning script). Add **B** later as an optional CI job only if regressions in pipeline semantics show up. Keep the test double honest: shape its return values exactly like the production projection (`revisionId`, `passageId`, `score`, …).

## 6. Operational limits on a 4 GB VPS

**Memory model.**
- MongoDB Vector Search "holds the entire index in memory" (HNSW graph plus vectors), with nominal metadata ([deployment options](https://www.mongodb.com/docs/vector-search/deployment/deployment-options/), "Memory Requirements"). The official formula is `vectors × dims × 4 bytes`; add 20–25% for overhead ([resource allocation](https://www.mongodb.com/docs/search/self-managed/current/resource-planning-sizing/resource-allocation/)).
- mongot's default JVM heap is **25% of system RAM**, and the heap "roughly scales with the number of fields indexed", not with the number of vectors. If the vector index exceeds 3 GB, quantize ([hardware](https://www.mongodb.com/docs/search/self-managed/current/resource-planning-sizing/hardware/)).
- mongod's default WiredTiger cache is `0.5 × (RAM − 1 GB)`, which is **1.5 GB on 4 GB** ([WiredTiger memory use](https://www.mongodb.com/docs/manual/core/wiredtiger/)).
- MongoDB recommends co-located mongod+mongot only for development and small workloads, with monitoring for resource contention ([architecture](https://www.mongodb.com/docs/search/self-managed/current/resource-planning-sizing/architecture/)). Its smallest Low-CPU (vector) sizing tier is 8–16 GB ([quickstart](https://www.mongodb.com/docs/search/self-managed/current/resource-planning-sizing/quick-start/)), so 4 GB is below the official starting size.

**Estimates for 10k passages** (my arithmetic from the formulas above):

| | 1536-dim | 512-dim |
| --- | --- | --- |
| mongot RAM, float32, no quantization (raw → +25%) | 61.4 MB → ~77 MB | 20.5 MB → ~26 MB |
| mongot RAM with `scalar` quantization (÷3.75 per deployment-options) | ~16 MB | ~5.5 MB |
| mongod document size, `[Number]` BSON array (~13.3 B/elem: type + key + double) | ~20.4 KB/doc → ~204 MB | ~6.5 KB/doc → ~65 MB |
| mongod size as BSON `binData` float32 vector | ~6.1 KB/doc → ~61 MB | ~2 KB/doc → ~20 MB |

Even at 1536 dimensions the vectors cost under 100 MB of mongot RAM. The budget is dominated by fixed defaults: about 1 GB JVM heap, 1.5 GB WiredTiger cache, the Node backend, and the OS. On 4 GB, set both limits explicitly, for example `wiredTigerCacheSizeGB: 1` and mongot `--jvm-flags "-Xms1g -Xmx1g"` (the flag syntax is from the hardware page). Monitor page faults; the docs flag more than 1000/s as a scale-up signal. Keep about 2× the index size free on disk, because mongot becomes read-only at 90% disk use (hardware page).

**`dimensions: 512` with text-embedding-3-small:**
- OpenAI's `dimensions` parameter shortens embeddings "without the embedding losing its concept-representing properties" and is the suggested approach over manual truncation ([guide](https://platform.openai.com/docs/guides/embeddings), [announcement](https://openai.com/index/new-embedding-models-and-api-updates/)). Price is per token, so 512 dimensions cost the same in API fees.
- Full-size 3-small scores MTEB 62.3 and MIRACL (multilingual) 44.0 (announcement). The fetched page did not include the per-dimension chart, so the accuracy loss at 512 is **unverified**.
- Content is Vietnamese, which puts multilingual recall (MIRACL) closer to the relevant measure than MTEB, so any loss matters more here.
- **Recommendation: keep the default 1536.** At this scale the memory saving is about 50 MB, which is negligible compared with the fixed process overhead. 512 dimensions risk recall on exactly the multilingual case that matters, and 1536 needs no extra API parameter.
- If storage becomes a concern, store vectors as `Binary.fromFloat32Array` before reducing dimensions. bson 7.3.3 has `Binary.fromFloat32Array` (`node_modules/bson/bson.d.ts:162`), and MongoDB cites a 66% cut in mongod storage. That change requires replacing the Mongoose `[Number]` schema type and its length validator (`embedding-artifact.model.js:15-24`), so defer it.
- `EmbeddingArtifact.dimensions` (`embedding-artifact.model.js:7`) already records the choice. Pin `model` and `numDimensions` together in the index constant.

## Ranked recommendations

1. `vectorSearch` index: `vector` with 1536 dimensions, `cosine`, `hnsw`, no quantization; `filter` on `authorAccountId`, `revisionId`, `model`, `chunkingVersion`. Make `authorAccountId` required, and drop or ignore `eligibilityStatus`.
2. Query with ENN (`exact: true`) and pre-filtering with `$in` on the eligible revisions computed at query time, outside any transaction, with `maxTimeMS`. Re-validate eligibility, then persist with CAS.
3. Before each run, check that the index is `READY` and queryable. Missing, failed, stale, or 31082/263 conditions count as a comparison-stage failure that leads to manual review. They are never recorded as an empty discovery.
4. Provision with a separate idempotent script that compares `latestDefinition` and updates when it differs. Keep `autoSearchIndex` off.
5. Tests: retrieval seam plus pure pipeline builder plus a test double. Optional gated atlas-local job later.
6. VPS: cap the WiredTiger cache and mongot heap explicitly, and leave `scalar` quantization unused until the corpus reaches about 100k vectors.

## Open risks / unknowns

- **Accuracy of `exact: true` with filters.** ENN cost grows linearly with the corpus. Around 50k–100k passages, switch to ANN with `numCandidates ≈ 20 × limit` and measure recall against ENN. The crossover point was not measured.
- **Performance of large `$in` lists.** No documented size limit was found for `$in` inside a `$vectorSearch` filter. Thousands of ObjectIds are well under the 16 MB BSON limit, but Lucene filter cost is unmeasured. Fallback: pre-filter on `authorAccountId`, `model`, and `chunkingVersion` only, over-fetch with a larger `limit`, and post-filter on eligibility. That fallback can return fewer than top-k hits after filtering.
- **`$ne` on documents without `authorAccountId`.** How the `$vectorSearch` `$ne` filter treats documents that lack the field is not documented in the pages fetched. Making the field required removes this risk.
- **Transaction rejection was tested on memory-server mongod only.** The 263 check is in mongod, not mongot, so the VPS should behave the same, but this was not confirmed on the VPS (the shared DB was not touched).
- **Version of the atlas-local image.** Which mongod version `mongodb/mongodb-atlas-local` ships was not verified, so it may not match 8.3.13.
- **Accuracy at 512 dimensions** for Vietnamese text is not quantified. The OpenAI chart did not render.
- **Running co-located on 4 GB is below MongoDB's documented minimum** for vector workloads (8–16 GB). The heap and cache caps above are mitigations, not a sizing guarantee. Load on the VPS was not measured.
- **Index lag under bursts.** Lag is not bounded in the docs. Findings may miss sources embedded seconds earlier. This is acceptable for advisory evidence, but it is not reproducible across reruns. Viewing stored results never re-queries, which limits the impact.
