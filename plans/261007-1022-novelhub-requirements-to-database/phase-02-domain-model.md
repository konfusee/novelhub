---
title: "Phase 2: Domain Model and Invariants"
status: draft-for-review
---

# Phase 2: Domain Model and Invariants

## Outcome and gate

Produce a reviewable domain model before any application or Mongoose schema work. This is a **DRAFT FOR REVIEW**, not an approval record. Phase 2 can be accepted only after the curated team baseline in [`docs/requirements-baseline.md`](../../docs/requirements-baseline.md) and decisions in [`docs/decision-log.md`](../../docs/decision-log.md) confirm the requirement authority. The model uses the canonical IDs in `use-case-list.md`: `UC-GST-*`, `UC-RDR-*`, `UC-AUT-*`, `UC-MOD-*`, and `UC-ADM-*`; numbering gaps are intentional.

The model treats confirmed interview rules in `docs/decision-log.md` as target
authority, not runtime proof. Negotiated Author rates override configurable
70/30 default; floor Author/remainder platform allocation is immediate and
unlocks are final. The monthly 1st 00:00 `Asia/Ho_Chi_Minh` cutoff evaluates
the accumulated available whole earnings-wallet balance, including carried-over
months, against the current configured threshold (default 100,000 coins),
snapshotted with complete unverified bank details. Suspension skips future
evaluations only; existing withdrawals remain payable. Paid slips appear
in-app/email; Failed remains pending. Deletion stops new earnings and forces
one final next-sheet balance payout regardless of threshold, then financial
closure (closure condition in the Finance aggregate); Reader coins are forfeited by ledger entry.

## Domain boundary and data flow

1. **Identity enters** through registration, password recovery, or verified
   Google identity. Local email/password accounts verify email before login;
   the account stores only a password hash, never plaintext. Google account linking
   matches the existing account email and provider subjects remain unique.
   NovelHub applies the confirmed Reader-plus-at-most-one-staff-role model;
   the provider never assigns roles.
2. **Authoring enters** as Vietnamese story/chapter drafts containing the
   validated block-editor AST (paragraph, heading, bold/italic, scene break,
   image), image references, per-story rights declaration, and early-access
   settings. Audio/video embeds and Markdown input are excluded. Submitted
   package facts are immutable; unavailable references are tombstones.
3. **Review transforms** that exact revision through embedding generation, NovelHub comparison/evidence collection, and then LLM synthesis. A stage claim/lease and deterministic attempt key precede each provider call; completion uses a batch-version compare-and-set. A successful empty discovery is still input to the LLM. A reported failure stops the pipeline and exposes only real partial evidence for manual review (`FR-MOD-01` through `FR-MOD-06`, `BR-13`, `UC-MOD-02`, `UC-MOD-08`).
4. **Human decisions enter** from a Moderator for publication/report actions
   and an Admin for Author-access applications. Shared review items are
   claimable with confirmed configurable expiry (default 24 hours); stale
   claims release. Decisions are approve or reject only; rejection requires
   actionable feedback and permits unlimited resubmission.
   Metadata edits use the same review/old-version-live rule as chapter edits.
5. **Published content exits** through Guest chapter-one locked preview
   (title and login/unlock prompt only, no text or view count) during early
   access, then free text after expiry; authenticated reading, default
   Vietnamese TTS, community interactions, progress and reports. Resume after
   edit starts the same chapter with a content-updated notice.
   Reads/access/TTS/resume bind to published revisions; only first releases
   obey sequential order. Later unpublish does not block later/new chapters.
6. **Money enters** through fixed Admin-defined top-up packages, creating
   non-expiring Reader coins once per confirmed payment. Unlocks are
   chapter-scoped through early access, with Author price 200–5,000 coins and
   duration 1–14 days (Admin-configurable); negotiated per-Author allocation
   falls back to 70/30 and rounds the Author share down. Admin adjustments
   are audited append-only entries with mandatory reasons.
