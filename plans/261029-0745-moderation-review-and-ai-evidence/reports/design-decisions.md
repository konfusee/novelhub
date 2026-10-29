# Design decisions (authoritative input for the plan)

> **Superseded in part (2026-10-29).** The Validation Log in `plan.md` overrides this report: decision e-mail (the notification outbox, its worker and every e-mail step) is deferred and only the in-app notification ships; Q1–Q4 are settled; red-team changes in `red-team-findings.md` also apply. The phase files are the execution authority.

Owner: orchestrator. Evidence: `reports/scout-backend-moderation.md`, `reports/scout-ai-frontend.md`, `research/researcher-01-openai.md`, `research/researcher-02-vector-search.md`. Paths relative to `novelhub/`.

## Scope (HOLD SCOPE)

Deliver the moderator approval process end to end:

1. Review lifecycle and moderator decision API (queue, claim, release, package + evidence view, approve/reject).
2. AI evidence pipeline (OpenAI embeddings → MongoDB `$vectorSearch` similarity → OpenAI LLM synthesis) as a background worker.
3. Moderator frontend wired to the real API (queue, review detail with evidence and decision, decision history, overview counts).
4. Decision e-mail via the notification outbox (requirement: e-mail supplements in-app for review approval/rejection).
5. Live rollout on the shared environment (search index, backfill, one real end-to-end smoke) and documentation.

Non-goals: content reports (UC-MOD-04/05), similarity escalation, AI auto-decisions, moderator role administration, CI job with mongot, rewriting existing test fixtures that set approval state directly.

## Submission lifecycle

| Status | Meaning | Who moves it |
|---|---|---|
| `validated` | Submitted; AI evidence batch not terminal. Moderators cannot claim or decide ("pending AI does not permit review"). | `submitContent` (existing) |
| `pending-review` | Evidence batch terminal (`available-for-human-review` at stage `llm`, or `failed` with `failedStage`). In the moderator queue. | Evidence worker, in the same transaction that makes the batch terminal; claim release; claim expiry (lazy) |
| `decision-pending` | Claimed by one moderator (`claimOwnerAccountId`, `claimExpiresAt = now + MODERATION_CLAIM_HOURS (default 24)`, `claimVersion++`). | Claim endpoint |
| `approved` / `rejected` | Decided. Terminal for this submission. | Decision endpoint (claim owner only, claim unexpired) |
| `cancelled` | Existing role-removal / account-deletion paths. | Existing code |

- Claim expiry is lazy: a `decision-pending` row with `claimExpiresAt <= now` is listed as available and may be claimed by anyone (CAS on `version`); the takeover pushes a `claimReleaseHistory` entry with reason `expired`. No sweeper.
- Release: claim owner returns it to `pending-review` (history entry reason `released`).
- `Story.publicationStatus 'under-review'` stays unused (no change).

## Decision transaction (POST `/api/moderator/submissions/:id/decision`)

Body (zod `.strict()`): `decision: 'approve'|'reject'`, `feedback: string trim max 4000` (required non-empty for `reject`, optional for `approve`), `expectedVersion: int ≥ 0` (submission version), `evidenceBatchId: objectId`, `evidenceBatchVersion: int ≥ 0`.

Inside one `withTransaction`, in this order:
1. Lock moderator account (CAS on `authorizationEpoch`/`credentialVersion`, as `lockAccount`) and require an active `RoleAssignment{role:'moderator'}` → else 403.
2. Load submission; require `status === 'decision-pending'`, `version === expectedVersion`, `claimOwnerAccountId === moderator`, `claimExpiresAt > now` → else 409 `submission_changed` / `claim_required`.
3. Require `currentEvidenceBatchId === evidenceBatchId`, batch `version === evidenceBatchVersion`, batch terminal per `terminalEvidenceReady`, batch `packageDigest === submission.packageDigest` → else 409 `evidence_changed`.
4. Lock the author account (same CAS pattern) and require author account `status === 'active'` and active author role; otherwise 409 (the submission would be cancelled by those flows anyway).
5. Require the target's current revision chain is unchanged: revision `_id === submission.revisionId`, `immutableAt` set, `packageDigest === submission.packageDigest`.
6. Approve:
   - submission `approved`, revision `approved`;
   - story-metadata: `authoringFrozen = false`; `publicationStatus = 'approved'` unless already `published` or `unpublished`;
   - chapter: `status = 'approved'` unless `published`;
   - never touch `publishedRevisionId`, `firstReleasedAt`, rights.
