---
title: "Phase 4: Database Design Review and Freeze Gate"
status: draft-for-review
---

# Phase 4: Database Design Review and Freeze Gate

## Outcome and gate

Run an actionable red-team review of [`phase-02-domain-model.md`](./phase-02-domain-model.md) and [`phase-03-mongodb-logical-design.md`](./phase-03-mongodb-logical-design.md) against the accepted requirements baseline. This file is **DRAFT FOR REVIEW**. It records questions, expected controls and evidence to collect; it does not claim approval.

**Acceptance owner:** Integration/review (member TBD) records the five-person
team's joint acceptance or rejection. Database/integration facilitates the
review but cannot unilaterally settle product policy. A freeze requires an
explicit recorded decision in [`docs/decision-log.md`](../../docs/decision-log.md),
with all blockers either resolved or assigned to the deferred TTS-provider or
team process gate with safe treatment. Phase 5 is blocked until this gate and
the team baseline are accepted.

## Dependencies and inputs

- Phase 1 curated `docs/requirements-baseline.md` and `docs/decision-log.md` are required inputs, currently drafts. Until explicit team acceptance is recorded, classify this gate as **blocked**, not approved.
- Phase 2 domain aggregates, ownership, lifecycles and invariants are reviewed first.
- Phase 3 collection fields, references, cardinalities, access patterns, candidate indexes, transaction boundaries and failure handling are reviewed second.
- The review uses requirement IDs from `novelhub_requirements_spec.md`, canonical use cases from `use-case-list.md`, and the detailed moderation contracts in `moderator-use-cases.csv`. Legacy ERD diagrams and stale fixed-rate wording are evidence only, not authority.

## Internal business and integrity review

The requested `ak-advise` route was unavailable. A fallback independent senior
advisor and integrity reviewer were used. Their outcome is **safe to show as a
draft, unsafe to implement** until the following blockers are closed:

- **P0 publication and lineage:** explicit published revision binding, parent
  consistency, submitted-package digest/freeze, and publication transition
  guards are required before any public read/access path.
- **P0 moderation pipeline:** stage lease/claim and completion CAS, terminal
  failure/manual state, batch/version and authorization-epoch decision guard,
  and no LLM call after comparison failure must be evidenced.
- **P1 identity and authorization:** password-hash/recovery/session handling,
  confirmed email-match Google linking, Reader-plus-one-staff role,
  suspension/revocation, anonymization and queue-claim controls need design
  evidence. The accepted Google risk and email-verification mitigation are
  recorded once in the decision log.
- **P1 finance and secondary work:** typed wallets, negotiated/default
  allocation snapshots, webhook/code/exact-amount matching, mandatory-reason
  adjustments, notification outbox, PDF non-retention, and confirmed
  statistics need review.
- **Deferred technical selection and process gates:** team chooses the TTS
  provider behind a provider-neutral adapter. Failure/error/retry behavior is
  confirmed. All business rules are confirmed; team acceptance and local
  tooling remain process gates.

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

## Review method and evidence package

1. Reconcile each collection and invariant to a requirement/use-case ID or mark it **Proposed technical design**.
2. Walk each red-team scenario below with document-level expected outcomes. A scenario is not passed by saying “the service validates it”; the collection fields, uniqueness/CAS/transaction boundary and durable failure record must identify how.
3. Review the confirmed business rules in the decision log, including
   first-chapter Guest access, logged-in-only cached TTS, chapter entitlement
   expiry, sequential requested release, distinct suspension/role removal,
   report actions and comment lifecycle, fixed packages and bank webhook
   matching, defaults/bounds/rounding, Paid slips, and forever V1 retention.
   Missing alt text is valid; raw CSS/fonts/Markdown/audio/video are not.
   Passage OpenAI embeddings and MongoDB cosine top-k retrieval are confirmed;
   chunk size/top-k are implementation parameters, not policy gates.
   Only TTS provider choice remains a deferred technical selection; team
   acceptance and local tooling are process gates.
