# Moderation evidence worker

**Status: DRAFT FOR REVIEW.** This page explains how to configure, provision,
run, roll back and troubleshoot the AI evidence worker that prepares
submissions for human moderation. The code in `backend/src/modules/ai/` and
`backend/src/modules/moderation/` owns the exact behavior.

## What the worker does

Every story or chapter submission creates an evidence batch in `pending`, and
the submission stays `validated` until the worker has finished. The worker
runs three stages for each batch, in order:

1. **Embedding.** The submitted revision is split into passages (chunking
   version 1) and each passage is embedded with OpenAI embeddings. The vectors
   are stored in `embeddingArtifacts`.
2. **Comparison.** For a chapter, MongoDB `$vectorSearch` on the
   `embedding_vectors` index finds the nearest passages of other authors'
   published chapters and open chapter submissions. Matches are stored in
   `similarityFindings`; finding nothing is a successful, empty discovery.
3. **LLM review.** The OpenAI Responses API reads the submitted text (capped at
   60,000 characters) together with the strongest findings and returns a
   strict JSON advisory review, stored in `llmReviews`.

A story-metadata submission embeds its title and synopsis, skips the vector
comparison (it is recorded as a successful empty discovery) and still gets the
LLM review.

When the LLM stage succeeds, the batch becomes `available-for-human-review`
and the submission moves to `pending-review` in the same transaction, so it
appears in the moderator queue. When a stage fails for good, the batch becomes
`failed` with `failedStage` set to that stage, and the submission still moves
to `pending-review`: the moderator reviews it manually.

AI output is advisory (decision-log items 5 and 28). The worker never approves
or rejects anything; a moderator claims the submission and decides. The
decision notifies the author in-app with a `publication.decided`
notification; decision e-mail is deferred.

## Designated runner

Every teammate's backend connects to the same shared development database, so
exactly one process may run the worker. That process sets
`AI_EVIDENCE_WORKER_ENABLED=true`; every other backend keeps the default
`false`, and `backend/.env` always keeps `false`.

Enable the worker for one process only, with a shell variable. A variable that
is already set in the shell wins over `backend/.env`.

In Bash (including Git Bash):

```bash
AI_EVIDENCE_WORKER_ENABLED=true npm run start --workspace backend
```

In PowerShell, set the variable for the session, start the backend, and clear
the variable after the backend stops so no later command inherits it:

```powershell
$env:AI_EVIDENCE_WORKER_ENABLED = 'true'
npm run start --workspace backend
# after stopping the backend:
Remove-Item Env:AI_EVIDENCE_WORKER_ENABLED
```

