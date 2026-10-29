# Research 01: OpenAI embeddings + LLM synthesis for NovelHub moderation evidence

Date: 2026-10-29. Scope: OpenAI API facts, cost model, SDK usage, test isolation, data policy. No OpenAI calls were made; no repo file other than this report was written.

## Summary

- **Embeddings:** `text-embedding-3-small` on `POST /v1/embeddings` costs $0.02 per 1M tokens. It returns 1536 dimensions by default; the `dimensions` param can shorten that. Each input is capped at 8192 tokens, a request takes up to 2048 inputs, and a request is capped at 300k tokens summed across inputs. The vectors are unit length, so cosine equals dot product. Embedding one ~3,000-word Vietnamese chapter costs about **$0.00015**.
- **Deprecations (the main finding):** all four candidate LLMs are deprecated. `gpt-5-nano` and `gpt-5-mini` **shut down Dec 11, 2026**, about 6 weeks from today. `gpt-4o-mini` and `gpt-4.1-mini` shut down **Jan 14, 2027**. OpenAI's named replacement is `gpt-6-luna` ($0.10 in / $0.50 out per 1M), which supports Structured Outputs and `reasoning.effort` values `none|low|medium|high|xhigh|max`. Whether this project's key can call `gpt-6-luna` is **unverified**.
- **API choice:** use the Responses API (`client.responses.create`) with `text.format: {type:"json_schema", strict:true}`. Set `store:false`, a bounded `max_output_tokens`, and handle `incomplete` and `refusal` responses as LLM-stage failures. The `openai` npm package is at 7.45.1 and requires Node ≥22. The repo already requires Node ≥22.
- **Cost per review:** about $0.0012–0.0105 typical, depending on model and effort. A 3 USD budget covers about 290 (gpt-5-mini low) to 2,490 (gpt-5-nano minimal) typical reviews.
- **Recommendation:** `gpt-6-luna` with `reasoning.effort:"low"`, about $0.003 per review (~980 reviews in 3 USD). If the key cannot access it, fall back to `gpt-5-nano` with `"low"`, but that only works until Dec 11, 2026. Make the model and effort env-configurable.
- **Tests:** inject a provider adapter (the same `config.googleProvider ?? createGoogleProvider(...)` pattern the repo already uses). Cover the real adapter with one contract test that uses the SDK's `fetch` option. Never construct the real client without an explicit key. I found no official OpenAI guidance on mocking.
- **Data:** by default, API data is not used for training. `/v1/embeddings` and `/v1/responses` keep abuse-monitoring logs for up to 30 days. Responses also keeps application state for 30 days unless `store:false` is set.

## Repo context (relevant to integration)

- Submission creates `EvidenceBatch {stage:'embedding', status:'pending'}` (`backend/src/modules/author-submissions.js:351-363`). Nothing consumes it. The stages are `embedding|comparison|llm` (`backend/src/models/review/evidence-batch.model.js:2-8`).
- Storage targets already exist:
  - `EmbeddingArtifact` stores `model`, `dimensions`, `vector:[Number]` (length validated against `dimensions`), `chunkingVersion`, and a unique `(revisionId, model, chunkingVersion, passageId)` (`backend/src/models/review/embedding-artifact.model.js:4-32`).
  - `ProcessingAttempt` stores `attemptKey` (unique), `leaseId`, `claimVersion`, `requestFingerprint`, `responseMetadata`, `failureCode`, and `retryOf`, with forward-only status `claimed→started→succeeded|failed|stale` (`backend/src/models/review/processing-attempt.model.js:7-37`).
  - `LlmReview` stores `suggestions`, `riskReasons`, `evidenceRefs`, `inputFingerprint`, and `providerResponseRef` (select:false), with at most one succeeded review per batch (`backend/src/models/review/llm-review.model.js:5-20`).