4. Challenge candidate indexes against confirmed Reader+chapter entitlement,
   Reader+story rating, daily-view, queue-claim, payment-code, and SePay
   transaction uniqueness. No TTL or automatic deletion is allowed in V1.
5. Review sensitive fields, authorization path, auditability and retention without copying secrets, personal data or provider payloads.
6. Record all findings in the team decision log and update affected phase sections before freeze. No Mongoose schema or app bootstrap begins during this review.

## Red-team scenarios

| ID / threat | Setup and attack | Required observable protection and evidence | Severity / mitigation |
|---|---|---|---|
| DB-RT-01 Duplicate top-up callback | The same confirmed SePay transaction ID is delivered twice, including a replay with different payload. | `bankTransactions.sePayTransactionId` is unique; the first receipt's order/ledger credit commits once. The same ID is a no-op regardless of replay payload, with no second record or credit. | **High / High:** unique transaction key, atomic paid-order CAS, audit. |
| DB-RT-02 Missing webhook | Reader transferred but webhook is delayed/unavailable. | Order stays pending until exact authenticated match; no speculative credit, and after expiry any transfer enters Admin review. | High: pending/expiry and durable bank receipt. |
| DB-RT-03 Double unlock | Concurrent Reader/chapter unlocks with different keys. | Reader+chapter uniqueness permits one debit/allocation; edits need no re-unlock. At early-access end the chapter becomes free. | High: transaction and scoped idempotency. |
| DB-RT-04 Stale Moderator decision | Moderator opens revision A, Author submits/replaces revision B or another Moderator decides, then the first Moderator approves A. | Atomic CAS checks submission status, current revision/hash and authorization; stale write fails and creates no successful decision/notification. Historical A evidence remains readable. | **High / High:** `revisionId`/hash + status/version guard and transaction. |
| DB-RT-05 Out-of-order automatic review | LLM callback arrives before comparison, or a retry attempts LLM after embedding/comparison failure. | Evidence batch stage guard rejects/records stale callback; LLM invocation is impossible after embedding/comparison failure; no clean/fabricated result is produced. | **High / High:** stage state machine, attempt keys and failure stage. |
| DB-RT-06 Empty successful discovery | Embedding and NovelHub comparison complete with zero matches. | Batch records completed discovery and explicit zero finding; LLM is still invoked with empty findings; Moderator sees evidence-backed result or explicit later failure. | **High / Medium:** count/status separate from absence of findings; trace `BR-13`. |
| DB-RT-07 Provider failure with partial evidence | Embedding succeeds but comparison fails; comparison succeeds but LLM fails; provider returns malformed/ungrounded evidence. | Failure stage and only real partial evidence are persisted; formal manual review is allowed after reported failure; pending/unavailable does not bypass mandatory phase; ungrounded/fabricated references are rejected/quarantined. | **High / High:** per-stage attempts, provenance checks, manual-fallback status. |
| DB-RT-08 Viewing triggers provider work | Moderator opens stored AI results repeatedly or another client polls the page. | Read path only reads `evidenceBatches`/findings/LLM results; no new processing attempt/provider request is created. | **High / Medium:** no side effect in read contract; audit/provider attempt count evidence. |
| DB-RT-09 Revision evidence mix-up | Resubmission creates revision B while old result for revision A is still available. | Every evidence, source passage and LLM result points to submission, exact revision and content hash; B cannot reuse A result; A remains historical. | **High / High:** immutable revisions and composite ownership/index checks. |
| DB-RT-10 Unauthorized personal/financial read | Reader A requests Reader B progress, wallet, earnings or withdrawal; Author requests another Author's draft. | Account owner + role/resource check blocks read without revealing protected data; Admin reporting is limited to approved scope; audit records denial where policy requires. | **High / High:** service authorization path and owner-keyed queries; privacy review. |
| DB-RT-11 Unauthorized role escalation | Google token claims Author/Moderator/Admin, or a user manipulates an application status. | External identity is authentication only; role assignments are NovelHub records written by authorized Admin path; application decision and role grant are atomic where both are changed. | **High / High:** provider claims excluded from authorization; role audit/CAS. |
| DB-RT-12 Report target changed/deleted | A report targets a chapter/comment revision that is edited, hidden or removed before Moderator resolution. | Report retains target type/id, target revision and available snapshot/hash; resolution identifies actual affected revision; no silent retargeting or deletion of report history. | **Medium / High:** revision-scoped target reference and explicit unavailable state. |
| DB-RT-13 Financial correction attempt | Operator tries to edit/delete a posted allocation or ledger entry to fix a rate, rounding or payout error. | Write path rejects mutation; correction appends adjustment/reversal linked to original. Historical policy snapshot and entry remain queryable. | **High / High:** append-only collection permissions and audit review. |
| DB-RT-14 Revenue drift | Admin changes negotiated/default rate after unlock. | Historical snapshot preserves negotiated override or configurable 70/30 default; Author share floors to coins and platform gets remainder. | High: immutable effective policy. |
| DB-RT-15 Monthly payout-sheet result failure | At the 1st-of-month 00:00 `Asia/Ho_Chi_Minh` run, an Author's accumulated available earnings include 60,000 carried from skipped months plus 50,000 new (110,000 total), complete bank details, and current threshold 100,000. The system snapshots cutoff/threshold, debits 110,000 and creates a payout row; Admin pays outside NovelHub and records `Paid` or `Failed`. | Row has immutable balance/threshold/amount/bank snapshots. Failed stays pending with no coin return; Admin always enters support-supplied corrected details on the pending row, audited and Admin-only, without overwriting evaluation facts. Profile updates affect future evaluations only. No provider transfer/retry/fee/tax. | **High / High:** debit-at-evaluation, carry-over and append-only result model. |
| DB-RT-16 Notification failure after commit | SMTP rejects a publication decision, withdrawal status or payment notification. | Source transaction/history remains committed; notification/delivery attempt records failure and can be reconciled/retried without duplicating source event. | **Medium / High:** commit-before-notify, delivery idempotency. |
| DB-RT-17 Media/reference leakage | An unauthenticated client guesses object key or a Reader requests Moderator-only evidence media. | Storage reference is not a public authorization token; retrieval rechecks resource/access policy and returns only permitted reference. | **High / High:** opaque/tokenized reference, access-class check and no raw keys in responses/logs. |
| DB-RT-18 Unbounded document growth | Story accumulates chapters/interactions; evidence contains many passages; provider vector payload is large. | Collections remain independently bounded; passages/vectors have explicit limits or external index references; parent reads use pagination/projection. | **Medium / High:** referenced children, bounded payload constraints, growth review. |
| DB-RT-19 Automatic retention deletion | A TTL/deletion schedule is proposed in V1. | Reject it: evidence/audit/finance/notification/media records remain forever; soft delete/anonymization preserves audit and finance. | High: no TTL. |
| DB-RT-20 Index conflicts with confirmed policy | An index includes revision in entitlement uniqueness or permits multiple staff roles. | Reader+chapter entitlement is reusable; Reader plus one staff role is enforced without destroying history. | Medium: index review. |
| DB-RT-21 Publication/draft confusion | A draft/current pointer changes while a Reader, TTS request, resume, or entitlement check reads a chapter; story/chapter parent publication differs. | Reads/access/TTS/resume use explicit `publishedRevisionId`; publication CAS records actor/preconditions/result/failure and rejects parent mismatch. | **High / High:** separate draft/current pointers, parent consistency and binding indexes. |
| DB-RT-22 Submitted package mutation | Rights facts or media metadata/checksum/availability changes after submission while review evidence still references the revision. | Submitted package digest and rights/reference facts are immutable; unavailable media becomes a tombstone; changed digest cannot complete review. | **High / High:** freeze transaction, digest comparison, immutable package evidence. |
| DB-RT-23 Stale stage lease completion | A worker lease expires and a retry completes embedding/comparison/LLM using a stale claim or wrong batch version. | Deterministic attempt key, lease/claim and CAS reject stale completion; comparison failure/stale claim cannot invoke LLM; pending/retryable/terminal/manual/available are distinct. | **High / High:** lease fields, batch version guard and durable stale attempt. |
| DB-RT-24 Google email match / recovery | Email matches existing account or recovery is replayed. | Email-match link is allowed, provider subject stays unique; local login requires verified email. Recovery is hashed/one-time and invalidates sessions. Accepted risk/mitigation is in decision log. | High: verify accepted contract, not superseded ceremony. |
| DB-RT-25 Staff suspension / role removal | Staff suspension or Author-role removal occurs while work/finance exists. | Suspension hides stories and pauses future evaluations only; existing withdrawals stay payable. Role removal increments authorization epoch, freezes stories, cancels pending/approved/scheduled/due unreleased work, keeps live content earning, and denies former-Author edits/unpublish. Account deletion applies the same cancellation: pending submissions leave the Moderator queue, approved/scheduled/due chapters never release, cancelled/unreleased content is excluded from similarity sources, and cancellation uses `account-deleted`. Admin/Moderator may unpublish; Admin alone directly fixes/republishes former-Author content without Moderator/AI review. Former Author cannot become Moderator. | High: epoch/state guards, cancellation transaction and audited Admin exception. |
| DB-RT-26 Typed finance and outbox duplication | A money top-up is posted to earnings, or a committed unlock/decision produces duplicate notifications after worker retry. | Wallet/ledger purpose/type/unit matrix rejects cross-domain entry; unlock stores price/access and negotiated allocation snapshots; one source-event-keyed outbox intent drives idempotent attempts. | **High / High:** typed transaction, scoped idempotency and outbox uniqueness. |
| DB-RT-27 Threshold boundary | Balance 99,999/100,000/100,001 at default threshold. | Below ineligible; equal/above whole-balance withdrawal if unsuspended with bank details. Snapshot Admin-configurable threshold; no bank verification. | High: inclusive comparison. |
| DB-RT-28 Monthly configuration drift | Threshold or balance policy changes during evaluation or before an Admin result/report reads the record. | A consistent evaluation stores threshold, evaluated balance, bank details and policy version; later reads retain those historical facts rather than reinterpreting the record under current settings. The fixed 1st 00:00 `Asia/Ho_Chi_Minh` cutoff governs concurrent unlock inclusion. | **High / High:** transaction/CAS and immutable evaluation/bank snapshots. |
| DB-RT-29 Same-month rerun/concurrent jobs | Two workers or a rerun evaluate the same eligible Author in the same monthly period. | Author/period uniqueness and atomic creation yield one withdrawal and payout-sheet row; missing-bank skip yields no withdrawal but one per-Author/period outbox notification. Below-threshold skip yields no notification. Admin result entries reference the row, not duplicates. | **High / High:** period identity, scoped withdrawal/outbox uniqueness and CAS/transaction boundary. |
| DB-RT-30 Unlock/evaluation concurrency | An Author allocation is credited in an unlock transaction while the monthly evaluation runs concurrently. | The allocation is either fully included in that evaluation or left for the next month according to the exact cutoff; it is never double-counted or lost. A completed unlock is final and has no refund path. | **High / High:** transaction/CAS boundary, immutable ledger/allocation, explicit cutoff policy. |
| DB-RT-31 Access/community | Guest opens chapter 1 during early access → `locked-preview` title/login-unlock prompt only, no text or view; after `endsAt` → full text free. Chapter 2 is rejected, locked comments are rejected, and Guest TTS is rejected. | Access state and view event enforce the transition; only free text records a view. | High: access/uniqueness. |
| DB-RT-32 Unpublish/republish | Paid chapter unpublishes then republishes. | No refund; retained unlock resumes before early-access end. Stories with unlocks cannot hard-delete; hidden comments remain audited. | High: preserved history. |
| DB-RT-33 Claim and scheduling | Other Moderator decides claimed item; claim times out; late-approved N+1 becomes due; N+1 cannot first-release before N; unpublishing N after release occurs. | Competing decision rejects; claim expires to queue; guarded scheduler cascades due chapters after prior first release. Later unpublish does not block live later chapters or new N+2 release. | High: claim/release CAS and first-release marker. |
| DB-RT-34 Comment/account lifecycle | Edit/delete comment, nested reply, account deletion with finance history, bank snapshot and earnings below threshold. | Edited marker, retained soft deletion, one-level replies/likes. Deletion anonymizes comments, forfeits Reader coins, unpublishes Author stories and blocks new unlocks/further earnings; it cancels all unreleased work, removes pending submissions from the Moderator queue, prevents approved/scheduled/due release, excludes cancelled/unreleased content from similarity sources, and uses `account-deleted`; old unlocks are inaccessible, no refunds. Final balance pays once on the next sheet regardless of threshold. Bank/account-holder snapshots stay Admin-only forever; email stays Admin-only until financial closure, receives withdrawal-created, Failed, and Paid-slip emails, then is removed as the account financially closes. If deletion finds no unpaid earnings balance and no pending withdrawal, close and remove the email immediately in the deletion transaction. | Medium: history/ownership and final-payout lifecycle. |
| DB-RT-35 Top-up exceptions | Wrong amount, unknown/expired/already-paid code, invalid API key, duplicate webhook, or two orders share code. | Valid API key required; unique NH+8 order code and SePay transaction ID; exact unexpired pending match credits once. Already-paid code gets Admin review with `already-paid`; other exceptions get review with no automatic credit; duplicate ID is a no-op. | High: unique keys, authentication, adjustment audit. |
| DB-RT-36 Grounded passage retrieval | A nearest passage belongs to own Author, external web, or wrong publication state. | MongoDB cosine top-k search filters to eligible NovelHub published/pending passages excluding own Author; per-passage OpenAI embeddings/matches feed LLM without cutoff or verdict. | High: filter/lineage review. |
| DB-RT-37 TTS failure | Provider fails while Reader listens. | Record failure; Reader sees error/retry button; text reading remains available. Provider choice is deferred behind neutral adapter. | Medium: independent text access. |
| DB-RT-38 Email exhaustion | Email delivery keeps failing. | Up to three attempts with backoff, then failed; in-app notification remains and source result stays committed. Evidence-stage failure still manual fallback, not email retry policy. | Medium: bounded delivery and durability. |
| DB-RT-39 Configured price/duration bounds | Author submits 199 or 5,001 coins, or 0/15 early-access days; Admin changes bounds after a chapter is published. | Submission/publication rejects out-of-range values under the current policy version; accepted chapters retain their policy/access snapshot and existing early-access window after later bound changes. | High: policy-version CAS and immutable publication snapshot. |
| DB-RT-40 Pending payout bank correction | Active Author changes profile bank details while a Failed row is pending, then contacts support; suspended/deleted Author also supplies corrected details. | Profile update affects future evaluations only. Admin always enters the support-supplied correction on the pending row, audited and Admin-only; original evaluation snapshot never changes. Failed stays pending until later Paid. | High: separate immutable evaluation and audited correction snapshot. |

