---
title: "Phase 3: MongoDB Logical Design"
status: draft-for-review
---

# Phase 3: MongoDB Logical Design

## Status, authority and design posture

This is an **initial DRAFT FOR REVIEW**. It is a logical MongoDB design, not executable Mongoose code and not a freeze. It assumes the domain model in [`phase-02-domain-model.md`](./phase-02-domain-model.md) and the curated baseline in [`docs/requirements-baseline.md`](../../docs/requirements-baseline.md). Requirement references use the canonical IDs in `novelhub_requirements_spec.md`, `use-case-list.md` and `moderator-use-cases.csv`; source filenames/headings are cited without machine-specific paths.

All collection names, fields, indexes and transaction groupings are **Proposed
technical design**, not freeze or runtime evidence. Confirmed rules are owned
by `docs/decision-log.md`: 100,000-coin configurable withdrawal default,
unverified bank details, Paid-slip in-app/email delivery, floor Author-share
rounding, and no payout provider. All business rules are confirmed; AI
authoring assistance is excluded from V1 and preferences stop at
editor/themes/font-size/dark-mode.

The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

See the [decision record](../../docs/decision-log.md#deferred-technical-selection-and-process-gates)
for lane owners and safe treatment; TTS has a provider-neutral boundary.

## Data flow and storage rules

- API/service input is authenticated account identity plus a role/resource check. Services validate ownership and current publication/access state before reading or changing a record.
- Author drafts and imported text/image references become immutable `contentRevisions` package snapshots when submitted. The chapter document representation is validated before submission; chapter content is text plus image blocks only, and unsupported audio/video embeds are rejected. Content structure, rights facts, media-reference metadata/checksum/availability digest are frozen; `publicationSubmissions` points to that exact revision/package. Each resubmission starts a new revision and evidence batch.
- The evidence orchestrator claims a deterministic attempt/lease before each stage call: embedding, NovelHub comparison/finding batch, then LLM. Completion CAS checks claim and batch version. Failure is terminal/manual, empty successful discovery still reaches LLM, and viewing reads stored data only.
- Reads/access/TTS/resume resolve published bindings. Guests see only chapter
  one: `locked-preview` during early access (title/login-unlock prompt only,
  no text or view count), then free text after expiry. TTS is logged-in and
  access-checked. Resume on new revision resets to chapter start with notice;
  first-request audio is cached by revision/voice.
- NovelHub matches authenticated SePay webhooks by unique transaction ID,
  unique `NH[0-9]{8}` code, exact package amount, and unexpired order. Unlock
  snapshots effective access/rate policy; one entitlement per Reader+chapter
  is enforced by a unique key.
- Moderation/Admin services append guarded decisions, report snapshots/resolutions and audit events. Committed outcomes create transactional source-event-keyed outbox intents; async provider delivery does not erase business truth. SMTP, TTS, storage, embedding, LLM and payment calls occur outside MongoDB transactions with durable claim/status records.
- Chapter canonical AST and platform themes plus four customization tokens are
  confirmed; field shapes remain proposed. Alt text is optional. Narration
  remains separate from image-only chapter embeds.

## Proposed collection inventory and logical fields

Field names are proposed logical names. Every document also has MongoDB `_id`, `createdAt`, and, where mutable, `updatedAt`; all timestamps are UTC. `accountId`, `storyId`, etc. are `ObjectId` references unless a provider/external identifier is explicitly named.

### Identity, access and governance

| Collection | Cardinality/ownership | Proposed fields and state | Requirement trace |
|---|---|---|---|
| `accounts` | One account owns many identities, roles, applications, wallets and interactions. | `status` (`pending-verification`/`active`/`suspended`/`anonymized`), including reinstatement `suspended → active`; `email`; `normalizedEmail`; `displayName`; `profile`; `emailVerifiedAt`; `closedAt`; `password` `{hash, algorithm, updatedAt}` (embedded; absent for Google-only accounts; `hash` is `select: false` so normal queries and API responses never return it; never plaintext); `credentialVersion`; `authorizationEpoch`; `version`; `everAuthor` (monotonic historical-role guard). No tokens or provider secrets. | `FR-AUTH-01`–`FR-AUTH-08`, `FR-READ-01`, `BR-14`, `UC-GST-05`–`UC-GST-08`; confirmed former-Author restriction |
| `emailTokens` | Many historical tokens per account; issuing a token revokes older unused tokens of the same purpose, so only one can succeed. | `accountId`; `tokenHash` (unique); `purpose` (`email-verification`/`password-reset`); `expiresAt` (configurable defaults: verification 24h, reset 30 min); `usedAt`; `revokedAt`; `createdAt`. Never store the raw token. Verification sets `accounts.emailVerifiedAt` and `pending-verification → active`; a reset sets the new password hash and increments `credentialVersion`. | `FR-AUTH-01`, `FR-AUTH-02`, `FR-AUTH-06`, `NFR-SEC-03` |
| `sessions` | Many sessions per account; account/session invalidation is explicit. | `accountId`; `credentialVersion`; `authorizationEpoch`; `status`; `issuedAt`; `expiresAt`; `revokedAt`; provider/session reference only. | `FR-AUTH-04`, `FR-AUTH-07`, `NFR-SEC-03` |
| `externalIdentities` | Proposed account-to-many identity links; each provider subject belongs to one account. | `accountId`; `provider`; `providerSubject`; `emailAtLink`; `claimsDigest`; `linkedAt`; `status`; `version`. Google linking matches normalized account email; provider-subject uniqueness is enforced. | `FR-AUTH-03`–`FR-AUTH-05`, `UC-GST-07` |
| `roleAssignments` | Reader plus at most one staff role; Author and Moderator mutually exclusive. Historical Author assignment permanently bars Moderator. | `accountId`; `role`; `staffSlot`; `status`; `grantedBy`; `grantedAt`; `revokedAt`; `version`. Assignment reads account `everAuthor`/epoch and preserves history. | `FR-AUTH-05`, `FR-AUTH-07`, `FR-ADMIN-02`, `UC-ADM-02`; confirmed batch-8 restriction |
| `authorApplications` | Historical applications; rejected applicants may re-apply anytime. | `applicantAccountId`; `status`; `submittedAt`; `decidedAt`; `decidedBy`; `decisionReason`; `evidenceRefs`; `version`. | `FR-AUTHOR-01`, `FR-ADMIN-09`, `FR-ADMIN-10`, `UC-AUT-01`, `UC-ADM-06`, `UC-ADM-10` |
| `categories` | Admin-managed categories referenced by many stories. | `name`; `normalizedName`; `status`; `sortKey`; `createdBy`; `retiredAt`. | `FR-GUEST-08`, `FR-ADMIN-03`, `UC-GST-09`, `UC-ADM-03` |
| `policyVersions` | Admin-owned immutable effective policy versions. | `status`; `effectiveAt`; `priceMinCoins`/`priceMaxCoins` (defaults 200/5000); `durationMinDays`/`durationMaxDays` (1/14); `withdrawalThresholdCoins` (100000); default Author/platform shares (70/30); order/claim expiry (24h); actor/time/version. Changes do not rewrite published or finance snapshots. | Confirmed bounds/defaults; `FR-ADMIN-05`, `FR-COIN-13`, `BR-07`–`BR-10` |

### Story, revision and media

| Collection | Cardinality/ownership | Proposed fields and state | Requirement trace |
|---|---|---|---|
| `stories` | Author-owned ordered chapters/revisions; frozen after role removal. | Owner; Vietnamese title/description; cover; one-or-more categories; `publicationStatus` and Ongoing/Completed `completionStatus` (reopenable); draft/current/published bindings; theme/version; `authoringFrozen`; publication transition/time/version. No hard delete with unlocks. | `FR-GUEST-01`–`FR-GUEST-04`, `FR-AUTHOR-02`, `BR-02`, `UC-AUT-02`; confirmed role removal |
| `chapters` | Ordered story children; sequential first releases only. | `storyId`; `orderKey`; `title`; `status` enum (`draft`/`submitted`/`approved`/`scheduled`/`due`/`published`/`unpublished`/`archived`/`cancelled`); draft/current/published revision bindings; `earlyAccess` `{enabled, durationDays, coinPrice, endsAt, policyVersionId}`; `requestedReleaseAt`; `publicationTransition`; immutable `firstReleasedAt`; `publishedAt`; `cancelledAt`/`cancellationReason`; `version`. Current bounds guard submission/publication; live snapshots retain original end. Late approval becomes due, waiting only for parent visibility and prior first release; later unpublish does not block order. | `FR-GUEST-04`–`FR-GUEST-06`, `FR-AUTHOR-03`, `FR-COIN-05`–`FR-COIN-08`, `UC-AUT-03`, `UC-RDR-02`, `UC-RDR-10`; confirmed first-release rule |
| `contentRevisions` | One chapter/story has many revisions; one accepted submission references exactly one immutable revision. | `contentType`; `storyId`; `chapterId`; `authorAccountId`; `revisionNumber`; `parentRevisionId`; proposed canonical AST `content`; `formatVersion`; `validation`; optional image `altText`; per-story `rightsDeclaration`; `status`; `submittedAt`; `immutableAt`; package/rights/media digests; `mediaIds`. Submitted facts and theme references are immutable; story metadata revisions use the same review path. | `FR-AUTHOR-03`–`FR-AUTHOR-18`, `FR-MOD-05`, `FR-MOD-12`, `UC-AUT-03`, `UC-AUT-14` |
| `contentImports` | One text-layer PDF extraction attempt retains minimal status and draft provenance; scanned/image PDFs are rejected; no OCR/source PDF. | `accountId`; `storyId`; `chapterId`; `sourceType` (`text-layer-pdf`); optional checksum; `extractionStatus`; `extractedTextRef`; `formatMetadata`; sanitized `failureCode`; `createdRevisionId`; `createdAt`. No source binary, URL, path, key, or `MediaAsset`. | `FR-AUTHOR-09`–`FR-AUTHOR-11`, `UC-AUT-05` |
| `rightsDeclarations` | Per story submission, immutable once submitted. | `storyId`; `submissionId`; `revisionId`; `basis` (`original`/`licensed`); `asserted` checkbox; optional `sourceLicenceNote`; `declaredBy`; `declaredAt`; `immutableAt`. | `FR-AUTHOR-13`, `FR-AUTHOR-14`, `UC-AUT-07` |
| `mediaAssets` | One actual story asset belongs to one uploader and may be associated with story/chapter/revision; one external object can have one metadata record. Chapter embeds may reference image assets only in the current scope; generated narration is separate in `narrationAssets`; source import PDFs are excluded. | `ownerAccountId`; `storyId`; `chapterId`; `revisionId`; `kind`; `storageProvider`; `objectKey` (sensitive operational identifier); `contentType`; `sizeBytes`; `checksum`; `status`; `rightsDeclarationId`; `accessClass`; `availabilityDigest`; `unavailableReason`; `deletedAt`. No binary body or chapter audio/video embed entity. | `FR-MEDIA-01`–`FR-MEDIA-03`, `FR-AUTHOR-06`, `UC-AUT-06`, `UC-MOD-02` |
| `narrationAssets` | First-request generated cache by chapter revision/default Vietnamese voice; no Guests. | chapter/revision/voice/language, provider-neutral status, authorized audio reference, failureCode, retryable presentation, attempts/timestamps. Failure recorded; Reader error/retry button; text unaffected. V1 retained forever; only provider selection deferred. | `FR-READ-04`, `FR-MEDIA-04`, `FR-MEDIA-05`, `UC-RDR-11` |

### Review, moderation and community

| Collection | Cardinality/ownership | Proposed fields and state | Requirement trace |
|---|---|---|---|
| `publicationSubmissions` | Exact revision/cycle with one current evidence batch and append-only history. | `storyId`; `chapterId`; `revisionId`; `authorAccountId`; `status` (`validated`/`pending-review`/`decision-pending`/`approved`/`rejected`/`cancelled`); `submittedAt`; `currentEvidenceBatchId`; package/hash; decision summary; `claimOwnerAccountId`; `claimExpiresAt`; `claimVersion`; `claimReleaseHistory`; `cancelledAt`; `cancellationReason` (`author-role-removed`/`account-deleted`); `version`. Automated cancellation removes pending submissions from the Moderator queue and prevents approved/scheduled/due chapters from release; cancelled/unreleased content is excluded from similarity sources. | `FR-AUTHOR-15`, `FR-AUTHOR-16`, `FR-AUTHOR-18`, `FR-MOD-01`, `FR-MOD-07`, `FR-MOD-12`, `UC-AUT-09`–`UC-AUT-11`, `UC-AUT-14`; confirmed role-removal/deletion cancellation |
| `evidenceBatches` | Exact submission/revision evidence; worker lease distinct from Moderator queue claim. | submission/revision/hash; stage/status/failedStage; output schema version; activeLeaseId; deterministic attempts; version/timestamps. Empty successful discovery is valid; failure identifies manual fallback; no LLM after embedding/comparison failure. | `FR-MOD-01`–`FR-MOD-06`, `UC-AUT-10`, `UC-MOD-08` |
| `processingAttempts` | Many attempts per evidence batch/stage; append-only operational history. | `batchId`; `revisionId`; `stage`; `attemptKey` (deterministic, operation-scoped); `leaseId`; `claimVersion`; `leaseExpiresAt`; `provider`; `status`; `requestFingerprint`; `responseMetadata`; `failureCode`; `startedAt`; `finishedAt`; `retryOf`; `staleAt`. Do not store secrets or unrestricted provider prompts. | `FR-MOD-01`–`FR-MOD-06`, `NFR-REL-04`, `NFR-MAIN-02` |
| `embeddingArtifacts` | Passage embeddings for immutable chapter revisions. | revision/batch/model/dimensions; passageId/order/offsets/text reference/hash; copied Author/status eligibility metadata; MongoDB vector; provider/status/time; chunking version. Copied metadata is not authority: current chapter/revision status and Author are post-filtered before LLM input. | `FR-MOD-03`, `FR-MOD-04`, `BR-13`, `UC-AUT-10` |
| `similarityFindings` | Zero/many advisory findings, no cutoff or flag threshold. | batch/revision; NovelHub source chapter/revision/Author IDs; score; bounded matched snippets/offsets; evidence hash; timestamp. Only published/pending NovelHub chapters excluding submitting Author; no external web sources. | `FR-MOD-04`, `FR-MOD-05`, `FR-MOD-11`, `UC-MOD-08` |
| `llmReviews` | At most one successful/final result per evidence batch is a proposed uniqueness rule; retries remain attempts. | `batchId`; `revisionId`; `status`; `criteriaVersion`; `inputFingerprint`; `suggestions`; `riskReasons`; `evidenceRefs`; `provider`; `providerResponseRef`; `completedAt`; `failureCode`. Every evidence reference must resolve to supplied content/source. | `FR-MOD-02`, `FR-MOD-05`, `FR-MOD-06`, `FR-MOD-08`, `BR-11`, `UC-MOD-08` |
| `moderationHistory` | Many append-only entries for each submission/report/content action; Moderator/Admin actor is retained. | `aggregateType`; `aggregateId`; `action`; `outcome`; `submissionId`; `revisionId`; `evidenceBatchId`; `evidenceBatchVersion`; `actorAccountId`; `actorAuthorizationEpoch`; `reason`; `feedback`; `beforeStateDigest`; `afterStateDigest`; `occurredAt`; `correlationId`. | `FR-MOD-07`, `FR-MOD-10`, `FR-MOD-12`, `FR-ADMIN-10`, `UC-MOD-03`, `UC-MOD-05`, `UC-MOD-06` |
| `contentReports` | Reader report on story/chapter/comment; Moderator resolves. | `reporterAccountId`; `targetType`; `targetId`; target revision/snapshot/hash; `status`; `submittedAt`; `resolvedAt`; `resolutionId`; `claimOwnerAccountId`; `claimExpiresAt`; `claimVersion`; `claimReleaseHistory`; `version`. Resolution CAS preserves original target. | `FR-READ-10`, `FR-MOD-09`, `FR-MOD-13`, `UC-RDR-07`, `UC-MOD-01`, `UC-MOD-04` |
| `reportResolutions` | One final resolution plus append-only history. | `reportId`; `moderatorAccountId`; `outcome` (`dismissed`/`hidden`/`unpublished`/`warned`); `contentAction` (`hide-comment`/`unpublish-chapter`/`unpublish-story`/none); `reason`; target snapshot/hash; `resolvedAt`; `historyId`. No Admin escalation action. | `FR-MOD-09`, `FR-MOD-10`, `UC-MOD-05`, `UC-MOD-06` |
| `comments` | Comments target story or chapter; each belongs to author. | `authorAccountId`; `targetType` (`story`/`chapter`); `targetId`; `parentCommentId` (one reply level); `body`; `status` (`visible`/`hidden`/`soft-deleted`, retained); `likeCount`; `editedAt`; `version`. Locked early-access chapters reject comments. | `FR-READ-09`, `UC-RDR-06` |
| `commentLikes` | One retained account/comment relation; Reader owns like/unlike. | `accountId`; `commentId`; `status`; timestamps; unique account/comment key. | Confirmed comment likes; `FR-READ-09`, `UC-RDR-06` |
| `follows` | Proposed many-to-many account/story relation; one active record per account/story. | `accountId`; `storyId`; `status`; `createdAt`; `removedAt`. | `FR-READ-07`, `UC-RDR-04`, `OM-03` in `SRS-mismatches.md` |
| `ratings` | One editable/removable rating per Reader/story, value 1–5. | `accountId`; `storyId`; `value`; `status`; `createdAt`; `updatedAt`; `removedAt`. | `FR-READ-08`, `UC-RDR-05` |

Proposed vector-search index uses cosine similarity and published/pending
NovelHub passage/Author filters. Each embedded query passage retrieves top-k
nearest eligible passages excluding own Author; matches are post-filtered
against current chapter/revision state before reaching the LLM. Rejected,
superseded, cancelled and unpublished work cannot enter through stale metadata.
Findings include source/query passage references and rank. Chunk size and
top-k are implementation parameters, not product-policy gates.

### Reading, notifications and finance

| Collection | Cardinality/ownership | Proposed fields and state | Requirement trace |
|---|---|---|---|
| `readingProgress` | One current record per account/story/chapter/content mode; Reader-owned. | `accountId`; `storyId`; `chapterId`; `revisionId`; `mode`; `position`; `duration`; `contentUpdatedNotice`; `lastReadAt`; `completedAt`; `version`. Resume after edit starts at zero on same chapter. | `FR-READ-05`, `FR-READ-06`, `UC-RDR-02`, `UC-RDR-03`, `UC-RDR-12` |
| `notifications` | Many retained notifications per account. | `recipientAccountId`; `eventType`; source event; minimal payload; read/delivery state; timestamps. Email + in-app: verification/password reset/Google link, review approval/reject/revision, withdrawal created/Paid/Failed/missing-bank skip. Followed-story new chapter in-app only. No expiry deletion in V1. | `FR-NOTIFY-*`, `UC-RDR-08` |
| `notificationOutbox` | One committed business source event creates one transactional intent; async worker owns claims/delivery. | `sourceEventKey` (scoped source aggregate/version/event); `notificationId`; `channel`; `status` (`pending`, `claimed`, `delivered`, `failed`); `claimId`; `leaseExpiresAt`; `attemptCount`; `nextAttemptAt`; `lastFailureCode`; `createdAt`; `version`. | `FR-NOTIFY-01`–`FR-NOTIFY-04`, `NFR-REL-04` |
| `deliveryAttempts` | Email retries up to three attempts with backoff, then failed; in-app notification remains. | notification/outbox/attempt key; channel/provider/status/message ref/failure; attemptedAt; nextAttemptAt; attemptNumber. | `FR-NOTIFY-01`–`FR-NOTIFY-04`, `NFR-REL-04` |
| `statisticsEvents` | Append-only V1 statistics; view dedupe fields match index. | `sourceEventKey`; `eventType` (`view`/`follow`/`rating`/`unlock`/`earning`/`comment`); `day`; `viewerType` (`account`/`guest-device`); `viewerKey` (account or Guest chapter-one device); `storyId`; `chapterId`; `occurredAt`; payload digest; projection version. View key `{chapterId, day, viewerType, viewerKey}`; locked previews create no view event. | Confirmed V1 statistics and Guest-preview rules |
| `authorStatistics` | Rebuildable projection, not finance/access truth. | `authorAccountId`; `storyViews`; `chapterViews`; `followers`; `averageRating`; `unlocks`; `earningsByChapterMonth`; `commentCounts`; `projectionVersion`; `sourceCursor`; `status`; `updatedAt`. | Confirmed V1 statistics decision |
| `wallets` | One current coin wallet per Reader and one earnings/system wallet per owner. | `ownerType`; `ownerId`; immutable `purpose`; unit coins; `availableBalance`; `balanceVersion`; `updatedAt`; `expiresAt: null` (coins never expire). | `FR-COIN-01`, `FR-PAYOUT-01`, `FR-ADMIN-06`, `FR-ADMIN-07` |
| `ledgerEntries` | Immutable wallet entries; finance service only. | `walletId`; `ledgerType` including `adjustment` and `deletion-forfeiture`; `direction`; `amount`; immutable `unit`; mandatory adjustment reason; actor/status/source/idempotency/time; `reversalOf`. Deletion forfeits remaining Reader coins once, not by expiry. | `FR-COIN-04`, `FR-COIN-14`, `FR-PAYOUT-02`, `FR-PAYOUT-09`; confirmed deletion rule |
| `topUpOrders` | NovelHub fixed-package order, credited only on pending match. | `accountId`; `walletId`; `packageId`; package/amount snapshot; unique `paymentCode` (`NH[0-9]{8}`); `paidAmountVnd`; `coinAmount`; `status` (`pending`/`paid`/`expired`); `expiresAt` (default configurable 24h); `bankTransactionId`; `confirmedAt`; `version`. Expiry is a state transition, not TTL deletion. | `FR-COIN-02`–`FR-COIN-04`, `FR-COIN-12`, `UC-RDR-14` |
| `bankTransactions` | One immutable authenticated SePay receipt per unique ID; resolution fields audited. | `sePayTransactionId` unique; `amountVnd`; `content`; `extractedPaymentCode`; `matchStatus` (`matched`/`unmatched`/`amount-mismatch`/`expired`/`already-paid`/`resolved`); `originalMatchStatus`; `matchedOrderId`; `receivedAt`; `apiKeyAuthenticated`; `resolvedBy`; `resolvedAt`; `resolutionReason`; `adjustmentId`. Same transaction-ID delivery is a no-op, not a duplicate record/status. Invalid API keys rejected without credit. | Confirmed top-up and already-paid rules |
| `topUpPackages` | Admin-defined fixed offers; orders retain selected version/amount. | `priceVnd`; `coinAmount` at 1:1; `status`; `policyVersionId`; version/actor/time; no custom amounts. | Confirmed fixed packages; `FR-COIN-02`, `UC-RDR-14` |
| `authorRevenueRates` | Admin-recorded versioned per-Author negotiated rate. | `authorAccountId`; percentage; `effectiveAt`; version/actor/time; default-policy reference when no negotiated rate; allocation retains effective snapshot. | `FR-COIN-13`, `FR-PAYOUT-01`, `BR-07`–`BR-09` |
| `unlockEntitlements` | One entitlement per Reader/chapter is confirmed; entitlement lasts only through early access. | `accountId`; `storyId`; `chapterId`; `publishedRevisionId`; `status`; `purchasedAt`; `expiresAt` (early-access end); `priceCoins`; effective price/access policy snapshots. Republished chapter reuses valid entitlement before expiry; no refund after unpublish. | `FR-COIN-07`–`FR-COIN-11`, `UC-RDR-10` |
| `unlockRequests` | Many idempotent requests; one committed request creates one entitlement and ledger set. | `accountId`; `chapterId`; requested/effective price; operation/idempotency scope; status; entitlementId; policy snapshots; timestamps; version. | `FR-COIN-07`–`FR-COIN-11`, `NFR-REL-02`, `UC-RDR-10` |
| `revenueAllocations` | One unlock has allocation legs; immediate wallet credit. | `unlockRequestId`; `ledgerEntryIds`; beneficiaries; `amount`; `negotiatedAllocationSnapshot` or default 70/30; `roundingData` `{author: floor, platform: remainder}`; policy snapshot; `createdAt`. | `FR-COIN-13`, `FR-COIN-14`, `FR-PAYOUT-01`, `BR-07`–`BR-09` |
| `withdrawalRequests` | System monthly record, one whole accumulated-balance debit per Author/period. | `accountId`; `earningsWalletId`; `origin`; `periodId`; cutoff/evaluated balance/current threshold/policy snapshots; `evaluatedAt`; `amountCoins`; `payoutSlipAmountVnd`; immutable `bankDetailsSnapshot`; `status` (`pending`/`paid`); `forcedByDeletion`; version/time. Deleted-account final earnings get one threshold-free next-sheet evaluation, then no further evaluations after financial closure. Only that path may retain a missing-bank marker for Admin correction. Existing pending withdrawals are not debited again. | `FR-PAYOUT-*`, `UC-AUT-15`–`UC-AUT-17`; confirmed deletion payout/closure |
| `payoutSheetRows` / `payoutResultEntries` | One row per withdrawal; Admin records corrections and append-only external-payment entries. | Row: immutable withdrawal/period/evaluation-bank/amount snapshots; separate `correctedBankDetailsSnapshot` (Admin-only), correction actor/time/reason/version. Result: `withdrawalRequestId`; `resultEntryKey`; `actorAccountId`; required `occurredAt`; `result` (`Paid`/`Failed`); optional transfer reference/note; corrected-bank snapshot actually used. Admin always enters support-supplied corrections on the pending row, audited; profile updates affect future evaluations only. Failed stays pending; later Paid allowed once; slip in-app/email, no transfer/refund. | `FR-PAYOUT-04`, `FR-PAYOUT-09`, `FR-PAYOUT-10`, `UC-ADM-12`, `UC-ADM-13`; confirmed correction rule |
| `auditEvents` | Many append-only events across all sensitive aggregates. | `actorType`; `actorId`; `action`; `targetType`; `targetId`; `targetVersion`; `result`; `reason`; `correlationId`; `operationType`; `idempotencyScope` (operation/owner scoped when applicable); `occurredAt`; `dataDigest`; `retentionClass` (policy label only). No secrets, raw credentials, payment credentials, or unrestricted provider payloads. | `FR-ADMIN-04`, `FR-COIN-14`, `FR-MOD-10`, `NFR-SEC-02`, `NFR-MAIN-02`, `UC-ADM-04` |

**Additional proposed fields supporting confirmed decisions:** `accounts`
includes bank name/account number/account holder, `suspendedAt`,
`anonymizedAt`, and accessibility font-size/dark-mode preferences. Derive
future monthly-evaluation pause from account suspension status/version rather
than a separate flag. Author-role removal does not pause earnings/withdrawals;
deleted-account final unpaid earnings use the next-sheet threshold exception.
`retainedPayoutEmail` and `finalPayoutBankDetailsSnapshot` are
Admin-only deletion-retained fields; `finalPayoutEvaluatedAt` prevents repeated
final-balance evaluation. `financiallyClosedAt` records closure after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. If deletion finds no unpaid earnings balance
and no pending withdrawal, close and remove the retained email immediately in the
deletion transaction. The retained email receives withdrawal-created, Failed, and
Paid-slip emails, then is removed. `stories` has separate
`publicationStatus` and `completionStatus`, `language: vi`, theme token object
`{accentColor, fontFamily, headingDividerPreset, coverBannerMediaId}`,
`authoringFrozen` (former-Author stories; only audited Admin direct fix/republish
may change them), and popularity/rating projection references. Policy, package,
rate, and comment-like fields are owned by their collection rows above.
Both submissions and reports use `claimOwnerAccountId`, `claimExpiresAt`,
`claimVersion` and `claimReleaseHistory`, separate from AI-worker leases.
`statisticsEvents` deduplicates views on
`{chapterId, day, viewerType, viewerKey}` (account or chapter-one guest device);
popularity aggregates unique daily views over rolling 30 days. No TTL applies.
`roleAssignments.staffSlot` is `staff` for Author/Moderator/Admin to support
active staff uniqueness. View events include `day`, `viewerType`, and
`viewerKey`; narration has unique `{revisionId, voiceId}` cache identity.
Bounds in chapter snapshots refer to policy versions rather than becoming
hard-coded lifetime limits. Every proposed collection above requires ordinary
team design acceptance, not a reopened business-rule interview.

### Proposed ledger type/unit matrix

This technical guard enforces `FR-COIN-04`, `FR-COIN-13`–`FR-COIN-14`,
`FR-PAYOUT-01`–`FR-PAYOUT-02` and `NFR-REL-01`–`NFR-REL-03`. Coins are the
only internal unit (1 coin = 1 VND); Author allocation rounds down and the
platform receives the remainder.

| Ledger operation | Allowed purpose/unit binding | Forbidden interpretation |
|---|---|---|
| Provider top-up confirmation | Paid VND amount remains in `topUpOrders`; posted credit targets only the `reader-coins` wallet at 1 coin = 1 VND | Top-up coins cannot be Author/system earnings |
| Early-unlock debit | `reader-coins` wallet; debit equals the committed effective coin-price snapshot | Reader coins cannot be moved into earnings except through a committed allocation |
| Negotiated allocation credit | `author-earnings` or `system-earnings` wallet; allocation coins match the immutable negotiated snapshot | Top-up or current-policy replay cannot produce earnings; different purposes cannot share a balance |
| Withdrawal/settlement | Whole accumulated `author-earnings` balance debited at evaluation in the same transaction as withdrawal/payout row; slip shows equal VND | No provider execution or prior Admin approval; Failed does not return coins |
| Adjustment/reversal | Original entry purpose/unit preserved; linked compensating record | No cross-purpose or cross-unit correction and no historical overwrite |
| Account deletion forfeiture | Debit all remaining `reader-coins` once with audited `deletion-forfeiture` source entry | Not coin expiry, not Author earnings forfeiture, not a silent balance reset |

## References, cardinality and ownership rules

- References are preferred for one-to-many and many-to-many relationships: Story→chapters, Chapter→revisions, Submission→evidence, Account↔Story follows/ratings, Account→wallet/ledger, and reports/history. This prevents unbounded Story and finance documents.
- Small bounded facts may be embedded: validation summary, early-access configuration, policy snapshot metadata, bounded display payloads, and state/version fields. A source passage or vector is not embedded into a parent submission when it can grow without a strict bound.
- Every child reference has an owning parent identifier and authorization path. A reference is not proof of permission; services re-check account role, ownership, publication state, target revision and entitlement.
- Package digests, publication bindings, report snapshots, outbox source-event
  keys, and statistics event cursors are bounded facts/references; they do not
  replace authorization, access, or source-ledger checks.
- Confirmed uniqueness: Reader+chapter entitlement, Reader+story rating, and
  Author+period monthly withdrawal. Historical role/application/report records
  stay auditable. Coins never expire and V1 has no TTL.

## Access patterns and index candidates

These are review candidates, not an instruction to create every index. The database review MUST validate representative query shapes and select only indexes that support required reads/writes.

| Access pattern | Collection and candidate index | Correctness note |
|---|---|---|
| Public catalogue/search/filter/sort and story details | stories publicationStatus/publishedRevisionId/categoryIds/completionStatus, title/Author search and popularity/averageRating/publishedAt sort candidates; chapters story/published binding/order/status | Confirmed title/Author search, category/completion filters, popularity/rating/newest; rolling 30-day daily-view popularity. |
| Release scheduler/cascade | `chapters`: `{status: 1, requestedReleaseAt: 1, storyId: 1, orderKey: 1}` plus unique story/order key and prior `firstReleasedAt` lookup | Guarded job moves scheduled → due and releases consecutive due chapters after each first release; parent visibility, active authority/epoch and cancellation guards remain. Prior unpublish does not erase first-release order. |
| Account lookup/provider callback | `accounts`: `{normalizedEmail: 1}`; `externalIdentities`: `{provider: 1, providerSubject: 1}` unique; `emailTokens`: `{tokenHash: 1}` unique and `{accountId: 1, purpose: 1, usedAt: 1, revokedAt: 1}` | Provider subject unique; email verification precedes local login. |
| Role/ownership authorization | roleAssignments partial unique `{accountId: 1, staffSlot: 1}` for active staff; account `everAuthor`/epoch and retained Author history | At most one staff role; historical Author bars Moderator; epoch rejects stale writes. |
| Author drafts/submissions/claims | stories owner/update; submissions and reports status/claimExpiresAt/submittedAt | Moderator queue claims belong to submissions/reports, distinct from AI-worker evidence leases. |
| Evidence by exact revision/batch | stage/attempt and finding indexes | Empty discovery is valid; no similarity cutoff. |
| Reports/interactions/progress | report target/status; comment target/parent; commentLikes `{accountId: 1, commentId: 1}` unique; rating `{accountId: 1, storyId: 1}` unique; progress account/chapter/mode | Separate threads, one-level replies, per-Reader likes/ratings and retained soft-delete history. |
| Wallet/history/top-up/webhook | wallet owner/purpose; ledger wallet/time; `topUpOrders`: `{paymentCode: 1}` unique and `{expiresAt: 1, status: 1}`; `bankTransactions`: `{sePayTransactionId: 1}` unique and `{matchStatus: 1, receivedAt: -1}` | Fixed packages, exact amount/code matching, duplicate webhook no-op, Admin review for exceptions. |
| Unlock/access | unlockEntitlements `{accountId: 1, chapterId: 1}` unique; requests scoped idempotency | Chapter key excludes revision; retained unlock works on republish before early-access end. |
| Earnings/withdrawal/reporting | Author/period unique; payout result `{withdrawalRequestId: 1, resultEntryKey: 1}` unique and partial unique Paid per withdrawal; negotiated-rate version; view key unique partial for views | Per-entry Failed retries then Paid; missing-bank outbox key scoped to Author/period; evaluation current-threshold/cutoff snapshots; no locked-preview views. |
| Notifications/audit | source-event outbox unique; recipient/time; audit target/time | No TTL; V1 retention forever. |

### Index and uniqueness safeguards

- Partial unique indexes SHOULD be used for active records only where confirmed
  rules permit historical duplicates; never encode an unconfirmed rule by index.
- Idempotency MUST be scoped by operation and owner, with provider transaction references scoped to their provider/order; ledger entries use explicit operation/source fields rather than a free-form globally unique `{idempotencyKey}` claim.
- MongoDB vector search with cosine similarity is confirmed; index layout,
  chunk size and top-k are implementation parameters. Indexes are bounded to
  eligible content/model/version and cannot replace evidence or legal judgment.

## Transaction boundaries and failure handling

MongoDB transactions require a replica-set-capable local/target deployment before implementation. External provider calls are never held open inside a database transaction.

| Boundary | Atomic writes | On conflict/failure | Retry/idempotency |
|---|---|---|---|
| Accept revision/open submission | immutable `contentRevisions` package marker/digests, `publicationSubmissions`, `evidenceBatches`, initial `auditEvents` | abort all local writes; Author receives validation/conflict feedback; submitted rights/media facts cannot be replaced, and unavailable assets become tombstones | client submission key scoped to revision; resubmit creates a new revision, never mutates old |
| Publish story/chapter revision | approved exact revision and current bounds/policy snapshot; time; parent visibility; prior immutable `firstReleasedAt` for first release; active Author epoch and not frozen/cancelled; binding/first-release marker/audit/outbox | stale/unapproved/out-of-order/cancelled transition aborts; old version stays live; later unpublish of prior chapter is not a first-release blocker | transition key per revision; guarded scheduler cascades N → due N+1 → due N+2 with a separate guarded transaction per chapter, rechecking epoch/parent/state; late approval starts cascade immediately |
| Claim/complete an evidence stage | lease/claim and deterministic attempt record before call; CAS on lease/batch/stage and bounded result references | stale/expired claim cannot advance or invoke LLM; reported embedding/comparison/LLM failure is terminal/manual | stage replay retains claim/CAS and manual-fallback rule, with provider call outside transaction; deterministic batch/stage/revision attempt |
| Moderator decision | submission/revision/evidence/terminal-state CAS; active Moderator epoch and claim; status/version, history/audit; guarded publication trigger | revocation/stale batch/revision/authority aborts, no success; cancelled submissions cannot decide | submission/revision/batch/actor key; re-read state; similarity passages post-filtered to current eligible state before LLM |
| Report resolution/content action | report status/resolution, CAS against original target revision/hash, permitted content state change, moderation history/audit | abort if report already resolved or target CAS fails; retain snapshot/hash or unavailable marker; leave report open | resolution key tied to report/target revision |
| Confirm bank-transfer top-up | authenticated unique SePay receipt; exact code/amount/pending/unexpired match; paid order, ledger/wallet credit, audit | wrong amount/unknown/expired/already-paid code records exception for Admin review without credit; invalid API key rejected; duplicate ID no-op | transaction ID unique; paid-order CAS permits credit once; audited resolution → resolved |
| Commit unlock | chapter entitlement, coin debit, Author/system allocation ledgers/balances, effective rate/access snapshots, audit | insufficient balance/stale policy/duplicate aborts all; no refund | Reader+chapter key and owner-scoped idempotency |
| Evaluate monthly withdrawal | 1st 00:00 `Asia/Ho_Chi_Minh` cutoff/account version; whole accumulated available earnings balance including carry-over >= current snapshotted threshold (default 100,000); bank snapshot; whole-balance debit, withdrawal/row/audit/outbox | suspension skips future evaluation only; missing bank/below threshold no debit; role removal eligible; deleted-account final balance gets one threshold-free next-sheet evaluation using retained snapshot or correction marker, with no new earnings | Author/period unique; deletion final-evaluation marker CAS prevents later final-balance reruns; retained Admin-only payout email receives withdrawal-created, Failed, and Paid-slip notices; no provider call |
| Missing-bank monthly skip | no withdrawal/debit; source-event-keyed in-app/email outbox intent for the unsuspended Author/period | coins remain; next month rechecks; below-threshold skip sends no notification; the deletion exception creates a payout row instead | unique `missing-bank:{authorId}:{periodId}` source event prevents duplicate notification on rerun/concurrent jobs |
| Record Admin payout result/correct details | pending-row/version guard; Admin records support-supplied correction snapshot with actor/time/reason; append Paid/Failed entry and actual payment-bank snapshot; outbox; financial closure occurs after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid | corrected details Admin-only, never overwrite evaluation snapshot; profile updates affect future evaluations only; Paid closes once and sends slip; Failed stays pending with no coin return; deleted Author email retained Admin-only until financial closure, then removed; if deletion finds no unpaid earnings balance and no pending withdrawal, close/remove immediately in deletion transaction | unique withdrawal+resultEntryKey, not withdrawal alone; Failed entries then one Paid allowed; slip equals coins, no fee/tax/transfer; no financial-closure rewrite of history |
| Commit account/application/role decision | application/role/epoch/account historical-Author guard, audit/outbox; Author grant sets `everAuthor` permanently | stale authority/version aborts; Moderator grant denied if any Author history, including revoked role | application/version/actor key; account+staff slot/epoch CAS |
| Link identity / use email token | email-match account link, provider-subject uniqueness, email token used/revoked marker, verification activation or reset session invalidation, audit | subject conflict or expired/used/revoked token aborts; email match is allowed | provider subject/token hash operation-scoped; no raw token persisted |
| Claim/release queue item | submission/report `claimOwnerAccountId`, `claimExpiresAt` (configurable default 24h), `claimVersion`, release history/audit | competing Moderator cannot decide; expired/suspended-staff claim releases | CAS on claim owner/version/active authority; same names on both collections |
| Admin manual coin adjustment / bank exception resolution | append adjustment with mandatory reason/actor; wallet balance; optional bank transaction/order/user association; audit | no mutation of posted ledger; no credit without explicit authorized resolution | scoped adjustment key and bank receipt resolution CAS |
| Commit local business result then notify | source business record, source-event-keyed `notificationOutbox` intent, and audit in one transaction; delivery attempts later | SMTP failure changes outbox/delivery state only; source decision/finance record remains | source event key and async delivery attempt key are idempotent |
| Revoke Author role | role revoked, account authorization epoch increment, stories `authoringFrozen`, all unreleased drafts/revisions/submissions cancelled, never-live chapters cancelled and release intents invalidated; audit | already-live bindings stay live/earning; former Author edits/unpublish denied; due jobs and pending decisions abort under epoch/state guard | role/version/epoch-scoped transaction; scheduler rechecks frozen/cancelled state; cancellation does not erase history |
| Admin direct fix/republish former-Author content | Admin authority/epoch; frozen former-Author story and non-deleted account check; immutable corrected revision/binding; original access-end/entitlement snapshots; transition/audit/outbox | non-Admin, non-former-Author or deleted-account target denied; no Moderator/AI review for the explicit former-Author exception | scoped Admin transition/revision key; audited direct publish does not undo deletion |
| Delete/anonymize account with balances | scrub profile/identity/session surfaces and normal email; anonymize comments; increment epoch; unpublish all Author stories; cancel all unreleased work, remove pending submissions from the Moderator queue, invalidate release intents for approved/scheduled/due chapters, and mark cancellation reason `account-deleted`; preserve role/finance/audit/bank history; exclude cancelled/unreleased content from similarity sources; Reader forfeiture ledger; snapshot final earnings/bank and Admin-only `retainedPayoutEmail` for final next-sheet payout; audit | deletion allowed with finance history; no new unlocks/further earnings; existing unlocks inaccessible, no refunds; existing withdrawals payable; missing bank corrected by Admin; financially close after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid; if no unpaid earnings balance and no pending withdrawal at deletion, close/remove email immediately | deletion/version/forfeiture source unique; final-evaluation CAS and Author/period uniqueness; no second debit; retained email receives withdrawal-created, Failed, and Paid-slip emails, then removed |
| Enforce price/duration bounds | revision/submission/publication CAS reads current policy version; validates Author price/duration against configured bounds; stores accepted access/policy snapshot | out-of-range or policy race rejects without publish/debit; changing bounds never rewrites existing publication/early-access end | policy/version guard; re-read on conflict; defaults 200–5000 coins and 1–14 days are not hard-coded lifetime bounds |

## Security, sensitive data and audit

- **Sensitive:** normalized email, external provider subject/claims digest, storage object keys, provider request/result references, payout destination references, exact content, rights statements, financial amounts and actor identity. Encrypt/protect at the application/storage boundary selected by the implementation; never log secrets, credentials, auth tokens, payment credentials or raw provider payloads.
- **Restricted:** wallet/ledger/earnings/withdrawal data is owner-scoped.
  Evaluation bank snapshots and account-holder names are Author+Admin visible
  while active, Admin-only after deletion; corrected bank snapshots are always
  Admin-only. Moderation evidence/reports are role-scoped; media needs access
  checks. Admin reporting does not grant ledger rewrite or routine Moderator
  decisions; former-Author direct republish is the explicit audited exception.
- **Immutable/audited:** content revision snapshots, submitted rights, evidence references, decisions, report resolutions, ledger entries, allocations and payout results are append-only or corrected by compensating records. `auditEvents` record actor/action/target/version/result/correlation and idempotency data without personal-data overcollection.
- **Retention:** V1 keeps moderation evidence, audit, finance, notifications,
  and media records forever. No TTL or automatic deletion; logical
  anonymization/soft-delete preserves required finance/audit records.
  Deletion scrubs personal profile/identity/session data and normal contact
  surfaces, anonymizes comments and unpublishes Author stories. It also cancels
  all unreleased work: pending submissions leave the Moderator queue, approved/
  scheduled/due chapters never release, and cancelled/unreleased content is
  excluded from similarity sources. The Admin-only retained payout email is the
  exception: keep until financial closure, send withdrawal-created,
  Failed, and Paid-slip emails, then remove it. If deletion finds no unpaid
  earnings balance and no pending withdrawal, close and remove the email
  immediately in the deletion transaction. Bank/account-holder snapshots, role
  history and audit evidence remain forever, Admin-only after deletion.
  Payout email delivery references the restricted retained address rather than
  copying it into forever-retained notification/audit payloads; its removal
  after the final Paid-slip email must not leave another retained copy.

## Requirement traceability and deferred technical/process gates

| Design surface | IDs covered | Gate/safe treatment |
|---|---|---|
| Identity/roles/applications | `FR-AUTH-*`, `FR-AUTHOR-01`, `FR-ADMIN-02`, `UC-AUT-01` | Confirmed Reader plus at most one staff role; email-match linking, verified local login, anytime reapplication, distinct suspension/revocation, and anonymization. |
| Revisions/media/rights | `FR-AUTHOR-*`, `FR-MEDIA-*`, `UC-AUT-*` | Confirmed AST/editor/themes and per-story rights; optional alt text; text-layer PDF only/no OCR; sequential scheduled release and old-live metadata/chapter edits. |
| Evidence/manual fallback | `FR-MOD-*`, `BR-11`–`BR-13`, `UC-MOD-*` | Confirmed passage OpenAI embeddings and MongoDB cosine top-k search; own Author excluded, advisory/no cutoff; matches to LLM. Chunk size/top-k implementation parameters. |
| Reader/community/access | `FR-GUEST-*`, `FR-READ-*`, `UC-RDR-*` | Chapter entitlement expiry; Guest chapter-one locked preview (title/prompt only, no text/view), free after expiry; no other Guest chapter/TTS; ratings, report actions, soft delete/replies/likes and statistics. Broader Guest source wording superseded. |
| Finance | `FR-COIN-*`, `FR-PAYOUT-*`, `UC-RDR-14`, `UC-AUT-15`–`UC-AUT-17`, `UC-ADM-*` | Confirmed webhook/code matching, fixed packages, defaults/bounds, floor/remainder split, suspension pauses future monthly evaluations (existing withdrawals stay payable), bank/slip policy; no payout provider. |
| Integrations/audit | `FR-MEDIA-*`, `FR-NOTIFY-*`, `NFR-SEC-*` | Forever/no TTL; confirmed TTS failure/error/retry button/text unaffected and email three attempts/backoff. Only TTS provider selection deferred. AI authoring assistance not V1; no additional preferences. |

## Material choices and rejected alternatives

1. **Referenced collections for revisions/evidence/ledger rather than embedding into stories/submissions/wallets.** Embedding was rejected because revisions, evidence passages, interactions and ledgers are unbounded or independently append-only; references support exact lineage and bounded documents.
2. **Balance projections plus append-only ledger rather than balance-only wallets.** Balance-only was rejected because duplicate top-up callbacks, unlock atomicity, negotiated rate snapshots and compensating corrections require history (`FR-COIN-14`, `NFR-REL-01`–`NFR-REL-04`).
3. **Explicit evidence stages and attempts rather than one AI result document.** A single result cannot represent ordered calls, empty discovery, stage failure, partial evidence, retries, or no-rerun viewing (`FR-MOD-01`–`FR-MOD-06`).
4. **External media references rather than binary blobs in MongoDB.** Binary embedding was rejected by `FR-MEDIA-01` and would make access control and document growth harder.
5. **Separate publication decision/history from `publicationSubmissions`.** In-place overwrite was rejected because the product requires read-only history and exact revision/actor/time evidence (`FR-MOD-10`, `FR-MOD-12`).
6. **Monthly identity with manual payout-sheet results:** Author/period uniqueness
   prevents duplicate monthly withdrawals. Evaluation bank snapshots are
   Author+Admin visible while active, Admin-only forever after deletion;
   corrected details are always Admin-only. Append-only Failed entries keep
   withdrawal pending with no coin return, permitting later Paid.
   Provider settlement/retries and automatic transfers are rejected;
   SePay is inbound top-up notification only.
7. **No duplicate bank receipt state:** unique `sePayTransactionId` makes a
   separate `duplicate` record/status unrepresentable; replay is a no-op,
   not a new record.

## Migration, compatibility and rollback posture

No existing application data or MongoDB schema is present in this planning repository. If implementation begins after the freeze gate, initial collections MUST be created from this approved logical design with a migration that is rerunnable and records its version. If a later policy changes a proposed unique key or field shape, add a new nullable/versioned field and backfill from immutable source records before switching reads; do not rewrite ledger/history/revision records. Roll back a partially applied migration by disabling the new read path and removing only indexes/records created by that migration after a scoped backup/restore plan is accepted; never delete user content, evidence or finance history as rollback.

## Acceptance criteria and dependency

Phase 3 requires accepted Phase 2/baseline, owner/cardinality/traceability for
every collection, transaction/CAS for every cross-document invariant,
reviewable indexes/access patterns, and field-level retention/access rules.
The deferred TTS provider has provider-neutral nullable treatment; the three
remaining items listed above have owners and safe treatment. Phase 4 is next;
Mongoose/application bootstrap remains blocked until that gate.
