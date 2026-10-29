---
phase: 4
title: "Phase 4: Shared-environment rollout, live smoke and documentation"
status: completed
priority: P1
effort: 6h
dependencies: [1, 2, 3]
---

# Phase 4: Shared-environment rollout, live smoke and documentation

<!-- Updated: Validation Session 1 - renumbered from Phase 05 after the decision e-mail phase was removed; no e-mail or SMTP step remains -->

## Goal

The shared development environment (the database in `backend/.env`, with mongot on the group VPS) runs the full moderator flow for real. Indexes are added without dropping anything; the vector index is queryable; published chapters are backfilled from a reviewed plan within a cost cap; one designated local backend runs the evidence worker; a smoke script publishes a known source passage through the real author, moderator and release APIs, submits a chapter that copies it, and proves that `$vectorSearch` found it, that the LLM stage succeeded, that a moderator could claim and decide, and that the author received the in-app notifications. Observed OpenAI usage is recorded against the 3 USD budget, the smoke accounts are cleaned up, and the operating documentation is updated.

All paths are relative to `novelhub/`. Run every command from the stated working directory. This is the only phase allowed to write to the shared database, and only in the tasks marked **writes to the shared database**. Never print values from `backend/.env`.

## Context Links

- Authoritative design: [design decisions](./reports/design-decisions.md) item 5 of "Scope".
- Red team: [red-team findings](./reports/red-team-findings.md) groups 1, 3, 10, 13 and 15 (group 9 is not applicable after Validation Session 1).
- Shared database operations: `infra/mongo/README.md:52-67`.
- Cost model: [OpenAI research](./research/researcher-01-openai.md) lines 7-11 and 165; the worst-case formulas of [Phase 02](./phase-02-ai-evidence-pipeline.md) Task 2.9.
- Executor rules and the 3 USD budget: [plan](./plan.md).

## Key Insights

- <!-- Red Team: group 15 --> `npm run db:sync-indexes` calls `syncIndexes()` for every model and drops any index not defined in the models (`backend/scripts/sync-indexes.js:15-24`), which can remove indexes a teammate's branch added to the shared database. Mongoose offers a read-only `Model.diffIndexes()` that reports `{ toDrop, toCreate }` (`node_modules/mongoose/lib/model.js:1454-1463`), and `Model.createIndexes()` only creates. This phase uses those two instead.
- Phase 02 added `npm run db:sync-search-indexes` (prints `embedding_vectors: created|updated|unchanged`, then `embedding_vectors: READY (queryable)`), `npm run db:backfill-embeddings` (a dry run prints `Backfill plan: ...`, `Plan written to ...` and `DRY RUN: nothing was embedded or written to the database.`; a real run needs `--plan` and prints `Embedded ...`) and `npm run ai:fail-pending` (rollback).
- <!-- Updated: Kongming Phase 03 gate - backfill summary line --> `npm run db:backfill-embeddings` prints one stable line `Backfill summary: {"providerUsageTokens":N,"providerUsageUsd":X,"persistedUsageTokens":N,"persistedUsageUsd":X,"stopped":B,"failures":N}` from the summary `backfillEmbeddings()` returns (`backfillSummaryLine` in `backend/src/modules/ai/embedding-backfill.js`). It holds no configuration value. Tasks 4.8 and 4.12 record it.
- <!-- Updated: Kongming Phase 03 gate - mongoose autoCreate --> Mongoose's default `autoCreate: true` makes every compiled model call `createCollection()` once a script connects (`node_modules/mongoose/lib/model.js:1155-1179`, `node_modules/mongoose/lib/mongoose.js:71`). The read-only commands (`db:diff-indexes` and the smoke `--preflight`) therefore call `mongoose.set('autoCreate', false)` before connecting, so they create nothing on the shared database.
- The server logs `NovelHub API listening on port <PORT>` when ready (`backend/src/server.js:38-40`); `/api/ready` returns `{"status":"ready","database":"connected"}` (`README.md:28-29`). After Phase 02 it logs `AI evidence worker started` only when `AI_EVIDENCE_WORKER_ENABLED=true` and a key is set, otherwise `AI evidence worker disabled (AI_EVIDENCE_WORKER_ENABLED is not true)`.
- <!-- Red Team: group 1 --> Every teammate's backend connects to the same shared database (`README.md:23`), so the worker must run in exactly one process. `loadDotenv` keeps variables already set in the shell (`backend/src/config/load-dotenv.js:5-18`), so the designated runner enables the worker with a shell variable for its own process and `backend/.env` keeps `AI_EVIDENCE_WORKER_ENABLED=false`.
- Sessions can be issued directly with `issueSession(account, ttlDays)`, which returns `{ token, expiresAt }` (`backend/src/auth/session.js:67-79`), the same way the test fixture does (`backend/test/fixtures/accounts.js:18-19`). A moderator role cannot be granted to an account with `everAuthor` (`backend/src/models/identity/role-assignment.model.js:21-26`). `Account.password` is `select: false` (`backend/src/models/identity/account.model.js:57`); `AuditEvent` has `action`, `targetType`, `targetId`, `result`, `reason` and no free-form metadata (`backend/src/models/audit/audit-event.model.js:3-25`). Categories have `status` and `sortKey` (`backend/src/models/governance/category.model.js:7-8`).
- <!-- Red Team: group 13 --> Story release is `GET`/`POST /api/author/stories/:storyId/release` with `{ revisionId, submissionId, expectedVersion }`; chapter release is `GET`/`POST /api/author/stories/:storyId/chapters/:chapterId/release` with `{ revisionId, submissionId, expectedVersion, expectedStoryVersion }` (`backend/src/routes/author-content.routes.js:361-432`). The chapter `GET` returns `target.{ revisionId, submissionId, version, storyVersion }` and `ready` (`backend/src/modules/author-chapter-release.js:166-178`); a free chapter without early-access terms passes the `free` check (`:46`).
- Docs rules: no secrets, personal data or machine-specific paths in committed docs (`docs/README.md:45-47`, `docs/decision-log.md:97-100`); `docs/` and `plans/` are excluded from Prettier, `README.md` and `infra/mongo/README.md` are not (`.prettierignore:5-7`).
- <!-- Updated: Kongming Phase 03 gate - preflight before every live step --> Run the Task 4.3 step 2 preflight immediately before the index writes (Tasks 4.5 and 4.6), the real backfill (Task 4.8), the runner start (Task 4.9) and the smoke (Task 4.10), and continue only on `PREFLIGHT OK`. A fresh lease does not prove that no other worker is alive (an idle worker holds no lease); the user's single-runner confirmation stays required.