7. Reject:
   - submission `rejected`, revision `rejected` (keeps `immutableAt`);
   - create the fresh editable draft revision in the same transaction by extracting the revision-cloning part of `reviseSubmission` into a shared helper (`parentRevisionId = rejected revision`), set `draftRevisionId/currentRevisionId`;
   - story-metadata: `authoringFrozen = false` only when `story.publicationTransition?.result` is not `author-role-removed`/`account-deleted`; `publicationStatus` → `unpublished` if `publishedRevisionId` exists and status is not `published`, `draft` if never published, unchanged if `published`;
   - chapter: `status = 'draft'` unless `published` (published-then-unpublished chapters go to `draft`, keep `publishedRevisionId`/`firstReleasedAt`);
   - chapter decision never touches `story.authoringFrozen`.
8. Clear claim fields, push `claimReleaseHistory {reason:'decided'}`, `claimVersion++`, set `decisionSummary = feedback`.
9. Append `ModerationHistory {aggregateType: 'story'|'chapter', aggregateId, action:'manual-review.decided', outcome, submissionId, revisionId, evidenceBatchId, evidenceBatchVersion, actorAccountId, actorAuthorizationEpoch, reason: feedback, feedback, beforeStateDigest: packageDigest, afterStateDigest: digest(outcome, revisionId, batch version), correlationId: request id}`.
10. Append `AuditEvent {actorType:'account', action:'publication.decided', targetType:'PublicationSubmission', targetId, targetVersion, result: outcome, reason: feedback}`.
11. Create `Notification {recipientAccountId: author, eventType:'publication.decided', sourceEventKey:`publication-submission:${id}:decided`, payload:{submissionId, storyId, chapterId, title, outcome, feedback}, deliveryState:'available'}` and (phase 4) a `NotificationOutbox {sourceEventKey, channel:'email', status:'pending'}` row.

`reviseSubmission` stays and becomes an idempotent replay after rejection (its existing replay branch returns the draft the decision created). `submissionList.canRevise` must only be true when the replay or creation would succeed.

Remove the legacy AI-deferred bypass: delete the `manual-review-ai-deferred-v1` branch of `approvedReviewEvidence` (`backend/src/modules/review-evidence.js`) so release requires a terminal batch; keep `terminalEvidenceReady`. Update any test that relied on it.

## Moderator API (new router `backend/src/routes/moderator.routes.js`, `requireAuth + requireRole('moderator')`, mounted in `backend/src/app.js` before `notFound`)

- `GET /moderator/summary` → counts: queue (`pending-review` + expired `decision-pending`), mine (claimed by me), processing (`validated`), decided today by me.
- `GET /moderator/submissions?view=queue|mine|processing&page=` → items with story/chapter title, author display name, submittedAt, status, claim info, evidence summary (batch status, failedStage, findings count, max score, LLM status).
- `POST /moderator/submissions/:id/claim {expectedVersion}`; `POST /moderator/submissions/:id/release {expectedVersion}`.
- `GET /moderator/submissions/:id` → moderator-scoped package (new loader sharing integrity logic with `author-submitted-package.js`), rights, evidence (batch, attempts summary, findings with matched passages and source story/chapter titles, LLM review), moderation history. Read-only; never triggers AI.
- `GET /moderator/submissions/:id/media/:mediaId/content` → moderator image access for the exact package.
- `POST /moderator/submissions/:id/decision` (above).
- `GET /moderator/decisions?outcome=all|approved|rejected&page=` → my and all decisions (ModerationHistory `manual-review.decided`).
- Existing admin workspace counters (`pending-review`) stay valid.

## AI evidence pipeline

