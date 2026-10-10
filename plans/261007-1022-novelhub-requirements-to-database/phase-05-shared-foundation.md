---
title: "Phase 5: Shared Local Foundation"
status: draft-for-review
---

# Phase 5: Shared Local Foundation

## Outcome and hard dependency

Define the five-person team's concrete shared contract for a later local-development foundation. This phase is **DRAFT FOR REVIEW**, is blocked by the unaccepted baseline/domain/database gates, and creates no application code in this assignment. It MUST NOT start until all of the following are explicitly accepted:
1. The curated team baseline in [`docs/requirements-baseline.md`](../../docs/requirements-baseline.md) and decision record in [`docs/decision-log.md`](../../docs/decision-log.md).
2. The domain model in [`phase-02-domain-model.md`](./phase-02-domain-model.md).
3. The MongoDB logical design in [`phase-03-mongodb-logical-design.md`](./phase-03-mongodb-logical-design.md).
4. The Phase 4 red-team database gate, with five-person acceptance and safe treatment for deferred TTS-provider selection, team acceptance/process gates, and local-tooling prerequisites.

Foundation work is local-development first. Deployment, Cloudflare Pages, production MongoDB/Atlas, cloud secrets, provider provisioning and CI/CD are later work and are not added here. No fake commands, provider credentials, test fixtures containing personal data, or product scope beyond the accepted baseline may be introduced.

## Shared contract

### Repository boundaries

- The repository has direct `backend/` and `frontend/` subprojects; the backend is Node.js/Express with MVC and service boundaries, and the frontend is a fully static React application intended for a later Cloudflare Pages deployment.
- MongoDB is the persistence boundary. Cross-document financial, unlock, application/role (when coupled), and moderation-decision invariants require a replica-set-capable local environment before implementation relies on transactions.
- External services are accessed through explicit service boundaries. Frontend code receives no provider credentials or payout/payment secrets.
- `docs/` remains the concise shared contract; detailed implementation work belongs to code and tests after the gate. Phase files remain planning authority until implementation is reviewed.
- No generated artifacts, machine-specific absolute paths, symlink escapes, `links.md`, copied draft/docx/base64 material, legacy diagrams as authority, or ad hoc policy notes are permitted.

### Contract surfaces

| Surface | Shared rule | Owner after bootstrap |
|---|---|---|
| Requirements and decisions | Use existing `FR-*`, `BR-*` and canonical `UC-GST-*`, `UC-RDR-*`, `UC-AUT-*`, `UC-MOD-*`, `UC-ADM-*` IDs; preserve numbering gaps. Requirements or explicitly labelled proposed design only. | Documentation steward |
| Domain names/lifecycles | Use approved Phase 2 contracts: canonical block AST, image-only embeds, optional alt text, platform themes with four customization tokens, per-story rights, text-layer PDF/no OCR, immutable revisions, old-live edits, requested-time and first-release order. | Backend/domain |
| MongoDB names/keys | Use Phase 3 proposed fields/indexes only after Phase 4 accepts; preserve Reader+chapter entitlement, Reader+story rating, daily views, claims, unique payment codes and SePay transaction IDs. | Database/integration |
| Review/evidence | Passage OpenAI embeddings → MongoDB cosine top-k nearest NovelHub passage search (published/pending excluding own Author, no cutoff) → LLM. Chunk size/top-k implementation parameters. Advisory only, claim/CAS/manual fallback and queue/default 24h expiry; no rerun on view. | Backend/domain |
| Finance | Fixed packages, NovelHub-owned invoice/payment page with VietQR API, API-key-authenticated SePay webhook, unique NH+8 digits, exact unexpired amount/code match once; default 24h order expiry and Admin exception review. Per-Author negotiated rate overrides configurable 70/30, Author share floors/platform remainder. Monthly threshold default 100,000 coins; unverified bank details; suspended Authors pause future monthly evaluations (existing withdrawals stay payable); Paid slips in-app/email. No payout provider; coins never expire; audited Admin adjustments require reason. | Database/integration |
| Access/security | Reader plus at most one staff role; local email verified before login; Google email-match linking/provider subject unique. Former Authors are barred from Moderator; suspension differs from Author-role removal. Former Author stories stay live/earning after role removal, freeze edits/unpublish, and cancel unreleased work; only Admin may directly fix/republish an unpublished former-Author story (audited, no Moderator/AI review). Account deletion anonymizes and unpublishes Author stories, blocks new unlocks/further earnings, cancels all unreleased work, removes pending submissions from the Moderator queue, prevents approved/scheduled/due chapters from releasing, excludes cancelled/unreleased content from similarity sources, and uses `account-deleted`; it preserves finance/audit and applies coin forfeiture/one-time final payout. | Backend/domain |
| Secondary work/provenance | Confirmed email event set; followed-story new chapters in-app only. Reports story/chapter/comment, known actions; comments have soft delete/edited marker/one-level replies/likes. Confirmed Author statistics/discovery/popularity and Vietnamese language. V1 retention forever/no TTL; source PDFs transient. | Integration/review |
| Frontend boundary | Static React consumes approved backend contracts and never embeds provider credentials or invents unavailable states/policies. Guest chapter-one `locked-preview` has title/prompt only and no view; it becomes free after expiry. | Frontend |
| Local environment | Local services and configuration are documented only when actually agreed and available; no provider or deployment command is invented in this plan. | Integration/review |