## Files to Create / Modify / Delete

<!-- Red Team: groups 1, 3, 10, 13, 15 -->
| Action | Path | Purpose |
|---|---|---|
| Create | `backend/scripts/diff-indexes.js` | Read-only index preview that blocks on any drop. |
| Create | `backend/scripts/create-indexes.js` | Non-destructive `createIndexes()` for named models. |
| Create | `backend/scripts/smoke-moderation-review.js` | Read-only preflight and the live end-to-end smoke with cleanup. |
| Modify | `backend/package.json` | Scripts `db:diff-indexes`, `db:create-indexes`, `smoke:moderation-review`. |
| Create | `backend/src/db/index-diff.js` | <!-- Updated: Kongming Phase 03 gate - testable helpers --> `diffModelIndexes(models, { log })` used by `diff-indexes.js`; translates only the missing-namespace error. |
| Create | `backend/src/modules/ai/rollout-preflight.js` | `moderationPreflight(config)` (read-only facts) and `preflightBlockers(result, { confirmSingleRunner })` used by the smoke script. |
| Modify | `backend/src/modules/ai/embedding-backfill.js` | A zero-cost real run skips the budget rejection; `backfillSummaryLine(summary)`. |
| Modify | `backend/scripts/backfill-embeddings.js` | Captures the returned summary and prints `Backfill summary: {json}`. |
| Create | `backend/test/index-diff.test.js`, `backend/test/ai-rollout-preflight.test.js` | Tests for the diff helper and the preflight (exact-budget boundary, read-only). |
| Modify | `backend/test/ai-embedding-backfill.test.js` | Zero-revision plan with an exhausted budget; summary line fields. |
| Create | `plans/261029-0745-moderation-review-and-ai-evidence/reports/live-rollout.md` | Recorded live outputs, confirmations and OpenAI usage. |
| Create | `docs/moderation-evidence.md` | Operating the evidence worker. |
| Modify | `README.md` | Commands table rows and a link to the new doc. |
| Modify | `infra/mongo/README.md` | Vector index operations (lines 63-67). |
| Modify (only if needed) | `backend/.env.example` | Comments for section 11 if Phases 01-02 left any key undocumented. |

`docs/decision-log.md` is not changed: no product rule changed, and the implementation follows confirmed decisions 5, 6, 25, 28 and 30 (decision e-mail is deferred by the user, see plan.md).

## Tasks

### Task 4.1 — Index preview and non-destructive index scripts

<!-- Red Team: group 15 -->
- **Goal:** the shared database gets the new and changed indexes without any risk of dropping a teammate's index.
- **Target files and symbols:** create `backend/scripts/diff-indexes.js` and `backend/scripts/create-indexes.js`; add `"db:diff-indexes": "node scripts/diff-indexes.js"` and `"db:create-indexes": "node scripts/create-indexes.js"` to `backend/package.json` `scripts`.
- **Steps:**
  1. Both scripts start like `backend/scripts/sync-indexes.js:3-13` (`loadEnv`, `loadDotenv`, `connectDatabase`, `import '../src/models/index.js'`) and call `disconnectDatabase()` in `finally`.
  2. `diff-indexes.js` (header comment: read-only; shows what `syncIndexes()` would change and never changes it): calls `mongoose.set('autoCreate', false)` before connecting, then `diffModelIndexes(models)` from `backend/src/db/index-diff.js` for `mongoose.modelNames().sort()`; for each model `const { toDrop, toCreate } = await model.diffIndexes()`; print `<collection>: create <toCreate as JSON> drop <toDrop as JSON>`. Collect every non-empty `toDrop`. At the end print `INDEX DIFF OK: nothing would be dropped` with exit code 0, or `INDEX DIFF BLOCKED: <collection> would drop <names>` (one clause per collection, joined with `; `) with `process.exitCode = 1`. <!-- Updated: Kongming Phase 03 gate - narrow missing-collection handling --> Mongoose 9 `diffIndexes()` already treats a missing collection as one with no indexes (`node_modules/mongoose/lib/model.js:1470-1478`). The helper still catches only the missing-namespace error (`codeName === 'NamespaceNotFound'` or `code === 26`) and prints `<collection>: missing collection (would be created)`; it rethrows every other error (authentication, network, server selection, malformed index metadata), so the script fails instead of reporting a diff it never inspected.
  3. `create-indexes.js` (header comment: non-destructive; creates missing indexes for the named models only): `parseArgs` option `models` (string, required); split on commas; every name must be in `mongoose.modelNames()` or the script throws `new Error('Unknown model: <name>')` before touching the database; it calls `mongoose.set('autoCreate', false)` before connecting so only the named models' collections are created <!-- Updated: Kongming Phase 03 gate - mongoose autoCreate -->; for each model `await model.createCollection()`, `await model.createIndexes()`, `const indexes = await model.listIndexes()`; print `<collection>: <indexes.length> indexes`. It never calls `syncIndexes` or `dropIndex`.
- **Success criteria:** neither script can drop an index.
- **Verify:** from `novelhub/backend` run `node --check scripts/diff-indexes.js && node --check scripts/create-indexes.js && npx vitest run test/index-diff.test.js && npm run lint`. Pass: exit code 0, the test summary has no `failed`, and no ESLint problems printed. <!-- Updated: Kongming Phase 03 gate - helper test -->

### Task 4.2 — Smoke and preflight script