## Freeze checklist

### Authority and traceability

 - [ ] Baseline distinguishes negotiated overrides from configurable 70/30 default and rejects SePay checkout/payout assumptions.
- [ ] Every collection, field group, relationship and invariant maps to `FR-*`, `BR-*`, canonical `UC-*`, or an explicit proposed technical choice.
- [ ] All canonical numbering gaps are preserved; no replacement identifier convention was introduced.

### Domain and lifecycle

- [ ] Each aggregate has owner, lifecycle states, legal transitions and rejected transitions.
- [ ] Exact submission revision/package digest lineage and direct saved-position resume are represented; public reads/access/TTS/resume use explicit published revision bindings.
 - [ ] Publication guards implement requested release time, late-approved due state, scheduler cascade, first-release order, later unpublish behavior, and old-live revisions.
- [ ] Immutable accepted revision/content/rights/media-reference package history is distinct from mutable draft/current projections; unavailable references are tombstoned.
- [ ] Confirmed block AST, image-only embeds and optional alt text are validated; raw CSS/fonts/Markdown and audio/video embeds are excluded.
- [ ] Platform themes plus exactly four customization tokens are represented; Reader accessibility overrides remain available.
- [ ] Evidence batches represent embedding → NovelHub discovery/source passages → LLM; stage lease/claim, completion CAS, empty discovery, failed stage/manual fallback and no-rerun viewing are explicit.
 - [ ] Finance includes typed wallets/units, top-ups, unlocks, append-only ledger, negotiated allocation and access-policy snapshots, earnings, withdrawals, payout-sheet rows, Admin result entries and system reporting without treating top-up as Author revenue; deletion forfeiture and forced payout are represented.