Pending payout corrections are always Admin-entered from support-supplied
details, audited and Admin-only; profile bank updates apply only to future
evaluations, never an existing row. Deletion unpublishes Author stories and
blocks unlocks/further earnings; existing unlocks become inaccessible without
refunds. It cancels all unreleased work, removes pending submissions from the
Moderator queue, prevents approved/scheduled/due chapters from releasing, and
excludes cancelled/unreleased content from similarity sources with
`cancellationReason = account-deleted`. The final balance pays once on the next
sheet regardless of threshold. The account is financially closed after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. Retain the email Admin-only until financial closure,
send withdrawal-created, Failed, and Paid-slip emails, then remove it. If
deletion finds no unpaid earnings balance and no pending withdrawal, close and
remove the email immediately in the deletion transaction; bank snapshots and
account-holder names remain Admin-only forever after deletion.

The only remaining items are TTS provider selection, team acceptance/process
gates, and local tooling prerequisites. TTS remains behind a provider-neutral
adapter; failures show a Reader error/retry button without affecting text.
Owner names stay “member TBD”.

AI authoring assistance is not V1 and preference scope ends at
editor/themes/font-size/dark-mode. Email retries up to three attempts with
backoff, then failed; in-app remains.

### Data flow through the future foundation

1. Frontend sends user intent through the approved backend API boundary.
2. Backend authenticates identity, authorizes NovelHub role/resource ownership, validates input, and calls a domain service.
3. Domain service reads/writes MongoDB through approved collection/repository boundaries. It uses an explicit transaction or compare-and-set where the Phase 3 table requires one.
4. Domain service records durable state/audit before or alongside external side effects. Provider adapters handle storage, VietQR generation, embedding, LLM, TTS and SMTP responses as status-bearing records; the authenticated inbound SePay webhook is recorded locally. Admin payout results are local records for transfers performed outside NovelHub. Provider failure does not erase local business state.
5. Backend returns a state/result that distinguishes success, rejected, pending,
   failed and unknown without inventing behavior beyond confirmed decisions. A
   failed payout-sheet row remains pending; it is not a provider retry state.
6. Frontend renders only the returned authorization/access/status contract. It does not determine entitlements, revenue allocation, publication approval, role assignment or payout acceptance.

## Five-person ownership and dependency contract

The team may substitute names after assignment, but the five ownership lanes and boundaries stay explicit. Each lane owns its listed future files; no two parallel work items edit the same file. Shared contract changes require a review PR and team acknowledgement before dependent work continues.