<!-- Red Team: groups 1, 3, 10, 13 --> <!-- Updated: Validation Session 1 - no SMTP flag, no e-mail delivery check, no outbox rows; in-app notifications only -->
- **Goal:** one script checks readiness read-only, and runs a live smoke that proves real vector retrieval, decides through the moderator API, verifies in-app notifications, and always cleans up its accounts.
- **Target files and symbols:** create `backend/scripts/smoke-moderation-review.js`; add `"smoke:moderation-review": "node scripts/smoke-moderation-review.js"` to `backend/package.json` `scripts`.
- **Steps:**
  1. Options with `parseArgs` from `node:util`: `preflight` (boolean, default false), `confirm-single-runner` (boolean, default false), `api` (string, default `http://localhost:4000/api`), `timeout-seconds` (string, default `300`).
  2. Common start: `loadDotenv()`, `const env = loadEnv()`; if `env.NODE_ENV === 'production'` throw `new Error('Smoke checks are disabled in production')`; `const config = toAppConfig(env)`; with `--preflight`, `mongoose.set('autoCreate', false)` <!-- Updated: Kongming Phase 03 gate - read-only connect -->; `connectDatabase(env.MONGODB_URI, { serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS })`; import `../src/models/index.js`; always `disconnectDatabase()` in `finally`. Print failures as `SMOKE FAILED: <step>: <detail>` (or `PREFLIGHT BLOCKED: <reasons>`) and set `process.exitCode = 1`. Never print `env` values other than `NODE_ENV`.
  3. Preflight (`--preflight`, read-only). Compute:
     - `spentUsd = await spentUsd(config)`, `remainingUsd = config.ai.budgetUsd - spentUsd`;
     - `backlog = await worstCaseBacklogUsd(config)` (Phase 02 Task 2.9);
     - the backfill plan from `backfillEmbeddings(config, { dryRun: true, maxUsd: config.ai.budgetUsd, planPath: os.tmpdir() + '/novelhub-preflight-plan.json', log: () => {} })` (`candidates.length`, `estimatedUsd`; the temporary file is outside the repository). `backfillEmbeddings` rejects a non-finite `maxUsd` and throws `Estimated cost $… exceeds the cap …` when the estimate is above the cap: catch that error and add the blocking reason `backfill estimate exceeds the AI budget` (never print the error with any env value). <!-- Updated: Kongming Phase 02 gate - finite cap; backfill summary fields are providerUsage*/persistedUsage*/stopped -->
     - Backfill real-run summaries now report `providerUsageTokens`/`providerUsageUsd` (every known billed request) separately from `persistedUsageTokens`/`persistedUsageUsd` (ledger), and stop on the first failed revision (`stopped: true`). Task 4.8 records both; if `stopped` is true or provider usage exceeds persisted usage, STOP and reconcile provider-side usage before any further paid run.
     - <!-- Updated: Kongming Phase 03 gate - preflight module --> The facts and the blocking reasons live in `backend/src/modules/ai/rollout-preflight.js` (`moderationPreflight(config)` and `preflightBlockers(result, { confirmSingleRunner })`) so the budget boundary is unit-tested; the script prints them.
     - `smokeWorstCaseUsd = 4 * (worstCaseEmbeddingUsd(config, 4000) + worstCaseReviewUsd(config, 4000))` (four smoke submissions of at most 4,000 characters);
     - `freshLeases = await ProcessingAttempt.find({ status: { $in: ['claimed', 'started'] }, leaseExpiresAt: { $gt: new Date() } }).select('responseMetadata.runner').lean()`;
     - `activeCategories = Category.countDocuments({ status: 'active' })`.
     Print one JSON line `{"nodeEnv":...,"openaiKey":<bool>,"openaiKeySource":"shell|dotenv|unset","reviewModel":...,"embeddingModel":...,"workerEnabledInEnv":<bool>,"budgetUsd":X,"spentUsd":X,"remainingUsd":X,"backlogSubmissions":N,"backlogWorstCaseUsd":X,"backfillRevisions":N,"backfillEstimatedUsd":X,"smokeWorstCaseUsd":X,"freshLeaseRunners":[...],"activeCategories":N}` where `openaiKey = Boolean(config.ai.openai)` and `workerEnabledInEnv = config.ai.workerEnabled`. Then print `PREFLIGHT OK`, or `PREFLIGHT BLOCKED: <reasons>` with exit code 1 when any of these hold: `!openaiKey` (`OPENAI_API_KEY is not set`); `!values['confirm-single-runner']` (`operator has not confirmed a single runner`); `freshLeases.length > 0` (`another runner holds a fresh lease: <runners>`); `backlog.submissions > 10` (`backlog above 10 submissions`); any cost is `null` (`no price for the configured model`); `backlog.usd + backfillEstimatedUsd + smokeWorstCaseUsd >= remainingUsd` (`worst-case spend exceeds the remaining budget`); `activeCategories === 0` (`no active category`). <!-- Updated: Kongming Phase 03 gate - budget boundary >= --> The total blocks at `>=`, the same non-spending boundary as the worker gate (`evidence-worker.js` `sweep.spentUsd + stageCost >= budgetUsd`) and the real backfill guard (`spent + estimate >= budgetUsd`), so an exact-budget estimate cannot pass the preflight and then fail the real run.
  4. Smoke run (default mode, **writes to the shared database**):
     1. `GET <api>/ready` must be 200, else fail `backend not ready`.
     2. Drain: `smokeStart = new Date()`; `backlog = PublicationSubmission.countDocuments({ status: 'validated', submittedAt: { $lt: smokeStart }, authorAccountId: { $nin: inactiveAuthorIds } })`; above 10 → fail `backlog above 10`; otherwise poll every 5 seconds until it is 0, with a timeout of `120 + 90 * backlog` seconds (fail `backlog did not drain`). Print `backlog drained: <backlog> submissions`.
     3. `ensureSmokeAccount(role, label)`: candidates are accounts with an `AuditEvent` `{ action: 'smoke.account-created', targetType: 'Account', reason: 'novelhub-smoke-v1', result: label }`; reuse a candidate only if it is `active`, has `emailVerifiedAt`, `Account.findById(id).select('+password')` has no `password`, it holds no active `RoleAssignment` for another role, and (for `moderator`) it has no `everAuthor` <!-- Updated: Kongming Phase 03 gate - reuse never collides with a foreign role -->. Otherwise create `{ displayName: 'NovelHub Smoke ' + label, email: 'novelhub-smoke-' + label + '-' + randomBytes(4).toString('hex') + '@smoke.novelhub.invalid', normalizedEmail: same lower-cased, status: 'active', emailVerifiedAt: new Date(), everAuthor: role === 'author' }` and write `AuditEvent { actorType: 'system', action: 'smoke.account-created', targetType: 'Account', targetId, result: label, reason: 'novelhub-smoke-v1', occurredAt }` in the same transaction. When the account lacks an active `RoleAssignment` for `role`, create `{ accountId, role, grantedBy: accountId }` and write `AuditEvent { actorType: 'system', action: 'smoke.role-granted', targetType: 'Account', targetId, result: role, reason: 'novelhub-smoke-v1', occurredAt }` in one transaction. Labels: `source-author` (role `author`), `author` (role `author`), `moderator` (role `moderator`). Print `accounts ready`. No real mailbox is involved (the `.invalid` domain is reserved and no e-mail is sent).
     4. Cookies: `env.AUTH_COOKIE_NAME + '=' + (await issueSession(account, 1)).token` for the three accounts. HTTP helper with global `fetch`: headers `Cookie`, `Origin: env.CORS_ORIGIN.split(',')[0].trim()`, `Content-Type: application/json`; returns `{ status, body }`.
     5. `submitAndReview(author, payload)`: for a story, `POST /author/stories` with `{ title, description, categoryIds: [String(category._id)] }` (201; category = `Category.findOne({ status: 'active' }).sort({ sortKey: 1 })`), `GET /author/submissions/prepare?storyId=<storyId>` (200), `POST /author/submissions` with `{ storyId, revisionId: prepared.target.revisionId, expectedVersion: prepared.target.version, rights: { basis: 'original', asserted: true, sourceLicenceNote: '' } }` (201) — the same requests as `submitStory` in `backend/test/fixtures/submissions.js` (Phase 01 Task 1.11); for a chapter, `POST /author/stories/<storyId>/chapters` with `{ title, paragraphs }` (201), prepare with `chapterId`, submit (201). Then `waitForReview(id)`: every 5 seconds `GET /moderator/submissions/<id>` as the moderator until `submission.status !== 'validated'` or `timeout-seconds` passes (fail `evidence timeout`); require `evidence.batch.status === 'available-for-human-review'` and `evidence.llmReview.status === 'succeeded'`.
     6. `decide(id, decision, feedback)`: claim with `{ expectedVersion: submission.version }` (200), then `POST /moderator/submissions/<id>/decision` with `{ decision, feedback, expectedVersion, evidenceBatchId: batch.id, evidenceBatchVersion: batch.version }` (200).
     7. Source (author `source-author`): story `{ title: 'Smoke nguồn ' + smokeStart.toISOString(), description: 'Truyện nguồn dùng để kiểm tra đối chiếu tương đồng của NovelHub. Nội dung do nhóm phát triển tự viết.' }` → review → approve → `GET /author/stories/<storyId>/release` then `POST` the same path with `{ revisionId: target.revisionId, submissionId: target.submissionId, expectedVersion: target.version }` (201); print `source story published`. Chapter `{ title: 'Chương nguồn smoke', paragraphs: P }` where P is exactly these three paragraphs: `Sáng sớm, sương còn đọng trên mái ngói khi Minh đẩy cánh cửa gỗ của tiệm sách cũ. Mùi giấy ẩm và mực in quen thuộc ùa ra, kéo anh về những mùa hè tuổi thơ ngồi đọc truyện dưới quạt trần.`; `Bà chủ tiệm đặt lên quầy một cuốn sổ bìa da đã sờn góc. Bà nói đó là nhật ký của người thợ đóng sách từng làm việc ở đây, và chưa ai đọc hết những trang cuối cùng.`; `Minh lật trang đầu tiên. Nét chữ nghiêng, đều đặn, kể về một thành phố ven sông nơi mỗi ngôi nhà giữ một câu chuyện riêng, chỉ chờ người biết lắng nghe.` → review → approve → `GET /author/stories/<storyId>/chapters/<chapterId>/release` (require `ready === true`) then `POST` with `{ revisionId, submissionId, expectedVersion: target.version, expectedStoryVersion: target.storyVersion }` (201); print `source chapter published: <chapterId>`.
     8. Submitter (author `author`): story `{ title: 'Smoke kiểm duyệt ' + smokeStart.toISOString(), description: 'Truyện ngắn dùng để kiểm tra quy trình kiểm duyệt tự động của NovelHub. Nội dung do nhóm phát triển tự viết.' }` → review → approve; print `story approved`. Chapter `{ title: 'Chương smoke', paragraphs: P }` (it copies the source passage) → review; then require `evidence.findingsCount >= 1`, `evidence.maxScore >= 0.9` and `ProcessingAttempt.exists({ batchId: batch.id, stage: 'comparison', status: 'succeeded' })`, else fail `similarity not found`. Print `chapter evidence: status=available-for-human-review stage=llm findings=<findingsCount> maxScore=<maxScore with 2 decimals> comparison=succeeded llm=succeeded`.
     9. Reject the chapter with feedback `Smoke test: vui lòng viết lại đoạn mở đầu (mức độ: thấp).`; `GET /author/submissions` as the submitter must show that submission with `canRevise: true`. Print `chapter rejected; canRevise=true`.
     10. In-app notifications, scoped to this run <!-- Updated: Kongming Phase 03 gate - run-scoped notification assertion -->: reused smoke accounts keep the notifications of earlier runs, so the count matches only this run's two submitter decisions: `Notification.countDocuments({ recipientAccountId: submitter._id, eventType: 'publication.decided', sourceEventKey: { $in: ['publication-submission:<storySubmissionId>:decided', 'publication-submission:<chapterSubmissionId>:decided'] }, createdAt: { $gte: smokeStart } })` must be 2 (story approval and chapter rejection); `GET /reader/notifications` as the submitter has a first item whose `title` starts with `Cần chỉnh sửa:`. Print `notifications: in-app=2`. The smoke never deletes notifications, including those of earlier runs.
     11. Usage over the four smoke batches: load `ProcessingAttempt.find({ batchId: { $in: smokeBatchIds } }).lean()`; require every attempt's `responseMetadata.runner` to be the same value (else fail `more than one runner processed the smoke`); sum `responseMetadata.costUsd` and the tokens (`responseMetadata.usage.prompt_tokens` for embeddings; `input_tokens`, `output_tokens`, `output_tokens_details.reasoning_tokens` for the LLM, each `?? 0`). Print `usage: embeddingTokens=<n> llmInputTokens=<n> llmOutputTokens=<n> reasoningTokens=<n> costUsd=<x with 4 decimals> runner=<runner>`.
     12. Cleanup in `finally` (runs on pass and fail) <!-- Updated: Kongming Phase 03 gate - revoke only smoke-granted roles -->: for each account this run ensured (each carries the `smoke.account-created` marker), in one transaction: `RoleAssignment.updateMany({ accountId, role: <the label's role>, grantedBy: accountId, status: 'active' }, { $set: { status: 'revoked', revokedAt: new Date() }, $inc: { version: 1 } })` (only the self-granted role the smoke grants, never any other active role), `Account.updateOne({ _id: accountId }, { $inc: { authorizationEpoch: 1, version: 1 } })`, `Session.deleteMany({ accountId })`, and `AuditEvent { actorType: 'system', action: 'smoke.role-revoked', targetType: 'Account', targetId, result: 'revoked', reason: 'novelhub-smoke-v1', occurredAt }`. Print `smoke cleanup done`; a cleanup error prints `SMOKE FAILED: cleanup: <detail>`. The smoke stories, chapters, decisions, history and notifications remain as ordinary records.
     13. After a successful cleanup print `SMOKE PASSED`.