7. **External boundaries** include inbound authenticated SePay webhooks and
   outbound VietQR, object storage, one default Vietnamese TTS, embedding/LLM
   and SMTP calls. NovelHub owns fixed-package orders, payment page, invoice,
   `NH[0-9]{8}` matching, exact-amount crediting, and Admin review of unknown,
   mismatched, expired and already-paid transfers. Payout transfers occur
   outside NovelHub; Admin records each payout-sheet result.
   PDF V1 accepts text-layer input only and rejects scanned/image PDFs without
   OCR.

## Bounded aggregates, ownership and lifecycle

The following are proposed domain aggregates. An aggregate owner is the authority allowed to change its current state; historical child records are append-only or immutable after creation.

### 1. Account and access aggregate

- **Entities:** `Account` (with embedded `password`), `EmailToken`, `Session`, `ExternalIdentity`, `RoleAssignment`, `Permission`, `AuthorApplication`.
- **Owner:** the account owns profile, credential/email-token/session lifecycle and linked identities; Admin owns role assignments and application decisions. An applicant owns submission of their own application.
- **Lifecycle:** Account `pending-verification → active → suspended/anonymized`,
  with `suspended → active` on reinstatement; anonymization is deletion.
  Credentials/sessions active → revoked; identity email-match → linked;
  AuthorApplication submitted → approved/rejected (reapply anytime);
  role active → revoked. Reader remains after Author-role removal.
- **Invariants:** provider identity is verified before linking; a provider claim cannot grant NovelHub role; protected actions require active role plus resource ownership/permission; the embedded account password stores only a hash, never plaintext, and is excluded from normal reads; email tokens (verification and password reset) are single-use, hashed, expiring and revocable; a used password-reset token invalidates sessions; application decision is distinct from withdrawal processing; a decision names the deciding Admin and reason; account personal records are isolated (`FR-AUTH-04`, `FR-AUTH-05`, `FR-AUTH-07`, `FR-ADMIN-02`, `FR-ADMIN-09`, `FR-ADMIN-10`, `BR-14`, `UC-ADM-06`, `UC-ADM-10`).
- **Confirmed authorization:** every account is a Reader plus at most one
  additional staff role; Author and Moderator cannot combine. Any account
  that ever held Author is permanently barred from Moderator. Suspended
  Authors cannot log in/submit, stories are hidden, and future monthly
  withdrawal evaluations pause; withdrawals created before suspension stay
  payable. Suspended Moderators/Admins release claimed work to the shared queue
  while past decisions remain. Removing Author role leaves published stories
  live, earning, and frozen against Author edits/unpublish; Admin/Moderator may
  unpublish. Only Admin may fix and directly republish an unpublished
  former-Author story in an audited action without Moderator/AI review,
  an explicit exception only for those stories. Role revocation increments
  the authorization epoch and cancels all unreleased work, including pending
  submissions and approved/scheduled/due chapters; already-live bindings stay.
  Account deletion has the same cancellation behavior: pending submissions leave
  the Moderator queue, approved/scheduled/due chapters never release,
  cancelled/unreleased content is excluded from similarity sources, and
  `cancellationReason` includes `account-deleted`.
  Deletion removes personal profile data and anonymizes comments (“Deleted
  user”), preserving finance/audit and bank/account-holder snapshots forever,
  Admin-only after deletion. Evaluation snapshots are Author+Admin visible
  while active; corrected details are always Admin-entered, audited and
  Admin-only. Deletion unpublishes stories, blocks new unlocks/further earnings
  and makes existing unlocks inaccessible without refunds. Retain email
  Admin-only until financial closure; send withdrawal-created, Failed,
  and Paid-slip emails, then remove it. The account is financially closed after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid; if deletion finds no unpaid earnings balance and no
  pending withdrawal, close and remove the email immediately in the deletion
  transaction. Rejected applicants may re-apply.

### 2. Story and content aggregate

- **Entities:** `Story`, `Chapter`, `ContentRevision`, `RightsDeclaration`, `MediaAsset` for actual story assets (image embeds only in the current chapter scope), `ContentImport` (proposed minimal extraction status/draft provenance, never source PDF storage), and `NarrationAsset` for generated narration kept separate from chapter content.
- **Owner:** Author owns editable Story/Chapter drafts and associated declared
  rights/media. Publication state is governed by the configured
  workflow and Moderator/Admin boundaries. A revision owns its immutable
  submitted text/structure snapshot, rights facts, and media-reference package.
