# Live rollout: moderation review and AI evidence (Phase 04)

Every value below was printed by a Phase 04 command or given by the user. Nothing
was copied from `backend/.env`.

## Date

2026-10-29

## Operator confirmations

Task 4.3 step 1, verbatim:

- (a) OpenAI project hard limit: "Đã đặt hard limit ≤ 3 USD"
- (b) Single runner: "Xác nhận, máy này là runner duy nhất"

The worker flag was checked without printing any other value:
`AI_EVIDENCE_WORKER_ENABLED` is unset in `backend/.env` (default `false`) and
unset in the shell. Every preflight below reports `"workerEnabledInEnv":false`.

## Preflight

Task 4.3 step 2 (read-only; the same output was printed again immediately before
Tasks 4.5, 4.6 and 4.8):

```
{"nodeEnv":"development","openaiKey":true,"openaiKeySource":"dotenv","reviewModel":"gpt-6-luna","embeddingModel":"text-embedding-3-small","workerEnabledInEnv":false,"budgetUsd":3,"spentUsd":0,"remainingUsd":3,"backlogSubmissions":1,"backlogWorstCaseUsd":0.0052819,"backfillRevisions":29,"backfillEstimatedUsd":0.00030124,"smokeWorstCaseUsd":0.022054,"freshLeaseRunners":[],"activeCategories":9}
PREFLIGHT OK
```

Immediately before Task 4.9 (after the backfill):

```
{"nodeEnv":"development","openaiKey":true,"openaiKeySource":"dotenv","reviewModel":"gpt-6-luna","embeddingModel":"text-embedding-3-small","workerEnabledInEnv":false,"budgetUsd":3,"spentUsd":0.00012103999999999999,"remainingUsd":2.99987896,"backlogSubmissions":1,"backlogWorstCaseUsd":0.0052819,"backfillRevisions":0,"backfillEstimatedUsd":0,"smokeWorstCaseUsd":0.022054,"freshLeaseRunners":[],"activeCategories":9}
PREFLIGHT OK
```

Immediately before Task 4.10, with the designated runner up. The first run was
blocked only by the designated runner's own lease while it processed the one
queued submission (the runner id matches the Task 4.9 log). Following the
Task 4.10 "Before" rule, it was re-run after the backlog drained:

```
{"nodeEnv":"development","openaiKey":true,"openaiKeySource":"dotenv","reviewModel":"gpt-6-luna","embeddingModel":"text-embedding-3-small","workerEnabledInEnv":false,"budgetUsd":3,"spentUsd":0.00012286,"remainingUsd":2.99987714,"backlogSubmissions":1,"backlogWorstCaseUsd":0.0052805,"backfillRevisions":0,"backfillEstimatedUsd":0,"smokeWorstCaseUsd":0.022054,"freshLeaseRunners":["<runner-host>:2388"],"activeCategories":9}
PREFLIGHT BLOCKED: another runner holds a fresh lease: <runner-host>:2388
```

```
{"nodeEnv":"development","openaiKey":true,"openaiKeySource":"dotenv","reviewModel":"gpt-6-luna","embeddingModel":"text-embedding-3-small","workerEnabledInEnv":false,"budgetUsd":3,"spentUsd":0.00025146,"remainingUsd":2.99974854,"backlogSubmissions":0,"backlogWorstCaseUsd":0,"backfillRevisions":0,"backfillEstimatedUsd":0,"smokeWorstCaseUsd":0.022054,"freshLeaseRunners":[],"activeCategories":9}
PREFLIGHT OK
```

Task 4.11, after the runner stopped:

```
{"nodeEnv":"development","openaiKey":true,"openaiKeySource":"dotenv","reviewModel":"gpt-6-luna","embeddingModel":"text-embedding-3-small","workerEnabledInEnv":false,"budgetUsd":3,"spentUsd":0.00176656,"remainingUsd":2.99823344,"backlogSubmissions":0,"backlogWorstCaseUsd":0,"backfillRevisions":0,"backfillEstimatedUsd":0,"smokeWorstCaseUsd":0.022054,"freshLeaseRunners":[],"activeCategories":9}
PREFLIGHT OK
```

## Indexes

Task 4.4 (`npm run db:diff-indexes --workspace backend`, read-only; every other
collection printed `create [] drop []`):

```
embeddingArtifacts: create [] drop []
llmReviews: create [] drop []
moderationHistory: create [{"action":1,"occurredAt":-1}] drop []
INDEX DIFF OK: nothing would be dropped
```