- **Success criteria:** the preflight performs no database writes; the smoke prints exactly the lines above in order and always cleans up.
- **Verify:** from `novelhub/backend` run `node --check scripts/smoke-moderation-review.js && npx vitest run test/ai-rollout-preflight.test.js && npm run lint`. Pass: exit code 0, the test summary has no `failed`, and no ESLint problems printed. <!-- Updated: Kongming Phase 03 gate - preflight test -->

### Task 4.3 — Operator confirmations and preflight (read-only)

<!-- Red Team: groups 1, 3 -->
- **Goal:** before any live write, the user has confirmed the OpenAI hard limit and the single runner, and the preflight shows the expected spend fits the remaining budget.
- **Target files and symbols:** none (runs Task 4.2).
- **Steps:**
  1. Ask the user to confirm, and record both answers verbatim for the rollout report: (a) the OpenAI project that owns the key in `backend/.env` has a hard spend limit of at most 3 USD (the user stated a 3 USD limit); (b) no other backend on the shared database runs with `AI_EVIDENCE_WORKER_ENABLED=true`, and this machine's `backend/.env` keeps `AI_EVIDENCE_WORKER_ENABLED=false`. If either is not confirmed, STOP this phase.
  2. From `novelhub` run `npm run smoke:moderation-review --workspace backend -- --preflight --confirm-single-runner`.
  3. Keep the JSON line and the final line for the rollout report (Task 4.12).