- **Lifecycle:** Story `draft → submitted/under-review → approved → published
  → unpublished/archived`, with `authoringFrozen` after Author-role removal.
  Rejecting a story-metadata submission clears the freeze held for that review
  and returns the story to draft (unpublished if it previously had a published
  version; a published story stays published with its old version live);
  rejecting a chapter submission returns any non-live chapter to draft
  (including one published, then unpublished and revised: it stays hidden and
  keeps its old published version), and a published chapter stays published
  with its old version live. A chapter decision never clears the story freeze,
  and rejection never clears a role-removal or account-deletion freeze.
  Chapter status enum: `draft`, `submitted`, `approved`, `scheduled`, `due`,
  `published`, `unpublished`, `archived`, `cancelled`. Approval with future
  requested release → scheduled; elapsed request → due; no request → approved
  until Author schedules/publishes. A due chapter publishes when guards pass;
  unpublish → republish reuses its first-release marker. Role removal cancels
  never-live chapters and unreleased edits, preserving already-live bindings.
  Revision `editable → validated → submitted/immutable →
  superseded/approved/rejected/cancelled`; Media `pending-upload → available
  → quarantined/failed/deleted`; RightsDeclaration `draft → asserted →
  superseded`; Narration `requested → processing → available/failed`.
- **Invariants:** every submission references exactly one immutable revision and freezes the validated chapter document representation, content structure, submitted rights facts, and media metadata/checksum/availability digest; chapter content contains text plus image blocks only, and unsupported media is rejected; edits after submission create a new revision; a prior approval/evidence set never transfers to a new revision; stories and chapters validate parent identity and publication-context consistency; explicit story/chapter `publishedRevisionId` bindings are authoritative for public read/access/TTS/resume while draft/current pointers remain separate; a publication transition records actor, preconditions, result, failure and timestamp; actual story asset/narration binaries stay in object storage and only metadata/reference is local; rights declaration is required before acceptance; preview/free/paid access is derived from current publication and policy, not a mutable client claim (`FR-AUTHOR-04`, `FR-AUTHOR-06`, `FR-AUTHOR-13` through `FR-AUTHOR-18`, `FR-MEDIA-01` through `FR-MEDIA-05`, `BR-02`, `BR-04` through `BR-06`, `UC-AUT-03` through `UC-AUT-09`, `UC-GST-03`, `UC-RDR-02`, `UC-RDR-11`).
- **Confirmed formatting/theme:** V1 uses a block-editor canonical AST
  (paragraph, heading, bold/italic, scene break, image); Markdown, raw CSS,
  and custom fonts are excluded. Platform themes plus four bounded custom
  tokens (accent color, font family, heading/divider presets, cover/banner
  image) are supported. Alt text is optional. Rights are per story
  submission. Text-layer PDFs only; scanned/image PDFs are rejected with no
  OCR.
- **Confirmed release/access:** Author price is 200–5,000 coins and duration
  1–14 days, both Admin-configurable and enforced against current policy on
  authoring/publication, then snapshotted without changing live windows.
  Requested release may be set at submission, or the Author schedules/publishes
  after approval. N+1's first release cannot precede N's first release. Late
  approval makes a chapter due and auto-releases it when parent visibility
  and prior first-release guards permit; a later unpublish of N does not
  block later chapters or new releases. Role-removal cancellation blocks
  unreleased work. Resume after edit starts from the beginning with a
  content-updated notice. TTS is logged-in only, one default Vietnamese voice,
  generated on first request and cached by revision/voice. Recorded TTS
  failure shows error/retry button and never disrupts text reading.
  AI authoring assistance is not V1; preferences stop at
  editor/themes/font-size/dark-mode.

### 3. Submission and evidence aggregate