| Member/lane | Owns (future implementation) | Depends on | Delivers after gates |
|---|---|---|---|
| 1. Documentation steward | `docs/README.md`, `docs/requirements-baseline.md`, `docs/decision-log.md` only | External source reconciliation and team decisions | Traceable, self-contained contract; no implementation prose or guessed policy |
| 2. Backend/domain | Backend domain models/services/controllers and authorization modules under `backend/` | Accepted baseline, Phase 2 model, Phase 4 database gate | Domain transitions, ownership checks, service boundaries and API behavior matching the approved design |
| 3. Database/integration | MongoDB connection/repository/migration/index code under `backend/` database boundary | Phase 3/4 collection and transaction approval; local replica-set prerequisite | Approved collections, indexes, transaction/CAS paths, provider status persistence and safe migrations |
| 4. Frontend | Static React modules and UI contract adapters under `frontend/` | Approved backend API/status/auth contracts | Public/Reader/Author/Moderator/Admin surfaces that render backend state and preserve direct resume behavior |
| 5. Integration/review | Root workspace coordination files only where later agreed, cross-boundary fixtures/tests/review records | All four lanes' accepted contracts; no shared-file edits without ownership handoff | Local integration acceptance, scenario matrix evidence and release-readiness report |

The plan owner coordinates sequencing but does not become a sixth product-policy
owner. A lane may not “temporarily” implement a deferred item to unblock
another lane; record the gate or return to the team.

## Sequenced foundation work

### Gate F0 — re-read and lock inputs

- Confirm baseline/decision log and Phase 4 acceptance exist and are current.
- Copy no external local paths into repository documents; cite source filenames/headings/IDs only.
- Enumerate approved collections, immutable records, transaction prerequisites,
  API status vocabulary and the three remaining items.
- **Blocker:** any unresolved high-risk database scenario or undocumented policy
  guess returns to Phase 2–4.

### Gate F1 — empty local boundary

- Establish the agreed direct `backend/` and `frontend/` project boundaries and shared configuration contract without adding product features.
- Keep provider credentials and machine-specific values out of source; local configuration uses the repository's actually approved mechanism only.
- Confirm the local MongoDB environment can support the transaction assumptions before any cross-document transaction is claimed as available.
- **Rollback:** remove only newly introduced boundary/configuration artifacts; do not remove approved docs or user data. If the local database prerequisite is unavailable, keep the foundation blocked rather than substituting non-transactional behavior for required invariants.

### Gate F2 — shared domain/database contract

- Backend/domain and Database/integration agree on IDs, immutable revision/package
  digests, explicit published revision bindings separate from draft/current
  pointers, parent consistency/publication transition result fields, status/state
  vocabulary, ownership checks, transaction/CAS boundaries, scoped idempotency,
  provider result statuses and audit fields.
- The shared review contract includes stage lease/claim plus deterministic
  attempt keys, batch-version completion CAS, evidence batch terminal/manual
  states, allowed Moderator decision states and active authorization epoch.
- Backend/domain records verified local login, email-match Google linking, hashed
  recovery/session invalidation, role cardinality, suspension/role removal,
  anonymization, and claim expiry.
- Database/integration agrees on webhook authentication, payment-code and
  transaction uniqueness, exact amount/expiry matching, exception Admin review,
  adjustments, defaults/bounds/rate snapshots, and monthly payout/slip policy.
- Backend/domain agrees on canonical AST/editor, platform theme tokens, optional
  alt text, rights and text-layer PDF validation, with no OCR.
 - Frontend receives allowed/denied/pending/failed states, Guest
   `locked-preview`/free transition, Reader accessibility overrides and
   revision-reset notices.
- **Rollback:** if a contract mismatch appears, stop consumers, update the owning contract, and re-review affected phases. Do not add aliases or compatibility shims that conceal a changed domain rule.

### Gate F3 — local smoke acceptance (after database gate)

The team records observed outcomes, not invented command lines. Acceptance is complete only when a clean local setup can demonstrate all of the following through the agreed repository-native development entry points:

- backend and static frontend boundaries start through the approved local workflow and can exchange a minimal health/readiness interaction;
- backend can reach the approved local MongoDB deployment and the deployment supports a transaction-shaped smoke fixture without weakening the production invariant;
- an account/role/ownership check distinguishes authenticated identity from NovelHub role and blocks a cross-account private read;
- Chapter smoke accepts the confirmed AST blocks and optional missing alt text,
  rejects Markdown/raw CSS/custom fonts/audio/video, enforces the four theme
  tokens and Reader overrides, and preserves submitted content/theme facts.
- a submitted immutable revision/package digest remains identifiable after a
  new revision is created; changing submitted rights/media facts or
  availability cannot alter the package.
- story/chapter reads, access checks, TTS, resume and entitlement checks use
  explicit published revision bindings; a mismatched parent/publication
  transition is rejected with durable actor/precondition/result/failure evidence.
- the evidence state contract distinguishes pending, retryable, successful-empty
  discovery, terminal failed-stage/manual fallback and completed LLM review;
  stale lease/batch completion and viewing stored evidence perform no new
  analysis attempt.
- Identity smoke permits Google email-match linking, preserves unique provider
  subject, blocks unverified local login, and verifies one-time recovery.
- a duplicate confirmed top-up/provider callback cannot credit the wallet
  twice or cross purpose/unit; an eligible unlock cannot debit/allocate twice
  and preserves price/access and negotiated allocation snapshots in an
  append-only ledger trail.
- a moderation decision against a changed revision, stale evidence batch,
  pending state, or changed authorization epoch is rejected without a success
  audit/notification.
- Report/comment smoke covers targets/actions, soft delete/replies/likes;
  statistics prove unique daily views and rolling 30-day popularity; PDF smoke
  rejects scans/no OCR and preserves draft after transient source cleanup.
- a committed business result remains committed when an email/provider delivery attempt fails.
- frontend renders protected/unknown/pending/failed states from backend
  responses without provider secrets or guessed policy; Reader resume can enter
  saved accessible content directly without requiring a Story Detail round trip.
- no smoke fixture persists real credentials, payment credentials, personal data beyond synthetic test identities, raw provider prompts, or unbounded content.
- Top-up smoke covers NovelHub invoice/payment page/VietQR, authenticated
  webhook, exact amount/unexpired NH-code match, duplicate no-op, unique codes,
  Admin exception review, and configurable 24h expiry.
- Access/publication smoke covers first-chapter Guest `locked-preview` title/
  prompt-only state with no view, free-after-expiry transition, logged-in
  cached TTS, same-chapter resume reset, no re-unlock on edit/republish,
  old-live edits, first-release order, later unpublish behavior and late
  approval.
- Finance/staff smoke covers defaults/bounds, floor/remainder split, mandatory
  adjustment reason, never-expiring coins, suspension pausing only future
  evaluations, queue release, former-Author freeze/cancellation, Admin-only
  audited direct republish, missing-bank skip notification, deletion
  retention/forfeiture/one-time final payout, Admin-entered support bank
  corrections versus future-only profile updates, inaccessible old unlocks/
  no new earnings after deletion, retained-email final-slip/removal, financial
  closure, Paid slips, and no TTL on forever-retained records.
- Retrieval smoke proves passage embeddings, cosine/top-k filters and grounded
  LLM inputs; chunk size/top-k are not business-policy acceptance gates.
- TTS failure smoke preserves text reading and shows recorded error/retry;
  email exhaustion smoke stops after three backoff attempts, marks failed,
  and leaves the in-app notification. Evidence-stage failures retain claim/CAS
  and terminal manual fallback.

A failed smoke item blocks downstream feature work and names its lane and return
phase. It is not “fixed” by suppressing the failure, bypassing the transaction,
or inventing behavior beyond confirmed decisions.

## Shared test and evidence matrix