Every processing attempt records the process that ran it in
`responseMetadata.runner` as `hostname:pid`, and the start-up log line
`AI evidence worker started` carries the same `runner` value. The preflight
(see [Smoke check](#smoke-check)) lists every runner that holds a fresh lease
and blocks while any exists. An idle worker holds no lease, so the preflight
cannot prove that no other worker is running; agree on the single runner with
the team before enabling it.

## Configuration

The worker reads section 11 of `backend/.env.example`. The OpenAI key lives
only in the ignored `backend/.env`; never commit it or paste it into chat,
logs or documents.

| Key                              | Default                  | Meaning                                                                                                                                  |
| -------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `MODERATION_CLAIM_HOURS`         | `24`                     | Hours a moderator's claim lasts. After it expires, the submission returns to the queue and another moderator can take it over.          |
| `AI_EVIDENCE_WORKER_ENABLED`     | `false`                  | Starts the worker in this process when `true`. Only the designated runner sets it, with a shell variable.                               |
| `OPENAI_API_KEY`                 | empty                    | OpenAI key. Without it the worker does not start and paid commands refuse to run.                                                        |
| `OPENAI_EMBEDDING_MODEL`         | `text-embedding-3-small` | Embedding model for submissions and the backfill.                                                                                        |
| `OPENAI_REVIEW_MODEL`            | `gpt-6-luna`             | Model for the LLM review.                                                                                                                |
| `OPENAI_REVIEW_REASONING_EFFORT` | `low`                    | Reasoning effort of the review model (`none`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`).                                     |
| `OPENAI_TIMEOUT_MS`              | `60000`                  | Timeout of one OpenAI request in milliseconds. The SDK does not retry; the worker owns retries.                                          |
| `AI_EVIDENCE_INTERVAL_SECONDS`   | `30`                     | Seconds between worker sweeps. Each sweep advances up to 10 submissions, oldest first.                                                   |
| `SIMILARITY_TOP_K`               | `5`                      | Nearest passages retrieved for each submitted passage.                                                                                   |
| `VECTOR_SEARCH_INDEX`            | `embedding_vectors`      | Name of the vector search index on `embeddingArtifacts`.                                                                                 |
| `AI_BUDGET_USD`                  | `3`                      | Total OpenAI spend allowed, in USD, for the worker and the backfill together.                                                           |
| `AI_BUDGET_WINDOW_START`         | empty                    | ISO date from which spend is counted against `AI_BUDGET_USD`. Empty counts all recorded spend.                                           |

Both models must have a price in `backend/src/modules/ai/pricing.js`. For a
model without a price the worker pauses every paid stage and logs
`ai pricing unknown; provider stages paused`.

## Preparing an environment

Run these from the repository root, in order, against the database in
`backend/.env`:

1. `npm run db:diff-indexes --workspace backend` previews, read-only, what an
   index sync would create or drop. Stop if it prints `INDEX DIFF BLOCKED`.
2. `npm run db:create-indexes --workspace backend -- --models ModerationHistory,EmbeddingArtifact,LlmReview`
   creates the missing collections and indexes of the named models only. It
   never drops an index.
3. `npm run db:sync-search-indexes --workspace backend` creates or updates
   the `embedding_vectors` vector search index and waits until it reports
   `READY (queryable)`. It needs a database with mongot, which the shared VPS
   database has and the in-memory test database does not.
4. `npm run db:backfill-embeddings --workspace backend -- --dry-run` plans
   embeddings for published chapters that have none yet, prints the estimated
   cost and writes the plan to `backend/.tmp/backfill-plan.json` (ignored by
   Git). It calls no provider and writes nothing to the database.
5. Review the plan, then run
   `npm run db:backfill-embeddings --workspace backend -- --plan .tmp/backfill-plan.json --max-usd <cap>`.
   The plan path is relative to `backend/`, where npm runs workspace scripts.
   The run embeds exactly the planned revisions that are still candidates,
   stops at the first failed revision, and ends with one
   `Backfill summary: {...}` line.

`npm run db:sync-indexes` is not used on the shared database. It calls
`syncIndexes()`, which drops every index that the models in this branch do not
define, so it can remove an index a teammate's branch added. It also never
creates the vector search index.

## Running

The worker starts together with the backend (`npm run dev:backend` or
`npm run start --workspace backend`) only when `AI_EVIDENCE_WORKER_ENABLED` is
`true` in that process. When the flag is off the backend logs
`AI evidence worker disabled (AI_EVIDENCE_WORKER_ENABLED is not true)`; when
the flag is on but no key is set it logs
`AI evidence worker not started: OPENAI_API_KEY is not set` and makes no
OpenAI call. Otherwise it logs `AI evidence worker started` with its `runner`
and sweeps every `AI_EVIDENCE_INTERVAL_SECONDS`.

On a graceful shutdown (Ctrl+C in a terminal, `SIGINT`/`SIGTERM`, or a nodemon
restart) the backend stops scheduling sweeps, waits for the running sweep to
finish and then disconnects, so the stage in progress is either committed or
rolled back. A forced kill (for example Task Manager, `taskkill /F`, or a
process-tree kill on Windows) skips this: the attempt in progress keeps its
lease until `leaseExpiresAt`, the next sweep marks it `stale` and retries it,
and usage of a provider call that was still in flight is not recorded. After a
forced kill, run the preflight and check `freshLeaseRunners` before starting
another runner.

## Budget and cost

Every processing attempt stores its cost in `responseMetadata.costUsd`
together with the provider's token usage, and every backfill artifact stores
its share in `costUsd`. Recorded spend is the sum of both since
`AI_BUDGET_WINDOW_START`.

The worker computes the worst-case cost of a stage before claiming it. It does
not claim a paid stage when recorded spend plus that worst case would reach
`AI_BUDGET_USD`; it logs `ai budget exhausted`, and the submission waits in
`validated` until the budget is raised or a new window starts. The real
backfill refuses to start when recorded spend plus its estimate would reach the
budget, except for a plan with nothing left to embed, which is a no-op. The
preflight blocks when the worst case of the queued backlog, the backfill and
the smoke together would reach the remaining budget.

At the default models a typical review costs about 0.003 USD and a chapter
embedding about 0.00015 USD. The backfill summary reports provider usage
(every billed request) separately from persisted usage (what the budget
ledger records). If it reports `"stopped":true`, or provider usage above
persisted usage, reconcile the usage on the OpenAI side before another paid
run. Keep a hard spend limit on the OpenAI project as a second line of
defense.

## Failure codes

A failed attempt records its code in `processingAttempts.failureCode`.
Retryable codes get up to three attempts per stage: the second runs at least
60 seconds and the third at least 120 seconds after the previous failure.
`persist-error` is retried once. A non-retryable code, or the last allowed
attempt, fails the batch to manual review. An attempt whose lease expires is
marked `stale` without a code and counts as one of the three attempts.

While a stage is being retried, the submission stays in the moderator
**processing** view. After a terminal failure, the queue and the review page
show `Giai đoạn AI thất bại: <stage>. Hãy kiểm duyệt thủ công.` and the
moderator reviews the package without AI evidence for the failed stage; a
chapter without a successful comparison shows that similarity could not be
checked, never "no similar passages". The moderator detail API returns the
codes in `evidence.attempts[].failureCode`.

| Code                       | Retryable | Meaning                                                                                                     |
| -------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `provider-unconfigured`    | no        | No OpenAI key or provider is configured for the stage.                                                      |
| `vector-index-unavailable` | depends   | Retryable for a `STALE` or still-building queryable index and for network errors; not for a missing or failed index. |
| `vector-search-timeout`    | yes       | `$vectorSearch` exceeded its 10-second limit.                                                               |
| `provider-rate-limited`    | yes       | OpenAI returned 429 for a rate limit.                                                                       |
| `provider-unavailable`     | yes       | OpenAI returned a 5xx error.                                                                                |
| `provider-timeout`         | yes       | The OpenAI request timed out (`OPENAI_TIMEOUT_MS`).                                                         |
| `provider-connection`      | yes       | The OpenAI request could not connect.                                                                       |
| `provider-quota`           | no        | OpenAI returned 429 for exhausted quota, credit or a project or organization spend limit.                   |
| `provider-rejected`        | no        | OpenAI rejected the request (another 4xx, for example a bad key or no access to the model).                 |
| `provider-error`           | no        | Any other provider error.                                                                                   |
| `embedding-count-mismatch` | no        | OpenAI returned a different number of vectors than passages sent; the billed usage is still recorded.       |
| `llm-refusal`              | no        | The review model refused to answer.                                                                         |
| `llm-incomplete`           | no        | The review response was incomplete, for example at the output token limit.                                  |
| `llm-output-invalid`       | no        | The review output was not valid JSON for the review schema.                                                 |
| `revision-unavailable`     | no        | The submitted revision is missing or no longer matches the submitted package.                               |
| `rights-unavailable`       | no        | The submission's rights declaration is missing.                                                             |
| `no-text`                  | no        | The revision has no text passages to embed.                                                                 |
| `embeddings-missing`       | no        | The comparison stage found no stored embeddings for the revision.                                           |
| `submission-closed`        | no        | The submission was closed before its stage ran; no provider call was made.                                  |
| `persist-error`            | once      | Saving a stage result failed; the stage is retried once.                                                    |
| `stage-error`              | no        | An unexpected error; the backend logs `Evidence stage failed` with the details.                             |
| `operator-disabled`        | no        | Written by `npm run ai:fail-pending` (the default `--reason`) when an operator sends pending evidence to manual review. |

## Rollback

1. Stop the designated runner, or restart it with
   `AI_EVIDENCE_WORKER_ENABLED=false`.
2. Run
   `npm run ai:fail-pending --workspace backend -- --reason operator-disabled --dry-run`
   to list the pending evidence batches a rollback would fail.
3. Run the same command without `--dry-run`. Every non-terminal batch of a
   `validated` submission fails with `operator-disabled`, and its submission
   moves to `pending-review` for manual review.
4. Only then revert code.

Never roll back by unsetting the key: the submissions would stay in
`validated` with no way to reach a moderator.

## Smoke check

`npm run smoke:moderation-review --workspace backend -- --preflight --confirm-single-runner`
is the read-only readiness check; it writes nothing to the database. It prints
one JSON line and then `PREFLIGHT OK`, or `PREFLIGHT BLOCKED: <reasons>` with
exit code 1. The JSON line shows the environment (`nodeEnv`), whether a key is
set and where it came from (`openaiKey`, `openaiKeySource`; never the key),
the models, whether this shell enables the worker (`workerEnabledInEnv`), the
budget and recorded spend, the queued backlog and its worst case, the backfill
plan size and estimate, the smoke's worst case, the runners holding a fresh
lease, and the number of active categories. The flag `--confirm-single-runner`
records that the operator has confirmed a single runner. Run the preflight
immediately before index writes, the backfill, starting the runner and the
smoke.

With the designated runner up, the live smoke
`npm run smoke:moderation-review --workspace backend -- --api http://localhost:4000/api`
writes to the shared database and spends a few cents of the budget. It prints,
in order:

- `backlog drained: <n> submissions`: older queued submissions were processed
  first, so the smoke does not wait behind them.
- `accounts ready`: the three smoke accounts (`source-author`, `author`,
  `moderator`) exist with their roles.
- `source story published` and `source chapter published: <id>`: a source
  story and a chapter of original sample prose went through review, approval
  and the real release endpoints.
- `story approved`: the submitter's story was approved.
- `chapter evidence: status=available-for-human-review stage=llm findings=<n> maxScore=<x> comparison=succeeded llm=succeeded`:
  the submitter's chapter, which copies the source passage, was found by
  `$vectorSearch` and reviewed by the LLM.
- `chapter rejected; canRevise=true`: the moderator rejected the chapter and
  the author can revise it.
- `notifications: in-app=2`: the author received both decision notifications
  of this run.
- `usage: ...`: tokens and cost of the smoke's four batches and the single
  runner that processed them.
- `smoke cleanup done` and `SMOKE PASSED`.

A failure prints `SMOKE FAILED: <step>: <detail>` and exits with code 1. The
smoke creates its accounts with reserved `.invalid` addresses, no password and
no mailbox, and marks every account and role it creates in `auditEvents` with
the reason `novelhub-smoke-v1`. Later runs reuse marked accounts. Cleanup runs
on pass and fail: it revokes only the role the smoke granted, invalidates the
accounts' authorization and deletes their sessions. The smoke stories,
chapters, decisions, history and notifications stay as ordinary records.

## Troubleshooting

- **The vector index is not `READY`.** Re-run
  `npm run db:sync-search-indexes --workspace backend` and wait for
  `READY (queryable)` before enabling the runner. A missing, failed or
  not-yet-queryable index fails comparisons to manual review with
  `vector-index-unavailable`; only a stale index, or one that rebuilds while
  still queryable, is retried. If the index stays unavailable, check the
  mongot logs as described in
  [the shared MongoDB notes](../infra/mongo/README.md).
- **The key is missing.** The backend logs
  `AI evidence worker not started: OPENAI_API_KEY is not set` and the
  preflight reports `OPENAI_API_KEY is not set`. Add the key to
  `backend/.env` on the runner only.
- **Quota errors.** Attempts fail with `provider-quota` or
  `provider-rate-limited`. Check the OpenAI project's limits and spend; quota
  failures go straight to manual review.
- **`ai budget exhausted`.** Recorded spend plus the next stage's worst case
  reaches `AI_BUDGET_USD`. Submissions wait in `validated`; raise the budget or
  start a new `AI_BUDGET_WINDOW_START` after agreeing on it, or roll back
  with `npm run ai:fail-pending`.
- **Submissions stuck in `validated`.** Check that exactly one runner logged
  `AI evidence worker started`, read its log for `ai budget exhausted` or
  `Evidence sweep candidate failed`, and inspect the batch's
  `processingAttempts` (stage, status, `failureCode`, `leaseExpiresAt` and
  `responseMetadata.runner`).