### MongoDB correctness

- [ ] Every cross-document invariant has a transaction or compare-and-set boundary, including top-up, unlock/allocation, moderation decision and application/role decision where applicable.
- [ ] Idempotency keys are scoped and duplicate/conflicting provider callbacks have defined outcomes.
 - [ ] Candidate indexes match access patterns; no final unique/TTL/index choice encodes a rule not in the confirmed decisions.
- [ ] Document growth is bounded; binary media is external; vectors/passages are bounded or externally indexed.
- [ ] Read/write paths include role, ownership, publication, entitlement and exact-revision checks.
- [ ] Stage lease/claim, deterministic attempt identity, evidence batch/version CAS, authorization epoch, and allowed terminal decision states prevent stale or pending decisions.
- [ ] Google email-match linking is allowed with provider-subject uniqueness; local login requires verified email, recovery is one-time/hashed, and accepted risk/mitigation is in decision log.
- [ ] Transient supported-PDF input is never persisted as a media object or
  source URL/path/key/binary: request memory and any temporary parser file are
  cleaned on successful extraction, extraction failure, cancellation, and
  timeout, while the extracted editable draft and minimal status/metadata
  survive; retry after disposal requires Author re-upload.
- [ ] PDF import traceability is limited to `FR-AUTHOR-09`–`FR-AUTHOR-11`
  and `UC-AUT-05` (with rights before submission in `FR-AUTHOR-13`–`FR-AUTHOR-14`
  and `UC-AUT-07`); scanned/image PDFs are rejected without OCR; actual media
  storage is reviewed separately.