- **Success criteria:** the key is present without being printed, no foreign lease is fresh, the backlog is small, and the worst-case spend fits.
- **Verify:** the command in step 2. Pass: exit code 0, output contains `"openaiKey":true`, `"nodeEnv":"development"`, `"workerEnabledInEnv":false`, `"freshLeaseRunners":[]` and `PREFLIGHT OK`.

### Task 4.4 — Index diff (read-only)

<!-- Red Team: group 15 -->
- **Goal:** prove that index changes for this feature drop nothing on the shared database.
- **Target files and symbols:** `backend/scripts/diff-indexes.js` (Task 4.1).
- **Steps:**
  1. From `novelhub` run `npm run db:diff-indexes --workspace backend`.
  2. Keep the `moderationHistory`, `embeddingArtifacts` and `llmReviews` lines for the rollout report.
- **Success criteria:** no collection would lose an index.
- **Verify:** the command in step 1. Pass: exit code 0 and the last line is `INDEX DIFF OK: nothing would be dropped`. Output `INDEX DIFF BLOCKED` fails this Verify; do not run `db:sync-indexes` as a workaround.

### Task 4.5 — Create indexes for the changed models (writes to the shared database)

<!-- Red Team: group 15 -->
- **Goal:** the new `moderationHistory` index exists and the changed models' indexes are present, without dropping anything.
- **Target files and symbols:** `backend/scripts/create-indexes.js` (Task 4.1).
- **Before:** run the Task 4.3 step 2 preflight immediately before this task; continue only on `PREFLIGHT OK`. <!-- Updated: Kongming Phase 03 gate - preflight before index writes -->
- **Steps:**
  1. From `novelhub` run `npm run db:create-indexes --workspace backend -- --models ModerationHistory,EmbeddingArtifact,LlmReview`.
- **Success criteria:** only the three named models are touched.
- **Verify:** the command in step 1. Pass: exit code 0 and output contains exactly three lines matching `moderationHistory: <n> indexes`, `embeddingArtifacts: <n> indexes` and `llmReviews: <n> indexes`.

### Task 4.6 — Create or update the vector index (writes to the shared database)

- **Goal:** `embedding_vectors` on `embeddingArtifacts` is `READY` and queryable.
- **Target files and symbols:** `backend/scripts/sync-search-indexes.js` (Phase 02).
- **Before:** run the Task 4.3 step 2 preflight immediately before this task; continue only on `PREFLIGHT OK`. <!-- Updated: Kongming Phase 03 gate - preflight before index writes -->
- **Steps:**
  1. From `novelhub` run `npm run db:sync-search-indexes --workspace backend`. It may take several minutes while mongot builds the index.
- **Success criteria:** the comparison stage can query the index.
- **Verify:** the command in step 1. Pass: exit code 0, output contains one of `embedding_vectors: created`, `embedding_vectors: updated`, `embedding_vectors: unchanged`, and its last line is `embedding_vectors: READY (queryable)`.

### Task 4.7 — Backfill dry run (writes only a local plan file)

<!-- Red Team: group 12 -->
- **Goal:** know the backfill size and cost, and produce the plan the real run will embed.
- **Target files and symbols:** `backend/scripts/backfill-embeddings.js` (Phase 02).
- **Steps:**
  1. From `novelhub` run `npm run db:backfill-embeddings --workspace backend -- --dry-run`.
  2. Keep the `Backfill plan:` line for the rollout report.
- **Success criteria:** the estimated cost is at most 0.50 USD and the plan file exists at `backend/.tmp/backfill-plan.json` (ignored by git).
- **Verify:** the command in step 1. Pass: exit code 0, output contains `Backfill plan:`, `Plan written to` and `DRY RUN: nothing was embedded or written to the database.`, the dollar amount after `~$` on the plan line is at most `0.5000`, and the file `backend/.tmp/backfill-plan.json` exists.