| Contract | Later verification evidence | Acceptance owner |
|---|---|---|
| Identity/roles/ownership | Backend unit tests for role/provider separation; recovery challenge/session invalidation and Google-link conflict integration evidence; active authorization epoch/owner-keyed read tests; UI denial/unknown rendering | Backend/domain + Frontend, reviewed by Integration/review |
| Immutable revision and mandatory evidence | Approved AST/themes/optional alt, immutable package, old-live edits, requested/first-release order, claim expiry, exact evidence/stage guards and no-rerun; no OCR. | Backend/domain + Database/integration |
| Moderation/reports | Atomic decision evidence for exact batch/version, terminal-state/authorization epoch; report original revision snapshot/hash/unavailable marker and stale target CAS scenarios | Backend/domain, reviewed by Integration/review |
| External boundaries | Provider adapter status and durable lease/attempt checks; source-event-keyed outbox retry/duplicate delivery evidence; PDF import evidence proves no source-PDF object/mediaAsset or persistent URL/path/key/binary, cleanup on success/failure/cancel/timeout, and extracted draft/status survival; bounded statistics seam; no live secrets | Database/integration, reviewed by Integration/review |
| Monthly finance/top-up | Fixed packages, NovelHub/VietQR page, authenticated SePay webhook and exact code/amount/expiry credit once, Admin exceptions; confirmed monthly default threshold, rate/rounding, bank/slip and suspension policies; no payout provider. | Database/integration |
| Frontend static contract | Public/protected/pending/failed/unknown and `locked-preview`/free transition; direct resume through published revision binding; no silent offset reinterpretation or provider credentials | Frontend |
| Migration/reversibility | Rerunnable fixture migration, index verification and rollback/recovery evidence; no destructive history rewrite | Database/integration + Integration/review |

The exact test runner, package scripts and local service setup are discovered from the repository once implementation is authorized; this plan intentionally does not invent commands.

## Deferred selection and process gates carried into foundation

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

TTS remains behind a provider-neutral adapter; failures are recorded and show
a Reader error/retry button without affecting text. Owner names stay
“member TBD”; Phase 5 remains blocked. Neither an unselected provider nor a
process gate permits an invented fallback or product scope expansion.

## Risk, compatibility and rollback

| Risk | Likelihood × impact | Mitigation |
|---|---|---|
| Foundation starts before database acceptance | Medium × Critical | F0 hard gate; Integration/review checks decision-log acceptance before assigning F1; no code in this phase. |
| Five lanes create conflicting contracts | Medium × High | Ownership table, one owner per file, shared contract review at F2, no temporary policy shims. |
| Local environment hides production transaction assumptions | Medium × High | F1 replica-set capability check and F3 transaction smoke; block rather than downgrade invariants. |
| Frontend invents product behavior from missing backend data | Medium × High | Status vocabulary and remaining-items list are shared; Frontend renders unknown/pending rather than choosing entitlement/payout/rate rules. |
| Provider secrets or personal data enter fixtures/logs | Medium × High | Synthetic fixtures only, field classification from Phase 3, provider adapter boundary, Integration/review checks evidence. |
| Rollback damages immutable history | Low × Critical | Versioned migrations and path rollback only; preserve revisions, evidence, finance, moderation and audit records. |

Backward compatibility is limited to the approved local foundation because no existing application or database is present in this repository. If a later field/API changes, migrate callers in the same owned contract change, version only when the accepted compatibility requirement demands it, and preserve immutable historical records. Do not add aliases/re-exports or silently accept old policy semantics.

## Foundation completion criteria

The future foundation phase is complete only when:

- the five owners and file boundaries are acknowledged;
- F0–F2 contracts are documented and accepted after the database gate;
- F3 local smoke outcomes pass without fake commands, live secrets or additional product scope;
- all cross-document invariants still use the approved transaction/CAS/idempotency design;
- deferred technical selection and process prerequisites stay visible in the
  decision log; no invented provider/fallback replaces team acceptance;
- implementation evidence is reviewable by a teammate using only the repository, without access to external source paths.

This plan does not mark those criteria complete and does not authorize application bootstrap now.