- **Entities:** `PublicationSubmission`, `EvidenceBatch`, `EmbeddingArtifact`, `SimilarityFinding`, `EvidencePassage`, `LLMReviewResult`, `ProcessingAttempt`, `StageLease`.
- **Owner:** the submission service opens a cycle; provider adapters claim and append attempt results; Moderator reads evidence and owns the human decision. Evidence is scoped to the exact `revisionId` and submission cycle.
- **Lifecycle:** Submission `validated → pending-review → decision-pending
  → approved/rejected`; account deletion and Author-role removal cancel
  unreleased work. Pending submissions leave the Moderator queue;
  approved/scheduled/due chapters never release; cancelled/unreleased content
  is excluded from similarity sources. Cancellation reasons include
  `author-role-removed` and `account-deleted`. Authors cannot retract a pending
  submission.
  EvidenceBatch `pending →
  embedding-complete → discovery-complete → llm-complete →
  available-for-human-review`, or explicit `failed` with
  `failedStage ∈ {embedding, comparison, llm}`; stage outcomes distinguish
  `pending`, `retryable`, `terminal-manual`, and `available`; each
  ProcessingAttempt `claimed → started → succeeded/failed/stale`.
- **Invariants:** a deterministic attempt key and lease/claim are created before each external call; completion compare-and-set checks the claim and batch version; mandatory order is embedding, then comparison/evidence, then LLM; comparison failure or stale claim prevents LLM invocation; empty successful findings still permit/require LLM; evidence is not formal review permission while pending/unavailable; failure retains only real partial evidence and identifies the stage; LLM output is advisory and must reference the exact revision and actual supplied source/passages; opening/viewing never creates an attempt; each resubmission has a new batch while old evidence remains historical (`FR-MOD-01` through `FR-MOD-06`, `FR-MOD-11`, `BR-11` through `BR-13`, `UC-AUT-10`, `UC-AUT-14`, `UC-MOD-02`, `UC-MOD-08`).
- **Bounded data choice:** keep large vectors and long source passages
  bounded/chunked or in an approved storage/index boundary; similarity
  compares NovelHub published and pending chapters, excluding the submitting
  Author, has no cutoff, and remains advisory. V1 retention is forever; no
  TTL or automatic deletion.
  Retrieval splits chapters into passages, embeds them with OpenAI Embedding,
  and selects top-k nearest NovelHub passages by cosine similarity in MongoDB
  vector search for the LLM. Chunk size/top-k are implementation parameters.
  Before sending matches to the LLM, post-filter against current chapter/revision
  status and Author, excluding rejected, superseded, cancelled or unpublished
  work even if copied embedding eligibility metadata is stale.

### 4. Moderation and community safety aggregate

- **Entities:** `PublicationDecision`, `ModerationHistoryEntry`, `ContentReport`,
  `ReportResolution`, `ContentAction`, `Comment`, `CommentLike`, `Rating`, `Follow`.
- **Owner:** Reader creates own interaction/report records; Moderator owns publication decisions, report resolutions and permitted actions. History is read-only to consumers after append.
- **Lifecycle/invariants:** Decision `pending → approved/rejected`;
  Report `open → under-review → dismissed/actioned/closed`; Comment
  `visible → hidden/soft-deleted`; Follow `active → removed`; Rating
  `submitted → replaced/removed`. Queue claims block other Moderators and
  expire after configurable time (default 24 hours). Reject requires
  actionable feedback and permits resubmission. Reports target
  story/chapter/comment; actions are Dismiss, Hide comment, Unpublish
  chapter/story, or Warn Author.
  Comments support one-level replies, likes, own edit (shown “edited”), and
  soft delete retained for reports/audit. Locked early-access chapters reject
  comments.

### 5. Reading and notification aggregate

- **Entities:** `ReadingProgress`, `Notification`, `NotificationOutboxIntent`, `DeliveryAttempt`, `StatisticsEvent`/`AuthorStatisticsProjection` (proposed minimal projection seam).
- **Owner:** Reader owns one current progress record per account/content/mode; notification recipient owns read state; notification service owns outbox intents and delivery attempts. Statistics are derived, not a source of entitlement or finance truth.
- **Lifecycle/invariants:** Progress is revision-bound; after an edit resume
  starts the same chapter at the beginning with a content-updated notice.
  TTS is logged-in only, default Vietnamese voice, first-request generated and
  cached by revision/voice. Committed outcomes create one source-event-keyed
  outbox intent. V1 statistics are views per story/chapter (unique
  Reader/chapter/day or Guest device on chapter one after free-text access;
  locked preview counts no view), followers, average rating, unlocks and
  earnings per chapter/month, and comment counts. Notification/media/audit
  retention is forever with no TTL.
  Email retries up to three attempts with backoff, then failed; in-app remains.