### Confirmed-policy and technical/process-gate safety

 - [ ] Confirmed numeric defaults/bounds, floor/remainder allocation, unverified bank details, in-app/emailed Paid slips, and suspension pause only future evaluations are represented.
- [ ] Chapter entitlements expire at early-access end, survive revisions, and resume on republish before expiry; chapters automatically become free.
 - [ ] Role/claim/reapplication/revocation, former-Author cancellation/direct Admin republish, report/comment/rating, Guest preview transition/TTS/resume, discovery/statistics and language policies match confirmed decisions.
- [ ] Only TTS provider choice remains a deferred technical selection; similarity retrieval, TTS failure and email retries are confirmed; AI authoring assistance is excluded and no extra preferences are pending.
- [ ] V1 records are retained forever; no TTL or automatic deletion.

### Security and operations

- [ ] Plaintext credentials, raw challenges/tokens, provider/payment secrets and unrestricted payloads are excluded from fields/logs/audit; the embedded account password hash is `select: false` and never returned by normal reads; recovery challenges are stored as hashes.
- [ ] Sensitive access and administrative/financial/moderation changes are auditable without over-collecting personal data.
- [ ] External failures preserve local records, retry/reconciliation state and visible status.
- [ ] Rollback is defined for index/migration changes and cannot erase immutable content, finance or moderation history.