- Requirements: ordered embedding → similarity → LLM. An empty discovery still goes to the LLM. Any stage failure stops automation and enables manual review. AI is advisory only (`docs/requirements-baseline.md:111-134`, `docs/decision-log.md:66-73`, `docs/decision-log.md:284-290`).
- The existing provider-injection pattern is `config.googleProvider ?? (config.google ? createGoogleProvider(config.google) : null)` (`backend/src/routes/auth.routes.js:136-137`). Tests pass a fake `googleProvider` object (`backend/test/auth.test.js:569`). `createApp(config)` takes the whole config (`backend/src/app.js:25`).
- Test config comes from `.env.example` plus `NODE_ENV=test` (`backend/test/config.js:4-9`). No `OPENAI*` key exists in `.env.example`, `src`, or `test` (grep: no matches). Tests run mongodb-memory-server 8.3.13 without mongot (`backend/test/global-setup.js:7-10`).
- Dependencies: `zod ^4.6.5`; there is no `openai` dependency yet (`backend/package.json:18-32`). Engines `node >=22` (`package.json:9-10`). The local Node is v25.8.1.

## 1. Embeddings API: `text-embedding-3-small`

| Fact | Value | Source |
|---|---|---|
| Endpoint | `POST https://api.openai.com/v1/embeddings`; Node: `client.embeddings.create({model, input, dimensions?, encoding_format?})` | https://developers.openai.com/api/reference/resources/embeddings/methods/create.md |
| Per-input limit | 8192 tokens; input cannot be an empty string | same; table "Max input 8192" in https://developers.openai.com/api/docs/guides/embeddings |
| Inputs per request | array `maxItems: 2048`; **plus a 300,000-token cap summed across all inputs** | https://developers.openai.com/api/reference/resources/embeddings/methods/create.md |
| Default dimensions | 1536 (3-large: 3072) | https://developers.openai.com/api/docs/guides/embeddings |
| `dimensions` param | Optional integer ≥1, only for `text-embedding-3` and later. This is the recommended way to shorten vectors (Matryoshka training). If you truncate manually, you must renormalize. | https://developers.openai.com/api/docs/guides/embeddings ("Reducing embedding dimensions"); https://openai.com/index/new-embedding-models-and-api-updates/ |
| Price | $0.02 / 1M tokens (Batch is also supported) | https://developers.openai.com/api/docs/pricing.md ; https://developers.openai.com/api/docs/models/text-embedding-3-small.md |
| Normalization | "OpenAI embeddings are normalized to length 1": cosine can be computed as a dot product, and cosine and Euclidean distance give identical rankings | https://developers.openai.com/api/docs/guides/embeddings (FAQ "Which distance function should I use?") |
| Tokenizer | Use `cl100k_base` for third-generation embedding models | same guide (FAQ "How can I tell how many tokens a string has") |
| Multilingual quality | MIRACL (multilingual retrieval) 44.0 vs ada-002 31.4; MTEB 62.3 | https://openai.com/index/new-embedding-models-and-api-updates/ |
| Status | Not deprecated: no deprecation status on the model page, and it is absent from the deprecations list | https://developers.openai.com/api/docs/models/text-embedding-3-small.md ; https://developers.openai.com/api/docs/deprecations.md |

Implications:

- Send **one embeddings request per revision**, with all passages as an `input[]` array. A 3,000-word chapter is about 6.7k cl100k tokens, far below the 300k cap. Map vectors back to passages by `data[i].index`.
- Vector width does not change the price. Keep the default 1536 unless storage matters. Each `vector:[Number]` is stored as BSON doubles, so 1536 dims is about 12 KB per passage `[INFERENCE: 8 bytes × 1536]`.
- The dimension is fixed in both `EmbeddingArtifact.dimensions` and the mongot vector index definition. Changing it later means re-embedding.
- Because vectors are unit length, the settled "cosine" similarity is exact.

## 2. LLM API for strict JSON from Node, and SDK behavior

### Responses vs Chat Completions