### 6. Access and finance aggregate

- **Entities:** `CoinWallet`, `EarningsAccount`, `TopUpOrder`, `BankTransaction`,
  `TopUpPackage`, `AuthorRevenueRate`, `UnlockRequest`, `UnlockEntitlement`,
  `LedgerEntry`, `RevenueAllocation`, `PolicySnapshot`, `WithdrawalRequest`,
  `PayoutSheetRow`, `PayoutResultEntry`, `SystemWallet`.
- **Owner:** the account owns its wallet/earnings view and profile bank details; finance service is the only writer of ledger/balance transitions; Admin owns policy configuration and records each external payout result. No payout provider adapter exists.
- **Confirmed finance lifecycle:** fixed Admin top-up packages credit
  non-expiring coins once. Entitlements are chapter-scoped through early
  access; price is 200–5,000 coins and duration 1–14 days, Admin-configurable.
  Negotiated per-Author allocation falls back to 70/30 and rounds the Author
  share down. The monthly threshold defaults to 100,000 coins and is
  configurable; bank details are required but not externally verified.
  Admin coin additions/removals are mandatory-reason append-only adjustments.
- **Lifecycles:** TopUpOrder `pending → paid/expired`; only an exact unexpired
  pending-order match credits once. BankTransaction match statuses are
  `matched`, `unmatched`, `amount-mismatch`, `expired`, `already-paid`, `resolved`;
  exception → resolved by audited Admin adjustment. Duplicate SePay ID is a
  no-op, not a new receipt/status. Withdrawal `pending → paid`; append-only
  Failed result entries keep it pending, allowing later Paid. Result keys are
  per entry, not per withdrawal. Evaluation bank snapshot stays immutable;
  Admin-only corrected details are separate and audited. The Author supplies
  details via support and Admin always enters them on the pending row; profile
  bank updates affect future evaluations only. Admin contacts suspended/deleted
  Authors off-platform. Missing-bank skips notify once per period; below
  threshold never notifies. Deletion stops new earnings, forfeits Reader coins via ledger and
  forces one final next-sheet earnings payout regardless of threshold. The
  account is financially closed after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid; its retained
  Admin-only email receives withdrawal-created, Failed, and Paid-slip emails
  and is then removed. If deletion finds no unpaid earnings balance and no
  pending withdrawal, close and remove the email immediately in the deletion
  transaction.
- **Finance gates:** the interviewed finance/access/retention policies are
  confirmed; collection/index/transaction acceptance remains a team review.

### 7. Governance, policy and audit aggregate

- **Entities:** `Category`, `PolicyVersion`, `AuditEvent`,
  `ReportProjection` (proposed read model). `PolicyVersion` owns configurable
  bounds/defaults; `TopUpPackage` and `AuthorRevenueRate` reference its versions.
- **Owner:** Admin manages categories and policy versions; audit writer appends events; report readers cannot rewrite source records.
- **Lifecycle:** Policy `draft → effective → superseded`; AuditEvent `appended` only; Category `active → retired`; authorization epoch increments on role grant/revocation or account suspension.
- **Invariants:** effective policy changes never rewrite prior allocations;
  sensitive actions retain actor/reason/target/result. V1 records are kept
  forever, with no TTL. Author-role removal preserves earnings/withdrawals;
  suspension pauses future withdrawal evaluations and hides stories.

## Cross-aggregate invariants and safe failure behavior