## Verification matrix for the later implementation

The following is a design acceptance matrix, not a command list. The implementation owner chooses repository-native test tooling after the foundation exists.

| Surface | Unit evidence | Integration evidence | End-to-end acceptance |
|---|---|---|---|
| Revision/review state | AST blocks, optional alt, theme token limits, exact revision/stage/claim guards | old-live edits, sequential release, claim expiry and stale CAS | submit → evidence → decision → requested release; no rerun on view |
| Top-up/unlock finance | webhook API key, code/amount/expiry, floor/remainder allocation | unique transaction/code, concurrent credit/unlock, Admin exception review | NovelHub/VietQR page → bank transfer → SePay webhook → exact credit once; no checkout provider |
| Authorization | role/provider-claim separation and owner checks | account/role/application records with denied cross-owner reads | Google identity cannot escalate; account sees only own progress/wallet/earnings |
| Reports/interactions | target/lifecycle rules and history append | report resolution against changed target revision | Reader report → Moderator review/resolution with preserved history |
| Provider boundaries | adapter status/error normalization | durable attempt/result and retry/reconciliation records | SMTP/TTS/payment/storage failures leave local state intact |
| Migration/indexes | index key and partial-uniqueness fixture tests | rerunnable migration from empty/fixture data and rollback path | approved schema starts without hidden policy or destructive rewrite |