### Task 4.8 — Real backfill from the plan (writes to the shared database, spends OpenAI budget)

<!-- Red Team: groups 3, 12 -->
- **Goal:** already-published chapters have embeddings, so similarity has sources; the spend is counted in the budget ledger.
- **Target files and symbols:** `backend/scripts/backfill-embeddings.js`.
- **Before:** run the Task 4.3 step 2 preflight immediately before this task; continue only on `PREFLIGHT OK`. <!-- Updated: Kongming Phase 03 gate - preflight before backfill -->
- **Steps:**
  1. From `novelhub` run `npm run db:backfill-embeddings --workspace backend -- --plan .tmp/backfill-plan.json --max-usd 0.50` (npm runs workspace scripts from `backend/`, so the plan path is relative to it).
  2. Keep the `Backfill plan:`, `Embedded` and `Backfill summary:` lines for the rollout report. <!-- Updated: Kongming Phase 03 gate - backfill summary line --> If the summary has `"stopped":true` or `providerUsageUsd` is above `persistedUsageUsd`, STOP and reconcile provider-side usage before any further paid run.
- **Success criteria:** artifacts exist for every planned revision that is still a candidate (a plan with 0 revisions is valid and embeds nothing). <!-- Updated: Kongming Phase 03 gate - zero-cost plan --> A real run whose estimate is `0` (no candidate left) skips the AI budget rejection, so a zero-revision plan passes even when the budget is spent; it makes no provider call.
- **Verify:** the command in step 1. Pass: exit code 0, output contains `Embedded ` followed by the planned revision count minus any `notCandidate` skips, and ends that line with `; 0 failed`, and the `Backfill summary:` JSON has `"stopped":false` and `"failures":0`.

### Task 4.9 — Start the designated runner (writes to the shared database)

<!-- Red Team: group 1 -->
- **Goal:** exactly one local backend runs the API and the evidence worker against the shared database.
- **Target files and symbols:** `backend/src/server.js` (unchanged).
- **Steps:**
  1. Re-run the preflight of Task 4.3 step 2 immediately before starting, to catch a runner that appeared since; it must still print `PREFLIGHT OK`.
  2. Start a long-running service named `novelhub-backend-smoke` from `novelhub`, ready when the log matches `NovelHub API listening on port`. The shell variable wins over `backend/.env`. <!-- Updated: Kongming Phase 03 gate - Bash and PowerShell runner commands --> In Bash (including Git Bash): `AI_EVIDENCE_WORKER_ENABLED=true npm run start --workspace backend`. In PowerShell: `$env:AI_EVIDENCE_WORKER_ENABLED='true'; npm run start --workspace backend`, and after the service stops (Task 4.11) run `Remove-Item Env:AI_EVIDENCE_WORKER_ENABLED` in the same PowerShell session so no later command in it inherits the flag. If your environment has no service runner, start it in a separate terminal and leave it running.
  3. Confirm the log shows `AI evidence worker started` with a `runner` value, and shows neither `AI evidence worker disabled` nor `AI evidence worker not started`.
- **Success criteria:** the API answers on port 4000 and the worker runs only in this process.
- **Verify:** from `novelhub` run `curl -s http://localhost:4000/api/ready`. Pass: exit code 0 and output is `{"status":"ready","database":"connected"}`.

### Task 4.10 — Live end-to-end smoke (writes to the shared database, spends OpenAI budget)

<!-- Red Team: groups 10, 13 --> <!-- Updated: Validation Session 1 - in-app notification check only -->
- **Goal:** a known source passage is published through the real pipeline, a copying chapter is found by `$vectorSearch`, the LLM stage succeeds, a moderator decides through the API, the author gets in-app notifications, and the smoke accounts are cleaned up.
- **Target files and symbols:** `backend/scripts/smoke-moderation-review.js`.
- **Before:** with the runner running, run the Task 4.3 step 2 preflight immediately before the smoke; continue only on `PREFLIGHT OK`. If the only fresh-lease runner is this runner (its `runner` value from the Task 4.9 log) it is still working the backlog: wait and re-run. <!-- Updated: Kongming Phase 03 gate - preflight before the smoke -->
- **Steps:**
  1. With the service from Task 4.9 running, from `novelhub` run `npm run smoke:moderation-review --workspace backend -- --api http://localhost:4000/api`.
  2. Keep the full output for the rollout report.
- **Success criteria:** real retrieval found the copied passage; all decisions committed; cleanup ran.
- **Verify:** the command in step 1. Pass: exit code 0 and output contains, in this order, `backlog drained: `, `accounts ready`, `source story published`, `source chapter published: `, `story approved`, `chapter evidence: status=available-for-human-review stage=llm`, `comparison=succeeded llm=succeeded`, `chapter rejected; canRevise=true`, `notifications: in-app=2`, `usage: embeddingTokens=`, `smoke cleanup done`, `SMOKE PASSED`.

### Task 4.11 — Stop the runner and confirm the cleanup

- **Goal:** no worker keeps running on the shared database and the smoke accounts hold no roles or sessions.
- **Target files and symbols:** none.
- **Steps:**
  1. Stop the `novelhub-backend-smoke` service (or press Ctrl+C in its terminal).
  2. From `novelhub` run `npm run smoke:moderation-review --workspace backend -- --preflight --confirm-single-runner` once more (read-only) and keep the JSON line; `spentUsd` now includes the backfill and the smoke.
- **Success criteria:** the API is down; no fresh lease remains.
- **Verify:** (a) from `novelhub` run `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/ready`. Pass: output is `000`. (b) The command in step 2. Pass: exit code 0, output contains `"freshLeaseRunners":[]` and `PREFLIGHT OK`.

### Task 4.12 — Record the rollout and OpenAI usage

- **Goal:** the plan keeps a factual record of the live run and of spend against the 3 USD budget.
- **Target files and symbols:** create `plans/261029-0745-moderation-review-and-ai-evidence/reports/live-rollout.md`.
- **Steps:**
  1. Write sections `## Date`, `## Operator confirmations` (the two answers from Task 4.3 step 1), `## Preflight` (both JSON lines and `PREFLIGHT OK`), `## Indexes` (the Task 4.4 lines and the Task 4.5 and 4.6 outputs), `## Backfill` (both plan lines, the `Embedded` line and the `Backfill summary:` line <!-- Updated: Kongming Phase 03 gate - backfill summary line -->), `## Smoke` (the full Task 4.10 output in a code block), `## OpenAI usage` (a table with rows backfill provider tokens and USD, backfill persisted tokens and USD, smoke embedding tokens, smoke LLM input/output/reasoning tokens, smoke USD, and a total), and `## Budget check` stating the final `spentUsd` from Task 4.11 and that it is at most 3 USD.
  2. Include only values printed by the commands and the user's confirmations; never copy anything from `backend/.env`.