| Invariant | Domain enforcement proposal | Failure outcome |
|---|---|---|
| Submitted revision cannot change under review | immutable revision identity plus compare-and-set on submission current revision/version | stale decision rejected; no success notification or audit success event |
| Mandatory evidence ordering | EvidenceBatch stage transition guard and attempt records | stage marked failed; no later stage call; manual fallback with real partial evidence |
| Evidence is revision-scoped | every artifact carries submission/revision/batch IDs and checksums | mismatched artifact rejected as unusable, never attached as clean result |
| Published revision binding | explicit story/chapter `publishedRevisionId` plus parent/story consistency and guarded publication transition | inconsistent parent or stale publication precondition rejects transition; reads/TTS/resume resolve only the published binding |
| Submitted package freeze | immutable revision/package digest for content structure, rights facts, and media metadata/checksum/availability | changed submitted fact or unavailable reference is rejected/marked tombstone; no silent replacement |
| Claimed stage completion | lease/claim and deterministic attempt key before provider call; CAS on claim and batch version | stale/duplicate completion is recorded but cannot change current batch or invoke a later stage |
| Moderator decision guard | transaction/CAS checks exact evidence batch/version, allowed terminal state, unchanged revision, and active authorization epoch | pending evidence, stale batch/revision, or revoked authority cannot decide or emit success |
| Typed wallet and unlock snapshot | immutable wallet purpose/type/unit matrix; unlock transaction snapshots effective price/access policy and negotiated allocation | unit mismatch or stale policy/version aborts without debit, entitlement, or allocation |
| Report and notification durability | report target revision snapshot/hash plus unavailable marker; source-event-keyed outbox intent committed with business result | changed/deleted target is not retargeted; delivery failure is retryable without duplicating source outcome |
| Confirmed top-up exactly once | unique `BankTransaction.sePayTransactionId` and atomic order/ledger/balance update | duplicate SePay ID is a no-op; wrong amount/unknown/expired/already-paid code enters Admin review without credit |
| Unlock and allocation consistency | one transaction over entitlement uniqueness, debit, ledger entries, allocation and balances | all local writes roll back; retry uses same idempotency key; provider is not called as part of commit |
| Append-only finance/moderation history | immutable entry identity and adjustment/new-history records | correction appends compensating record; historical record remains readable |
| Notification delivery is secondary | commit business record before delivery attempt | delivery failure/status is recorded; committed decision/transaction survives |
| Authorized private access | role plus ownership/resource and current publication/access checks at read/write boundary | deny without leaking protected record existence beyond required error semantics |

## Business handoff contracts

| Handoff | Required input and invariant | Output/ownership |
|---|---|---|
| Author → submission → AI → Moderator → publication → Reader | Immutable revision/package; ordered stages; empty discovery still reaches LLM; failure permits manual review. Decision checks exact batch/revision, terminal evidence, active authority and queue claim. | Old version stays live during edits; requested time and first-release order guard publication; role removal cancels unreleased work. Admin directly republishes former-Author content only, audited without AI/Moderator review. |
| Reader → top-up/unlock → earnings/withdrawal | SePay receipt credits Reader coins once. Unlock checks published access/price/balance and snapshots effective access/rate, debiting Reader and crediting Author atomically; final with no refunds. | Finance owns append-only transitions. The 1st 00:00 `Asia/Ho_Chi_Minh` cutoff evaluates the accumulated whole balance, including carry-over, against the current threshold snapshot (default 100,000); debits at evaluation with bank snapshot. Missing bank notifies once/period, below threshold does not. Deletion blocks unlocks/further earnings and creates one final threshold-free next-sheet payout. Admin always enters support-supplied row corrections; profile changes affect future evaluations only. Retained Admin-only email receives withdrawal-created, Failed, and Paid-slip emails, then is removed at financial closure (closure condition in the Finance aggregate). No manual request, approval, fees/tax or payout provider. |
| Provider failure ownership/status | Adapters own status for providers NovelHub calls, including VietQR. The inbound SePay webhook is authenticated and recorded in `BankTransaction`; NovelHub owns matching and local truth. Payout results are local records for external transfers. | Stale/failed AI claims cannot complete later stages; provider/email failure cannot roll back committed outcomes. |

## Requirement traceability summary