## Risk register and mitigations

| Phase/review item | Likelihood × impact | Mitigation / exit evidence |
|---|---|---|
| Confirmed rules mis-encoded in schema | Medium × High | Trace every state/index/transaction to a confirmed decision; Phase 4 rejects a mechanism that changes a rule. |
| Incorrect aggregate boundary causes partial finance/moderation writes | Medium × High | Scenario DB-RT-01/03/04/13; explicit transaction/CAS table; replica-set prerequisite recorded. |
| Provider retries create duplicate or fabricated state | High × High | Idempotency keys, attempt/result records, unknown status and reconciliation scenarios. |
| Evidence from one revision appears on another | Medium × High | Revision hash on every batch/artifact/result; DB-RT-05/09 and integration fixtures. |
| Sensitive data or media references leak | Medium × High | Field classification, owner-keyed access queries, storage authorization scenario, no secrets/raw payloads. |
| Retention/index migration causes irreversible data loss | Medium × High | No TTL in V1; migration backup/rollback preserves immutable history. |

## Acceptance record and rollback

The acceptance owner records one of:

- **Accepted for foundation:** all checklist items pass; deferred TTS-provider
  selection has a provider-neutral boundary; Phase 5 may start.
- **Accepted with named blockers:** only non-foundational technical/process
  questions remain, each with owner/gate/safe treatment; foundation starts only
  if the team explicitly says they cannot affect its shared contract.
- **Rejected/return to Phase 2 or 3:** high-risk mechanism missing, untraceable
  requirement, or departure from confirmed policy.

If the design is rejected after implementation has begun, stop new schema writes, disable only the affected read/write path, preserve immutable records, and roll back indexes/field reads through a versioned migration. Never “roll back” by deleting revisions, evidence, ledgers, payouts, reports or audit history. A policy correction uses a new version/adjustment record.

## Handoff to Phase 5

Phase 5 may begin only after the five-person team accepts the baseline and this database gate. The handoff must identify the approved collection names/keys, transaction prerequisites, the deferred TTS-provider/process/local-tooling gates, and any explicit accepted-with-blocker limitations. Phase 5 creates no product behavior and no application code in this planning assignment.