- **Success criteria:** every number in the report comes from a command output in this phase.
- **Verify:** from `novelhub` run `git grep -n -e "SMOKE PASSED" -e "spentUsd" --no-index -- plans/261029-0745-moderation-review-and-ai-evidence/reports/live-rollout.md`. Pass: exit code 0 and output contains both `SMOKE PASSED` and `spentUsd`.

### Task 4.13 — Operating documentation

<!-- Red Team: groups 1, 2, 3, 15 -->
- **Goal:** a teammate can configure, provision, run, roll back and troubleshoot the evidence worker from the docs alone.
- **Target files and symbols:** create `docs/moderation-evidence.md`; modify `README.md` (commands table lines 36-43, the paragraph at lines 31-32); modify `infra/mongo/README.md` (lines 63-67); check `backend/.env.example` section 11.
- **Steps:**
  1. Create `docs/moderation-evidence.md` with the status line `**Status: DRAFT FOR REVIEW.**` (as in `docs/README.md:3`) and these sections in complete sentences:
     - `## What the worker does`: the three stages, that story-metadata submissions embed title and synopsis, skip vector comparison and still get the LLM review, that the batch becomes terminal and the submission moves to `pending-review` in one transaction, that failures go to manual review with `failedStage`, that AI output is advisory (decision-log items 5 and 28), and that the decision notifies the author in-app only (decision e-mail is deferred).
     - `## Designated runner`: only one process may set `AI_EVIDENCE_WORKER_ENABLED=true`; every other backend on the shared database keeps `false`; how to enable it for one process with a shell variable in Bash and in PowerShell (and clearing it afterwards) <!-- Updated: Kongming Phase 03 gate - Bash and PowerShell runner commands -->; the `runner` value (`hostname:pid`) on every attempt; the preflight's foreign-lease check.
     - `## Configuration`: a table of the twelve keys in `backend/.env.example` section 11 (`MODERATION_CLAIM_HOURS`, `AI_EVIDENCE_WORKER_ENABLED`, `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_REVIEW_MODEL`, `OPENAI_REVIEW_REASONING_EFFORT`, `OPENAI_TIMEOUT_MS`, `AI_EVIDENCE_INTERVAL_SECONDS`, `SIMILARITY_TOP_K`, `VECTOR_SEARCH_INDEX`, `AI_BUDGET_USD`, `AI_BUDGET_WINDOW_START`) with default and meaning; the key lives only in `backend/.env`.
     - `## Preparing an environment`: `npm run db:diff-indexes --workspace backend` (stop if it reports a drop), `npm run db:create-indexes --workspace backend -- --models ModerationHistory,EmbeddingArtifact,LlmReview`, `npm run db:sync-search-indexes --workspace backend`, `npm run db:backfill-embeddings --workspace backend -- --dry-run`, then the real run with `--plan .tmp/backfill-plan.json --max-usd <cap>`. Explain why `db:sync-indexes` is not used on the shared database.
     - `## Running`: the worker starts with the backend only when enabled (`npm run dev:backend` or `npm run start --workspace backend`), refuses to start without a key, sweeps every `AI_EVIDENCE_INTERVAL_SECONDS`, and logs `AI evidence worker started`; nodemon restarts stop it cleanly.
     - `## Budget and cost`: every attempt stores `costUsd`; backfill artifacts store theirs; the worker does not claim a stage whose worst case would reach `AI_BUDGET_USD` and logs `ai budget exhausted`; about 0.003 USD per typical review and 0.00015 USD per chapter embedding at default models; keep an OpenAI project hard limit as a second line.
     - `## Failure codes`: a table of every code Phase 02 can record (`provider-unconfigured`, `vector-index-unavailable`, `vector-search-timeout`, `provider-rate-limited`, `provider-unavailable`, `provider-timeout`, `provider-connection`, `provider-quota`, `provider-rejected`, `provider-error`, `embedding-count-mismatch`, `llm-refusal`, `llm-incomplete`, `llm-output-invalid`, `revision-unavailable`, `rights-unavailable`, `no-text`, `embeddings-missing`, `submission-closed`, `persist-error`, `stage-error`, `operator-disabled`; copy the final list from `backend/src/modules/ai/` with a search for `StageError(` and `failureCode:`), with retryable yes/no (retryable codes get up to three attempts, 60 s then 120 s apart; `persist-error` is retried once) and what the moderator sees.
     - `## Rollback`: set `AI_EVIDENCE_WORKER_ENABLED=false` on the runner, run `npm run ai:fail-pending --workspace backend -- --reason operator-disabled --dry-run`, then without `--dry-run`, then revert code; never roll back by unsetting the key.
     - `## Smoke check`: `npm run smoke:moderation-review --workspace backend -- --preflight --confirm-single-runner`, then the run against the designated runner; what each output line means; the smoke accounts it creates, marks in `auditEvents` and revokes afterwards.
     - `## Troubleshooting`: index not `READY` (re-run the sync script; check mongot logs per `infra/mongo/README.md`), missing key, quota errors, `ai budget exhausted`, stuck `validated` submissions (check the runner log and `processingAttempts`).
  2. In `README.md`, add five rows to the commands table: `npm run db:diff-indexes --workspace backend` (read-only preview of index changes; stops if anything would be dropped), `npm run db:sync-search-indexes --workspace backend` (create or update the moderation vector index and wait until it is queryable), `npm run db:backfill-embeddings --workspace backend -- --dry-run` (plan embeddings for published chapters; the real run takes `--plan` and `--max-usd`), `npm run ai:fail-pending --workspace backend -- --dry-run` (list evidence that a rollback would send to manual review), `npm run smoke:moderation-review --workspace backend -- --preflight --confirm-single-runner` (read-only readiness and budget check for the moderation pipeline). After the sentence at lines 31-32, add `See [Moderation evidence worker](docs/moderation-evidence.md) for AI evidence configuration, the designated runner, provisioning, costs, rollback and troubleshooting.`
  3. In `infra/mongo/README.md`, replace the paragraph at lines 63-67 with: the moderation vector index `embedding_vectors` on `embeddingArtifacts` (1536-dimension cosine vectors with filter fields `revisionId`, `authorAccountId`, `model`, `chunkingVersion`) is created or updated with `npm run db:sync-search-indexes --workspace backend` using the app user, and the command waits until `listSearchIndexes` reports `READY` and queryable; regular indexes on this shared database are previewed with `npm run db:diff-indexes --workspace backend` and created with `npm run db:create-indexes --workspace backend -- --models <names>`, never with `db:sync-indexes`; keep the existing sentence that mongot keeps index files in the `novelhub-mongo_mongot_data` volume and rebuilds them if the volume is lost.
  4. Read `backend/.env.example` section 11; if any of the twelve keys lacks a comment line covering it, add a short Vietnamese comment in the existing style.