Task 4.5
(`npm run db:create-indexes --workspace backend -- --models ModerationHistory,EmbeddingArtifact,LlmReview`):

```
moderationHistory: 4 indexes
embeddingArtifacts: 3 indexes
llmReviews: 2 indexes
```

Task 4.6 (`npm run db:sync-search-indexes --workspace backend`):

```
embedding_vectors: created
embedding_vectors: READY (queryable)
```

## Backfill

Task 4.7 dry run (`npm run db:backfill-embeddings --workspace backend -- --dry-run`;
the plan file was written to `backend/.tmp/backfill-plan.json`):

```
Backfill plan: 29 revisions, 29 passages, ~15062 tokens, ~$0.0003 (cap $0.5); 0 more remain
DRY RUN: nothing was embedded or written to the database.
Backfill summary: {"providerUsageTokens":0,"providerUsageUsd":0,"persistedUsageTokens":0,"persistedUsageUsd":0,"stopped":false,"failures":0}
```

Task 4.8 real run
(`npm run db:backfill-embeddings --workspace backend -- --plan .tmp/backfill-plan.json --max-usd 0.50`):

```
Backfill plan: 29 revisions, 29 passages, ~15062 tokens, ~$0.0003 (cap $0.5); 0 planned revisions are no longer candidates
Embedded 29 revisions (29 passages, ~$0.0001 recorded in the budget ledger); provider usage 6052 tokens (~$0.0001); 0 failed
Backfill summary: {"providerUsageTokens":6052,"providerUsageUsd":0.00012104000000000003,"persistedUsageTokens":6052,"persistedUsageUsd":0.00012104000000000003,"stopped":false,"failures":0}
```

Provider usage equals persisted usage, and the run did not stop, so there was
no provider-side usage to reconcile.

## Runner

Task 4.9: the service `novelhub-backend-smoke` was started from Bash with
`AI_EVIDENCE_WORKER_ENABLED=true npm run start --workspace backend`, with the
variable set for that process only. Log:

```
[20:31:55] INFO: connected to MongoDB
[20:31:55] INFO: AI evidence worker started {"runner":"<runner-host>:2388"}
[20:31:55] INFO: NovelHub API listening on port 4000
```

`curl -s http://localhost:4000/api/ready` printed
`{"status":"ready","database":"connected"}`. After the smoke, the service was
stopped (Task 4.11), and
`curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/ready`
printed `000`. The stop was a forced process kill on Windows (service exit code
1), so the backend's graceful shutdown did not run; the smoke had already
finished, and the final preflight below shows no fresh lease and no backlog.

Hostnames in this report are sanitized to `<runner-host>`.

## Smoke

Task 4.10 (`npm run smoke:moderation-review --workspace backend -- --api http://localhost:4000/api`):

```
backlog drained: 0 submissions
accounts ready
source story published
source chapter published: 6ae34b3d9e40147b0c3cbefa
story approved
chapter evidence: status=available-for-human-review stage=llm findings=5 maxScore=1.00 comparison=succeeded llm=succeeded
chapter rejected; canRevise=true
notifications: in-app=2
usage: embeddingTokens=655 llmInputTokens=7080 llmOutputTokens=1588 reasoningTokens=51 costUsd=0.0015 runner=<runner-host>:2388
smoke cleanup done
SMOKE PASSED
```

## OpenAI usage

| Item                                       | Tokens | USD                    |
| ------------------------------------------ | ------ | ---------------------- |
| Backfill, provider usage                   | 6052   | 0.00012104000000000003 |
| Backfill, persisted usage (budget ledger)  | 6052   | 0.00012104000000000003 |
| Smoke embedding tokens                     | 655    |                        |
| Smoke LLM input tokens                     | 7080   |                        |
| Smoke LLM output tokens                    | 1588   |                        |
| Smoke LLM reasoning tokens                 | 51     |                        |
| Smoke total (four batches)                 |        | 0.0015                 |
| Total recorded spend (Task 4.11 `spentUsd`) |       | 0.00176656             |

The total also includes the one queued submission that the designated runner
processed before the smoke. Before Task 4.10, `spentUsd` went from
`0.00012103999999999999` (after the backfill) to `0.00025146` (backlog drained).

## Budget check

The final `spentUsd` from Task 4.11 is `0.00176656` USD of the `3` USD budget
(`remainingUsd` `2.99823344`), which is at most 3 USD.