- Code under `backend/src/modules/ai/` (the existing empty folder): `openai-provider.js` (official `openai` npm SDK, explicit `apiKey`, `store:false`, timeouts, `maxRetries: 0` because retries are owned by the worker), `chunking.js`, `similarity-search.js` (pure `$vectorSearch` pipeline builder + executor), `evidence-worker.js` (`processEvidenceBatches(config, {now})` sweep + `startEvidenceWorker(config, logger)` mirroring `startChapterScheduler`), `review-criteria.js` (versioned prompt + strict JSON schema).
- Providers injected through `config.ai` so tests pass doubles (`embed`, `review`, `findSimilar`); tests never call OpenAI and never need mongot.
- Config (all optional; blank-safe in `.env.example` and the blank-strip list in `env.js`): `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`, `OPENAI_REVIEW_MODEL=gpt-6-luna` (verified available via `GET /v1/models`), `OPENAI_REVIEW_REASONING_EFFORT=low`, `OPENAI_TIMEOUT_MS=60000`, `AI_EVIDENCE_INTERVAL_SECONDS=30`, `SIMILARITY_TOP_K=5`, `VECTOR_SEARCH_INDEX=embedding_vectors`, `MODERATION_CLAIM_HOURS=24`.
- Missing API key or missing/non-queryable vector index → the stage fails with a recorded `failureCode` (`provider-unconfigured`, `vector-index-unavailable`) → batch `failed` → submission `pending-review` (manual review). Never an empty-but-successful result.
- Stage execution per batch: deterministic `attemptKey = ${batchId}:${stage}:${n}`, lease = `ProcessingAttempt` (`leaseId`, `leaseExpiresAt`), batch `activeLeaseId` CAS (`EvidenceBatch.updateOne({_id, version, activeLeaseId: null, status})`). Retryable provider errors (429/5xx/timeout/connection): attempt `failed`, retry next sweep with backoff, max 3 attempts per stage, then batch `failed`. Stale leases (`leaseExpiresAt < now`) → attempt `stale`, retry. Clear `activeLeaseId` on every terminal write.
- Embedding stage (chapters): text from `chapterTextProjection`/`readRichChapter`, chunking `v1` (paragraph-packed passages ≈ 2,000 characters, no overlap), one embeddings request per batch (≤ 2,048 inputs), insert `EmbeddingArtifact` rows (unique key makes retries idempotent; reuse existing rows). Status `embedding-complete`.
- Comparison stage: outside any transaction, per query passage `$vectorSearch` (`exact: true`, `limit: SIMILARITY_TOP_K`, filter `revisionId $in eligibleRevisionIds`), eligible = current published revisions + revisions of open submissions (`validated|pending-review|decision-pending`) of chapters whose story author ≠ submitter, excluding cancelled; re-check eligibility before persisting; write `SimilarityFinding` rows (score = vectorSearchScore) then CAS batch `discovery-complete` in a transaction. Require index `READY` and `queryable` first.
- LLM stage: Responses API, strict JSON schema `{summary, riskLevel: low|medium|high, riskReasons[], suggestions[], findingAssessments[{findingId, assessment}]}`, input = exact revision text (capped), rights facts, findings with source passages, criteria version; write `LlmReview` (`succeeded`, `criteriaVersion`, `inputFingerprint`, `provider`, `completedAt`), batch `llm-complete` → `available-for-human-review`, and submission `validated → pending-review` in one transaction. Refusal / truncated output → stage failure.
- Story-metadata submissions: see open question Q1 (default: embed title + synopsis as passages, skip vector comparison by recording a successful empty discovery, run the LLM on metadata).
- Vector index: `scripts/sync-search-indexes.js` (`npm run db:sync-search-indexes`) creates/updates `embedding_vectors` on `embeddingArtifacts`: vector `vector` 1536 dims cosine; filter fields `revisionId`, `authorAccountId`, `model`, `chunkingVersion`.
- Backfill: `scripts/backfill-embeddings.js` embeds currently published chapter revisions that have no artifacts (cost-bounded, dry-run flag), so similarity has sources.
- Worker started in `backend/src/server.js` after `startChapterScheduler`, stopped in `shutdown`.

## Frontend

- `frontend/src/pages/moderator/SubmissionQueuePage.jsx`, `ContentReviewDetailPage.jsx`, `ModeratorOverviewPage.jsx`, `SimilarityRiskReviewPage.jsx` (findings of one submission) and a decisions history page replacing the `/moderator/decisions` placeholder: real API via `apiRequest`/`useBackendResource`; `expectedVersion` handling like `components/admin/AuthorApplications.jsx`; Vietnamese strings in `frontend/src/locales/vi.json` (reuse/repair the unused `manualReview`, `reviewHistory`, `reviewClaims` blocks to match approve/reject only); remove mock usage for these pages and delete unused mock data.
- Detail page shows: package reader view, rights, evidence status (processing / failed stage banner / findings / LLM summary marked advisory), history, claim/release, decision modal (reject requires feedback).

## Notification e-mail (outbox)

- Decision transaction writes the `NotificationOutbox` row; a small outbox worker (`backend/src/modules/notification-outbox.js`) claims pending e-mail rows with lease, sends via `config.emailDelivery` (plain `text`), records `DeliveryAttempt`, max 3 attempts; skips recipients without e-mail or non-active accounts (marks delivered-skipped/failed with code). Delivery failure never rolls back the decision.

## Open questions for validation

- Q1 Story-metadata submissions in the AI pipeline (default above vs. skip AI entirely and go straight to `pending-review`).
- Q2 Include the e-mail outbox phase now (default yes) or ship in-app notification only.
- Q3 Default review model `gpt-6-luna` low effort (default) vs `gpt-5-mini`.
- Q4 Claim TTL 24 h (default).