- **Success criteria:** the docs contain no secrets, no personal data and no machine-specific paths.
- **Verify:** (a) from `novelhub` run `npm run format:check`. Pass: exit code 0 and output contains `All matched files use Prettier code style!`. (b) From `novelhub` run `git grep -n -E -e "sk-[A-Za-z0-9_-]{16,}" -e "mongodb(\+srv)?://[^ ]+:[^ ]+@" --no-index -- docs/moderation-evidence.md`. Pass: exit code 1 and no output (no API key or credentialed connection string in the doc).

## Todo List

- [x] Task 4.1 — Index preview and non-destructive index scripts
- [x] Task 4.2 — Smoke and preflight script
- [x] Task 4.3 — Operator confirmations and preflight (read-only)
- [x] Task 4.4 — Index diff (read-only)
- [x] Task 4.5 — Create indexes for the changed models (writes to the shared database)
- [x] Task 4.6 — Create or update the vector index (writes to the shared database)
- [x] Task 4.7 — Backfill dry run (writes only a local plan file)
- [x] Task 4.8 — Real backfill from the plan
- [x] Task 4.9 — Start the designated runner
- [x] Task 4.10 — Live end-to-end smoke
- [x] Task 4.11 — Stop the runner and confirm the cleanup
- [x] Task 4.12 — Record the rollout and OpenAI usage
- [x] Task 4.13 — Operating documentation
- [x] Regression gate

## Regression gate

1. From `novelhub` run `npx prettier --write --ignore-unknown backend/scripts/diff-indexes.js backend/scripts/create-indexes.js backend/scripts/smoke-moderation-review.js backend/scripts/backfill-embeddings.js backend/src/db/index-diff.js backend/src/modules/ai/rollout-preflight.js backend/src/modules/ai/embedding-backfill.js backend/test/index-diff.test.js backend/test/ai-rollout-preflight.test.js backend/test/ai-embedding-backfill.test.js backend/package.json README.md infra/mongo/README.md`. Pass: exit code 0. <!-- Updated: Kongming Phase 03 gate - new files formatted -->
2. From `novelhub` run `npm run lint`. Pass: exit code 0.
3. From `novelhub` run `npm test`. Pass: exit code 0 and neither workspace's `Test Files` summary line contains `failed`.
4. From `novelhub` run `npm run i18n:check --workspace frontend && npm run icons:check --workspace frontend`. Pass: exit code 0, output contains `Nguồn nội dung tiếng Việt hợp lệ` and `Folio verified`.
5. From `novelhub` run `npm run build`. Pass: exit code 0.
6. From `novelhub` run `npm run format:check`. Pass: exit code 0 and output contains `All matched files use Prettier code style!`.

## Risk Assessment

<!-- Red Team: groups 1, 3, 10, 13, 15 -->
| Risk | Likelihood × impact | Mitigation |
|---|---|---|
| Another teammate's backend also runs the worker | Medium × High | The flag defaults to `false`; the user confirms a single runner; the preflight blocks on any fresh foreign lease; the smoke fails if more than one runner touched its batches. |
| The worker processes a large backlog and overspends | Medium × High | The preflight blocks above 10 backlog submissions or when the worst case reaches the remaining budget; the worker's own budget gate stops claims; the OpenAI hard limit is confirmed. <!-- Updated: Kongming Phase 03 gate - budget boundary >= --> |
| An index from another branch is dropped | Low × Medium | `db:diff-indexes` must report no drop; `db:create-indexes` never drops; `db:sync-indexes` is not run on the shared database. |
| mongot is slow to build the index | Medium × Low | The sync script polls up to 5 minutes; a timeout fails Verify and stops the phase. |
| The smoke passes without real retrieval | Low × High | The smoke requires `findings >= 1`, `maxScore >= 0.9` and a succeeded `comparison` attempt against a passage it published itself. |
| Model access or quota error on the first live LLM call | Low × Medium | The batch fails to manual review (`provider-rejected` or `provider-quota`); the smoke step fails and the Failure Protocol applies. |
| Smoke accounts keep privileges on the shared database | Medium × Medium | Accounts are created only with an audit marker, reused only when marked, passwordless and verified; cleanup revokes roles, bumps `authorizationEpoch` and deletes sessions on pass and fail. |
| The published smoke source story is visible on the shared development site | High × Low | It is clearly titled `Smoke nguồn`; it is ordinary data on a development database. |

Rollback: stop the runner. If any submission remains `validated` with a non-terminal batch, run `npm run ai:fail-pending --workspace backend -- --reason operator-disabled --dry-run` and then without `--dry-run`. The smoke stories, chapters, decisions and history are ordinary records (history is append-only by design). The vector index can be dropped from `mongosh` with `db.embeddingArtifacts.dropSearchIndex('embedding_vectors')` if it must be removed; created regular indexes are harmless.

## Security Considerations

- The preflight prints only booleans, sources, counts and amounts; no task prints or copies values from `backend/.env`.
- The smoke runs only outside production, never grants roles to an unmarked account, uses reserved `.invalid` addresses, writes an audit event for every account and role change, and revokes everything it granted.
- Live chapter text is original sample prose written for the smoke; no real author content is sent to OpenAI by the smoke itself (queued submissions are processed as designed).

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same failure evidence to the user. Never continue by self-reasoning.