- OpenAI calls the Responses API "the primary API for interacting with OpenAI models." Chat Completions is "the previous standard (supported indefinitely)" (https://raw.githubusercontent.com/openai/openai-node/master/README.md, "Usage").
- Reasoning models "work better with the Responses API". Chat Completions is still supported (https://developers.openai.com/api/docs/guides/reasoning.md).
- Structured Outputs come in two forms: function calling, or a `json_schema` response format. For a model's final answer, use the response format. In Responses it is `text.format: {type:"json_schema", name, schema, strict:true}`; in Chat Completions it is `response_format`. JSON-schema Structured Outputs need `gpt-4o-mini`/`gpt-4o-2024-08-06` or later (https://developers.openai.com/api/docs/guides/structured-outputs.md).
- Schema rules: `additionalProperties:false` is required on every object, and every field must be listed in `required` (use a nullable type for optional fields). Limits are 5000 properties and 10 levels of nesting. The first request with a new schema has extra latency (same guide, "Supported schemas" and step notes).
- Edge cases you must handle:
  - `response.status==="incomplete"` with `incomplete_details.reason` of `max_output_tokens` or `content_filter`.
  - Content items of `type:"refusal"`. A refusal does not follow the schema.
  - (same guide, "Handle edge cases" and "Refusals")
- **Decision: use Responses with strict `json_schema`.** The `responses.parse` + `zodTextFormat` helper also works with the repo's Zod v4: the helper imports `zod/v4` and converts to a strict schema (https://raw.githubusercontent.com/openai/openai-node/master/src/helpers/zod.ts). A hand-written JSON Schema with `responses.create` has fewer moving parts. Either way, validate the parsed result with the existing Zod before persisting.

### Parameters that matter

- `reasoning.effort`: values are model-dependent. The GPT-5 family (`gpt-5`, `gpt-5-mini`, `gpt-5-nano`) supports `minimal|low|medium|high` (https://developers.openai.com/api/docs/guides/latest-model/gpt-5.md). `gpt-6-luna` and `gpt-5.6-luna` support `none|low|medium|high|xhigh|max` and default to `medium` (https://developers.openai.com/api/docs/models/gpt-6-luna.md, https://developers.openai.com/api/docs/models/gpt-5.6-luna.md, https://developers.openai.com/api/docs/guides/reasoning.md). `gpt-4o-mini` and `gpt-4.1-mini` have no reasoning tokens (model pages list no "Reasoning token support").
- Reasoning tokens are invisible, billed as **output**, and count toward `max_output_tokens`. If the limit is hit, you can be billed for input and reasoning tokens with no visible output (`status: incomplete`). Usage reports `output_tokens_details.reasoning_tokens` (https://developers.openai.com/api/docs/guides/reasoning.md).
- `store` defaults to `true`, which keeps application state for 30 days. Set `store:false` (https://developers.openai.com/api/reference/resources/responses/methods/create.md; https://developers.openai.com/api/docs/guides/your-data.md).
- `safety_identifier`: optional stable per-user ID, max 128 characters, hashed recommended (create reference above).
- Prompt caching on GPT-5.6 and later: by default OpenAI chooses one **implicit** breakpoint. Cache **writes cost 1.25×** input, reads 0.1×, and the minimum prefix is 1,024 tokens. `prompt_cache_options.mode:"explicit"` disables the implicit breakpoint, and with no explicit breakpoints nothing is written (https://developers.openai.com/api/docs/guides/prompt-caching.md; create reference `prompt_cache_options`). Each review has a unique chapter, so implicit caching mostly adds write cost. Use explicit mode, with at most one breakpoint after the static criteria block if that block is ≥1,024 tokens.

### `openai` npm SDK

| Item | Value | Source |
|---|---|---|
| Version | `openai@7.45.1` (registry modified 2026-10-27); `engines.node >=22.0.0` | `npm view openai version time.modified engines` (run 2026-10-29) |
| Runtime | Node 22 and 24 LTS supported; Node 20 EOL and unsupported | README "Requirements" |
| Usage | `new OpenAI({ apiKey, timeout, maxRetries })`; `client.responses.create({...})`; `client.embeddings.create({...})` | README; https://developers.openai.com/api/docs/guides/embeddings |
| Defaults | `apiKey` = `process.env.OPENAI_API_KEY`; `baseURL` = `process.env.OPENAI_BASE_URL` ?? `https://api.openai.com/v1`; timeout **10 min** | https://raw.githubusercontent.com/openai/openai-node/master/src/client.ts (lines ~544-563); README "Timeouts" |
| Retries | **2 by default**, short exponential backoff. Retries connection errors, 408, 409, 429, and ≥500. Honors `retry-after-ms` / `Retry-After` and `x-should-retry`. Timeouts are retried too. Configure per client or per request with `maxRetries`. | README "Retries"; client.ts ~2151-2195 |
| Errors | `APIError` subclasses: 400 `BadRequestError`, 401 `AuthenticationError`, 403 `PermissionDeniedError`, 404 `NotFoundError`, 409 `ConflictError`, 422 `UnprocessableEntityError`, 429 `RateLimitError`, ≥500 `InternalServerError`, N/A `APIConnectionError`; timeout → `APIConnectionTimeoutError`. `err.requestID`, `err.status`, `err.headers`; `response._request_id` | README "Handling errors", "Request IDs" |
| 429 sub-codes | `rate_limit_exceeded`/`slow_down` (temporary). Billing codes `credit_balance_exhausted`, `project_spend_limit_exceeded`, `organization_spend_limit_exceeded`, `organization_usage_limit_exceeded`: **retrying won't help**. 503 `server_is_overloaded`. | https://developers.openai.com/api/docs/guides/error-codes.md ; https://developers.openai.com/api/docs/guides/rate-limits.md |
| Nested retries | "If you manage retries in your application, disable SDK retries or account for them… so nested retry loops don't multiply requests." | rate-limits guide |
| Idempotency | No documented `Idempotency-Key` for OpenAI endpoints. The SDK has generic `idempotencyHeader` plumbing, but the OpenAI client never sets it (grep finds only the declaration and usage: client.ts ~529, ~2469-2472) `[INFERENCE: not assigned in OpenAI client]`. | client.ts |

Idempotency consequences for NovelHub:

- Exactly-once provider billing is impossible. Idempotency has to live in the app.
- Persist the `ProcessingAttempt` claim (deterministic `attemptKey`, lease, `claimVersion`) **before** the call. Complete it with compare-and-set (CAS) against `claimVersion` and the batch version.
- Store `response.id`, `_request_id`, the returned `model` snapshot, and `usage` in `responseMetadata` / `providerResponseRef`.
- If a lease expires mid-call, another worker can re-issue the request and pay twice. The cost is bounded by `max_output_tokens`. A stale CAS discards the late result.
- SDK-internal retries after a timeout can also double-bill `[INFERENCE: server may complete a request whose client timed out]`. Keep `max_output_tokens` bounded.

## 3. Candidate model facts (official pages, fetched 2026-10-29)

| Model | Input $/1M | Cached in | Output $/1M | Context / max out | Reasoning | Status | Source |
|---|---|---|---|---|---|---|---|
| gpt-5-nano | 0.05 | 0.005 | 0.40 | 400k (272k max input) / 128k | yes: `minimal|low|medium|high`, default medium | **Deprecated, shutdown Dec 11, 2026 → `gpt-5.6-luna`** | https://developers.openai.com/api/docs/models/gpt-5-nano.md ; https://developers.openai.com/api/docs/deprecations.md |
| gpt-5-mini | 0.25 | 0.025 | 2.00 | 400k (272k) / 128k | yes, same | **Deprecated, shutdown Dec 11, 2026 → `gpt-5.6-terra`** | https://developers.openai.com/api/docs/models/gpt-5-mini.md |
| gpt-4o-mini | 0.15 | 0.075 | 0.60 | 128k / 16,384 | no | **Deprecated, shutdown Jan 14, 2027 → `gpt-6-luna`** | https://developers.openai.com/api/docs/models/gpt-4o-mini.md |
| gpt-4.1-mini | 0.40 | 0.10 | 1.60 | 1,047,576 / 32,768 | no | **Deprecated, shutdown Jan 14, 2027 → `gpt-6-luna`** | https://developers.openai.com/api/docs/models/gpt-4.1-mini.md |
| gpt-6-luna (replacement) | 0.10 | 0.01 (write 0.125) | 0.50 | 1.05M (922k max input) / 128k | yes: `none|low|medium|high|xhigh|max`, default medium | current | https://developers.openai.com/api/docs/models/gpt-6-luna.md |
| gpt-5.6-luna (nano-tier replacement) | 0.20 | 0.02 | 1.20 | 1.05M / 128k | yes, same as luna | current | https://developers.openai.com/api/docs/models/gpt-5.6-luna.md |

All of these list `structured_outputs` and support `v1/responses` and `v1/chat/completions`. Batch and Flex are priced at 50% of standard (https://developers.openai.com/api/docs/pricing.md), but they are asynchronous and unnecessary at this volume.

Does gpt-5-nano have minimal effort? **Yes.** "`reasoning.effort` supports `minimal`, `low`, `medium`, and `high`." GPT-5 introduced `minimal` as "our fastest option" (https://developers.openai.com/api/docs/guides/latest-model/gpt-5.md). gpt-5-nano does **not** accept `none`; `none` exists for the GPT-5.6 and 6 Luna models.

## 4. Cost of one submission review

### Token measurement (Vietnamese)

I measured with `js-tiktoken@1.0.21` on four vi.wikipedia literature articles (Lão Hạc, Chí Phèo, Vợ nhặt, Số đỏ; about 7k whitespace words total):

| Tokenizer | tokens / Vietnamese word (syllable) | 3,000-word chapter |
|---|---|---|
| `o200k_base` (gpt-4o/4.1/5 family) | 1.40–1.47 | **≈4,300** |
| `cl100k_base` (embeddings) | 2.15–2.27 | **≈6,700** |

Encyclopedic prose stands in for fiction here; dialogue-heavy chapters may differ by ±10% `[INFERENCE]`. The `gpt-6-luna` tokenizer is not published, so I assume o200k-like counts `[INFERENCE]`.

### Assumptions

**Embedding:**
- About 15 passages of ~200 words (~450 cl100k tokens each) plus ~15% overlap gives ≈7,700 tokens.
- 7,700 × $0.02/1M = **$0.000154**.
- The query side reuses the passage vectors, and corpus vectors come from earlier submissions, so there is no extra embedding cost.

**LLM, typical review (≈9,000 input tokens):**
- ~900 tokens of criteria and instructions
- ~200 tokens of rights context
- the full revision, ~4,300 tokens
- 10 retrieved passages, ~2,900 tokens
- ~500 tokens of schema and IDs
- Output: ~1,000 visible tokens (Vietnamese advisory JSON) plus reasoning. Reasoning is estimated at ~500 for minimal, ~3,000 for low, and ~8,000 for medium `[INFERENCE: not published per task; verify via usage.output_tokens_details.reasoning_tokens on the first real run]`.

**LLM, worst case:**
- 14,000 input tokens (20 passages)
- 2,000 visible output tokens
- reasoning of ~2,000 for minimal, ~6,000 for low, ~12,000 for medium
- 2× embedding

### Cost table (embedding + LLM, standard tier, no caching)

| Model / effort | $ per review (typical) | Reviews per $3 (typical) | $ per review (worst) | Reviews per $3 (worst) |
|---|---:|---:|---:|---:|
| gpt-5-nano, minimal | 0.00120 | 2,491 | 0.00261 | 1,150 |
| gpt-5-nano, low | 0.00220 | 1,361 | 0.00421 | 712 |
| gpt-5-nano, medium (default) | 0.00420 | 713 | 0.00661 | 453 |
| gpt-5-mini, minimal | 0.00540 | 555 | 0.01181 | 254 |
| gpt-5-mini, low | 0.01040 | 288 | 0.01981 | 151 |
| gpt-4o-mini (no reasoning) | 0.00210 | 1,425 | 0.00361 | 831 |
| gpt-4.1-mini (no reasoning) | 0.00535 | 560 | 0.00911 | 329 |
| **gpt-6-luna, low** | **0.00305** | **982** | **0.00571** | **525** |
| gpt-6-luna, none | 0.00155 | 1,930 | 0.00271 | 1,107 |
| gpt-5.6-luna, low | 0.00675 | 444 | 0.01271 | 236 |

Formula: `7,700×0.02e-6 + (in×P_in + (visible+reasoning)×P_out)/1e6`, computed with a node one-off. Embedding cost is about 2–10% of each review.

Hard cost ceiling per LLM call (useful for budget guards): `in×P_in + max_output_tokens×P_out`. For example, with gpt-6-luna, 14k input, and `max_output_tokens=6000`, the ceiling is $0.0044.

Any one-time backfill of existing published chapters into the vector index costs about $0.00015 per chapter (1,000 chapters ≈ $0.15). This only applies if pre-existing published chapters need vectors.

### Recommendation (ranked)

1. **`gpt-6-luna`, `reasoning.effort:"low"`.** It is current (not deprecated), supports Structured Outputs and Responses, and costs about $0.003 per review (~980 reviews in 3 USD, ≥525 worst case). Its context window (1.05M) is far beyond the need. `"low"` is documented for "data analysis, drafting… decision making"; `"none"` is documented for classification/latency (reasoning guide). Synthesizing over evidence needs some judgment.
   - Risk: access is unverified for this key. A `GET /v1/models` call has no token cost and confirms it, but I did not run it because of the no-OpenAI rule.
2. **`gpt-5-nano`, `reasoning.effort:"low"`.** This is the cheapest model in the user's verified list. Use it only if luna is unavailable and the project ends before **Dec 11, 2026**, when it is removed from the API.
3. `gpt-4o-mini`: cheap with no reasoning, but it shuts down Jan 14, 2027, and its 16k max output is fine. Weaker judgment on Vietnamese literary nuance `[INFERENCE]`.
4. `gpt-4.1-mini` / `gpt-5-mini` / `gpt-5.6-luna`: 2–5× the cost for no requirement-driven gain.

### Recommended configuration

| Setting | Value | Why |
|---|---|---|
| Package | `openai@^7.45.1` in `backend/package.json` | current; Node ≥22 matches the repo |
| Client | `new OpenAI({ apiKey: config.openai.apiKey, timeout: 60_000, maxRetries: 2 })` with an **explicit** `apiKey` (never rely on the env default) | Bounded latency. SDK retries cover transient 429/5xx/connection errors, so the app adds no second retry loop (rate-limits guide). |
| Embeddings | `embeddings.create({ model:'text-embedding-3-small', input: passages, encoding_format:'float' })`, no `dimensions` (1536) | one call per revision; cosine works on unit vectors |
| Embedding storage | Persist `model`, `dimensions:1536`, `chunkingVersion` (fields exist) | supports re-embedding and index checks |
| LLM call | `responses.create({ model: OPENAI_REVIEW_MODEL, input:[developer criteria msg, user evidence msg], text:{ format:{ type:'json_schema', name:'moderation_advisory', strict:true, schema } }, reasoning:{ effort: OPENAI_REVIEW_REASONING_EFFORT }, max_output_tokens: 6000, store:false })` | Strict JSON and a bounded cost; nothing stored server-side. Omit `reasoning` when the effort env var is empty (needed for 4o/4.1). |
| Caching | For gpt-5.6+/6 models: `prompt_cache_options:{ mode:'explicit' }`, with no breakpoint unless the static criteria block is ≥1,024 tokens | avoids paying 1.25× writes on single-use chapter text |
| Failure mapping | Each of these marks the LLM stage failed and enables manual review: `status:'incomplete'` (`max_output_tokens`, `content_filter`); a `refusal` content item; Zod validation failure; `APIError`. 429 billing codes, 400, 401, 403, and 404 are terminal; 429 rate limits, 5xx, and connection errors left after SDK retries are retryable by a new attempt (`retryOf`). | requirements 4 (`docs/requirements-baseline.md:127-134`) |
| Audit | Store `response.id`, `_request_id`, `model` (resolved snapshot), and `usage` (incl. `reasoning_tokens`) in `ProcessingAttempt.responseMetadata` | gives real cost tracking against the budget |
| Env | `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`, `OPENAI_REVIEW_MODEL=gpt-6-luna`, `OPENAI_REVIEW_REASONING_EFFORT=low`, `OPENAI_TIMEOUT_MS=60000`. Add them empty or as defaults to `.env.example` and validate them in `backend/src/config/env.js` like the Google keys. | matches the existing env/config pattern (`backend/src/config/env.js:100-147`) |
| Budget guard | Set an OpenAI **project hard spend limit** of $3 for this key. Enforcement is "not instantaneous", so recorded spend can slightly exceed it, and the error comes back as 429 `project_spend_limit_exceeded`. | https://developers.openai.com/api/docs/guides/spend-limits.md |

## 5. Keeping tests from calling OpenAI

I found no official OpenAI guidance on mocking in the reviewed docs (SDK README, error-codes, rate-limits, structured-outputs). The SDK does document a `fetch` override ("Customizing the fetch client": `new OpenAI({ fetch })`) and `baseURL` / `OPENAI_BASE_URL` (README; client.ts ~544-560).

Ranked approach:

1. **Provider adapter injection (primary).** Create `createOpenAIProvider(config.openai)`, which returns `{ embed(texts), synthesize(input) }`. Wire it as `config.aiProvider ?? (config.openai ? createOpenAIProvider(config.openai) : null)`, mirroring `backend/src/routes/auth.routes.js:136-137`. Pipeline and route tests pass a deterministic fake through `testConfig({ aiProvider })`, the same way as `backend/test/auth.test.js:569`.
   - Fakes return fixed unit vectors and canned advisory JSON, and can throw typed failures to exercise the failed-stage and manual-review paths.
   - The similarity stage needs the same seam (a `similaritySearch` adapter) because the test MongoDB has no mongot or `$vectorSearch` (`backend/test/global-setup.js:7-10`).
2. **One adapter contract test** that constructs the real SDK client with `fetch: fakeFetch`. The fake returns recorded JSON shapes: an embeddings list with `index`, a Responses object with `output_text`/`refusal`/`incomplete`, and 429/400 error bodies. This tests request shaping, response parsing, and SDK error-class mapping with no network. It is simpler than a local HTTP stub via `baseURL`.
3. **Avoid `vi.mock('openai')`.** The SDK ships frequent 7.x minors and says some backwards-incompatible changes "may be released as minor versions" (README "Semantic versioning"), so module mocks of its internals are brittle.

Safety nets:
- `testEnv` is built from `.env.example` (`backend/test/config.js:4-8`), so keep `OPENAI_API_KEY=` empty there.
- Build the real provider only when the validated config has a key. Never call `new OpenAI()` without `apiKey`, because the SDK silently falls back to `process.env.OPENAI_API_KEY` (client.ts ~563), which could leak a developer's shell key into tests.

## 6. Data safety

- "As of March 1, 2023, data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in)." The endpoint table lists "Data used for training: No" for `/v1/embeddings` and `/v1/responses` (https://developers.openai.com/api/docs/guides/your-data.md; also https://openai.com/index/new-embedding-models-and-api-updates/).
- Abuse-monitoring logs may contain prompts and responses and are kept **up to 30 days** by default, for both `/v1/embeddings` and `/v1/responses`. Zero Data Retention and Modified Abuse Monitoring require OpenAI approval (sales). `/v1/responses` application state is kept 30 days when `store` is true (the default), so use `store:false` (your-data guide).
- Sending author chapter text is necessary and consistent with OpenAI policy. Under the documented defaults it is not used for training, but it may be retained ≤30 days for abuse monitoring.
- Optionally send `safety_identifier` = sha256 of the author account ID, so classifier enforcement targets one user rather than the whole project (create reference). This is optional, not required.
- Literary content (violence, sexual themes) can trigger refusals or `content_filter`. Treat these as LLM-stage failures that go to manual review, never as a verdict.

## Limitations

- I did not run live OpenAI calls (forbidden). Reasoning-token counts per effort are estimates; check them against `usage` on the first real run.
- Model access for this key (`gpt-6-luna`) is unverified.
- Vietnamese token ratios come from encyclopedic text, not fiction.
- Evaluating LLM quality for Vietnamese literary moderation was out of scope.

## Open risks / unknowns

1. **Shutdown dates:** `gpt-5-nano`/`gpt-5-mini` stop working on Dec 11, 2026, and `gpt-4o-mini`/`gpt-4.1-mini` on Jan 14, 2027. Any hard-coded choice from the user's list breaks within 2.5 months, so make the model an env value. Does the key have `gpt-6-luna` access? Confirm with a free `GET /v1/models` before choosing the default.
2. Reasoning-token usage at `low` on luna/nano for this prompt is unmeasured. The budget math could move by about 2×. `max_output_tokens` caps the worst case.
3. Exactly-once billing is impossible (no provider idempotency key). Lease expiry or SDK timeout retries can double-charge one call. CAS keeps the data correct but not the spend.
4. The hard spend limit lags enforcement, so the 3 USD budget can be slightly exceeded. Dev smoke tests count against the same budget.
5. Refusal and content-filter rates on mature Vietnamese fiction are unknown. A high rate would push many reviews to manual review.
6. The 1536-dimension choice is effectively permanent once the mongot index and artifacts exist. Changing it means re-embedding everything.