| Domain area | Requirement/behavior references | Canonical use cases |
|---|---|---|
| Account, identity, role and Author access | `FR-AUTH-01`–`FR-AUTH-08`, `FR-AUTHOR-01`, `FR-ADMIN-02`, `FR-ADMIN-09`, `FR-ADMIN-10`, `BR-14` | `UC-GST-05`–`UC-GST-08`, `UC-AUT-01`, `UC-ADM-02`, `UC-ADM-06`, `UC-ADM-10` |
| Story/chapter/revision/media/rights | `FR-GUEST-01`–`FR-GUEST-10` (broader Guest reading/TTS superseded by chapter-one-only rule), `FR-AUTHOR-02`–`FR-AUTHOR-18`, `FR-MEDIA-01`–`FR-MEDIA-05`, `BR-02`, `BR-04`–`BR-06` | `UC-GST-01`–`UC-GST-11`, `UC-AUT-02`–`UC-AUT-14` |
| Mandatory automated review and moderation | `FR-MOD-01`–`FR-MOD-13`, `BR-11`–`BR-13`, `NFR-REL-05`–`NFR-REL-06` | `UC-AUT-10`, `UC-AUT-14`, `UC-MOD-01`–`UC-MOD-08` |
| Reading, community and reports | `FR-READ-01`–`FR-READ-11`, `FR-NOTIFY-01`–`FR-NOTIFY-04`, `BR-03` | `UC-RDR-01`–`UC-RDR-08`, `UC-RDR-11`, `UC-RDR-12` |
| Wallet, top-up, unlock and revenue | `FR-COIN-01`–`FR-COIN-14`, `FR-ADMIN-05`–`FR-ADMIN-08`, `NFR-REL-01`–`NFR-REL-04` | `UC-RDR-09`, `UC-RDR-10`, `UC-RDR-14`, `UC-RDR-15`, `UC-ADM-05`, `UC-ADM-08`, `UC-ADM-09`, `UC-ADM-13` |
| Earnings, withdrawal and payout boundary | `FR-PAYOUT-01`–`FR-PAYOUT-10`, `BR-10`, confirmed automatic monthly withdrawal/default/bank/slip/rounding policy | `UC-AUT-13` (superseded manual-request wording), `UC-AUT-15`–`UC-AUT-17`, `UC-ADM-08`, `UC-ADM-12` |

## Material design choices and rejected alternatives

- **Immutable revision snapshots instead of mutable chapter-in-place review:** rejected mutable review because stale Moderator actions and evidence could attach to new content; immutable snapshots directly enforce `FR-MOD-05`, `FR-MOD-12`, and `FR-AUTHOR-18`.
- **Separate evidence batch/attempt records instead of one `aiReviewResult`:** rejected a single result because it cannot represent ordered stages, valid empty discovery, partial evidence, retries, or failed-stage manual fallback required by `FR-MOD-01`–`FR-MOD-06`.
- **Referenced finance ledger plus balance projections instead of only mutable balances:** rejected balance-only storage because duplicate callbacks, corrections, negotiated policy snapshots and auditability require append-only history (`FR-COIN-14`, `NFR-REL-01`–`NFR-REL-04`).
- **Separate interactions/reports from Story documents:** rejected embedding unbounded user activity in Story because interactions are independently owned, queried and moderated; independent records support per-user uniqueness and history (`FR-READ-07`–`FR-READ-10`).
- **Manual payout-sheet boundary instead of provider settlement:** rejected a payout-provider adapter/attempt state machine because NovelHub never initiates transfers. The monthly run debits eligible whole balances at evaluation, creates payout-sheet rows, and Admin records external payment results (`Paid`/`Failed`) append-only; Failed remains pending with no coin return. Bank details are profile-owned and snapshotted for the row; SePay is top-up only.

## Remaining items

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

See the [decision record](../../docs/decision-log.md#deferred-technical-selection-and-process-gates)
for lane owners and safe treatment.

## Acceptance and handoff

**Acceptance owner:** Integration/review (member TBD) records the five-person
team's joint baseline/domain acceptance in Phase 4. Acceptance means every
aggregate has an owner/lifecycle/invariant and the three remaining items above
have owners and safe treatment, with no guessed policy. Phase 3 may start after
baseline/domain review; Mongoose/application code remains blocked.
