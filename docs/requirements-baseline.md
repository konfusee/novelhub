# NovelHub requirements baseline

## Finance amendment — confirmed 2026-11-11

The Coins & Payouts owner explicitly confirmed automatic simulated settlement.
This amendment supersedes older requirements for Admin approval, external-result
recording and Admin payout bank correction for the current demonstration scope.
At 00:00 on the 1st in Asia/Ho_Chi_Minh the system generates the monthly sheet,
reserves eligible accumulated earnings (default threshold 100,000 coins), and
automatically records simulated Paid/Failed outcomes. Admin has read-only payout
access: runs, statistics, history, filters and CSV export. No bank transfer occurs.
Every automatic outcome identifies simulation, a system actor and a deterministic
receipt key. Retries never debit or settle twice. Invalid destination information
leaves the obligation pending; the system never invents beneficiary details.
Historical records remain unchanged and unclassified records are labelled legacy.
See [current implementation and use cases](coins-payouts-completion.md) and
[updated diagrams](diagrams/payouts-automatic-current.drawio).


**Status: DRAFT FOR REVIEW.** This is the concise implementation contract for
requirements-to-domain-to-database work. It records current product intent and
constraints, not proof that an application or deployment exists.

## Authority and evidence

Apply this order when sources disagree:

1. Accepted decisions in this task and the **Confirmed decisions** section of
   `decision-log.md`.
2. The reconciled `SRS.md` narrative and its requirement/non-functional
   requirement sections.
3. `SRS-mismatches.md` for audited conflicts and omissions; its earlier open
   policy questions are superseded by confirmed decisions.
4. `novelhub_requirements_spec.md` for existing `FR-*`, `BR-*`, and `NFR-*`
   identifiers and their current wording, except where a higher authority
   supersedes stale wording.
5. `use-case-list.md` for canonical `UC-GST-*`, `UC-RDR-*`, `UC-AUT-*`,
   `UC-MOD-*`, and `UC-ADM-*` goals; `moderator-use-cases.csv` is the detailed
   Moderator contract.

Draft/template documents and legacy diagrams are evidence only. A universal
fixed rate is superseded: 70/30 is the configurable default, overridden by a
negotiated per-Author rate.
Citations in this repository name source filenames, headings, and IDs only;
no external source path is required.

## Product boundary and actors

NovelHub is an internet-connected platform for authoring, publishing, public
discovery, reading/listening, community interaction, moderation, and coin-based
early access. It contains content, revision, access, progress, community,
moderation, finance, notification, and reporting records. External identity,
payment, AI, audio, object-storage, and email providers remain outside the
NovelHub business-rule boundary.

- **Guest:** unauthenticated discovery and first-chapter-only reading. If
  chapter 1 is in early access, its locked preview shows only the title and
  login/unlock prompt, no text, and counts no view. After expiry its text is
  free; no other chapter is readable. Guests have no TTS, personal progress,
  community actions, or coin use.
- **Reader:** authenticated public access plus own profile, saved
  reading/listening position, follows, ratings, comments, reports,
  notifications, wallet, top-ups, and eligible unlocks.
- **Author:** an explicitly authorized account that retains permitted Reader
  capabilities and owns its stories, chapters, drafts, media declarations,
  submissions, statistics, earnings, and withdrawal records. Author access is
  separately granted through the application flow.
- **Moderator:** an explicitly authorized reviewer who reviews submissions and
  reports, then makes routine publication/report decisions. AI is advisory.
- **Admin:** an explicitly authorized platform operator who manages accounts,
  roles/permissions, categories and platform content, Author applications,
  financial policy, audit information, and reports. Admin access does not grant
  routine Moderator decisions or ownership of another account's personal state.

Authentication establishes identity; NovelHub independently assigns roles and
resource permissions (`FR-AUTH-03`–`FR-AUTH-07`, `BR-14`). Every account is a
Reader and may hold at most one additional staff role: Author, Moderator, or
Admin; Author and Moderator are mutually exclusive, and any account that ever
held Author is permanently barred from Moderator. Local email/password
accounts must verify email before login. Passwords are stored as a hash
on the account only, never plaintext, and never returned by normal reads. Email verification and password
reset use single-use, expiring emailed tokens stored only as hashes; a reset
signs out all sessions. Google linking
matches the existing account email; provider-subject uniqueness remains an
integrity constraint.
Admin approves or rejects Author applications with reason; rejected applicants
may reapply anytime.

Resource ownership is narrow: an account may update its own profile, progress,
follows, and permitted interactions, and inspect its own coin/earnings/status
records; only the finance service changes balances and withdrawals. Bank
snapshots and legal/account-holder names are visible to the Author and Admin
while the account is active, then Admin-only forever after deletion.
Corrected payment bank details are always Admin-only and never overwrite the
evaluation snapshot.
An Author may mutate owned editable content; Moderator/Admin operations remain
permission-scoped. Historical finance and moderation records are not rewritten.

## Core lifecycle contracts

### Content, revisions, and publication

1. An Author prepares a story/chapter draft with a block-editor canonical AST
   containing paragraph, heading, bold/italic, scene break, and image blocks,
   image references, and rights declaration (`FR-AUTHOR-02`–`FR-AUTHOR-15`,
   `UC-AUT-02`–`UC-AUT-07`, `UC-AUT-09`). Markdown is not V1 input. Invalid content or
   incomplete rights data returns correction feedback and does not create a
   valid review submission. Rights are declared per story submission as an
   original/licensed checkbox with an optional source/licence note.

   **Confirmed chapter-embed scope:** chapter content is text plus image blocks
   only. Audio/video embeds are out of current scope. Image alt text is
   optional, not a validation requirement, but remains available. The stale
   source `FR-AUTHOR-07` audio/media wording is superseded for chapter embeds;
   narration remains separate under `FR-READ-04`, `FR-MEDIA-04`, and
   `FR-MEDIA-05`.
   **Confirmed themes:** platform themes plus Author accent color from a
   contrast-checked palette, font family from a short platform list,
   heading/divider style presets, and cover/banner image. Raw CSS and custom
   font uploads are excluded. Reader font-size and dark-mode overrides are
   supported.
2. An accepted submission stores the **exact submitted revision** and freezes a
   package digest covering content structure, rights facts, and media-reference
   metadata/checksum/availability. Submitted rights/reference facts are immutable;
   unavailable media is an explicit tombstone. The submission opens a
   revision-scoped pending review cycle. Revision identity, submission state,
   processing state, and publication state are distinct concerns.
3. Every accepted submission or resubmission MUST run, in order: OpenAI
   embeddings; NovelHub similarity matching and source/passage evidence
   collection; then OpenAI LLM synthesis consuming the exact revision, review
   criteria, rights context, and actual findings (`FR-MOD-01`–`FR-MOD-05`,
   `BR-13`). A deterministic stage attempt key and lease/claim precede each
   provider call; completion uses compare-and-set against the claim and batch
   version. A successful empty discovery is still sent to the LLM.
   Similarity searches only NovelHub published/pending chapters, excludes the
   submitting Author's work and web sources, and shows advisory score/passages
   without cutoff or flag threshold.
   Chapters are split into passages embedded with OpenAI Embedding; MongoDB
   vector search retrieves top-k nearest NovelHub passages by cosine
   similarity for the LLM. Chunk size/top-k are implementation parameters.
   Eligibility is checked against current revision/publication state before
   passages reach the LLM, so stale embedding metadata cannot admit rejected,
   superseded, or unpublished content.
4. Embedding/comparison or LLM failure stops the automated phase, records the
   failed stage and only real partial evidence, and enables manual Moderator
   review. Stage state distinguishes pending, retryable, terminal/manual failure,
   and available. Pending/unavailable AI is diagnostic and never a bypass to
   formal review; a comparison failure or stale claim makes LLM invocation
   impossible. Similarity and LLM output are advisory signals, not legal verdicts;
   AI never approves or rejects publication (`FR-MOD-06`–`FR-MOD-08`, `BR-11`,
   `BR-12`). Viewing stored results never reruns a provider.
5. After successful analysis or reported failure, a Moderator may leave the
   item pending, approve, or reject it; there is no separate revision outcome.
   Rejection requires actionable reasons, in which the Moderator states the
   severity. A decision atomically checks Moderator authority
   and active authorization epoch, current pending status, exact evidence batch
   identity/version, an allowed terminal batch state (available-for-human-review
   or explicit failed stage), and the unchanged reviewed revision before
   persisting status and immutable/read-only history (`FR-MOD-07`, `FR-MOD-10`,
   `FR-MOD-12`).
   Moderator claims prevent competing decisions; unanswered claims expire to
   queue at configurable default 24h. A rejected Author may revise and
   resubmit without limit; each resubmission is a new revision, submission,
   and evidence/review cycle. Rejection unlocks immediately: a rejected
   story-metadata submission clears the story's authoring freeze for that
   review and returns the story to draft, or to unpublished if it previously
   had a published version (a published story stays published with its old
   public version live); a rejected chapter submission returns any non-live
   chapter to draft, including one published, then unpublished and revised
   (it stays hidden and keeps its old published version), while a published
   chapter stays published with its old version live. A chapter decision
   never clears the story freeze, and
   rejection never clears a freeze caused by Author-role removal or account
   deletion. Revise remains available to start a new editable revision from
   the rejected one. Metadata and every new/edited chapter are reviewed, old
   published versions stay live until approval.
6. Approval does not publish by itself when no release time was requested.
   An Author may request release time at submission or schedule/publish now
   after approval. An elapsed requested time makes release due immediately on
   approval, subject to parent visibility and first-release order: N+1's
   first release never precedes N's first release. A due chapter waits and
   then auto-releases as soon as those guards permit. A later unpublish of N
   leaves later chapters live and does not block new releases N+2 and beyond.
   Story and chapter records maintain explicit `publishedRevisionId` bindings
   separate from draft/current pointers; all public read/access/TTS/resume paths
   use the published binding.
   A publication transition records actor, preconditions, result, failure,
   and timestamp and validates parent story/chapter consistency. A
   resubmission is a new exact revision and new review cycle; prior results
   and decisions remain history.

### Reading, access, and TTS

Published content is discoverable subject to publication/access rules. Guests
see only chapter 1: a locked preview (title and login/unlock prompt, no text or
view count) while in early access, then its free text after expiry. Login is
required for every other chapter and all TTS.
Readers read accessible chapters and save authenticated progress
(`FR-GUEST-01`–`FR-GUEST-10`, `FR-READ-01`–`FR-READ-11`); the decision log
supersedes the sources' broader Guest reading/listening goals.

A Reader's saved position resumes directly into the accessible chapter. After
a chapter edit it opens the same chapter from the start with a content-updated
notice. Access is rechecked at resume/read/listen time (`UC-RDR-03`,
`UC-RDR-12`). A successful unlock is chapter-scoped and lasts only through
early access; after the configured duration the chapter becomes free. An
unpublished chapter has no refund obligation; its unlock is valid again when
republished, bounded by the early-access end (`FR-COIN-05`–`FR-COIN-08`,
`BR-04`–`BR-06`).
Edits and republishing do not require another unlock or restart the original
early-access end; publication restrictions still block reads, TTS, resume,
and chapter comments even when an entitlement exists.

TTS is for logged-in users and only for text they can access. It uses one
default Vietnamese voice with no selection, generates on first request, and
caches audio by chapter revision and voice (`FR-MEDIA-04`, `FR-MEDIA-05`).
Generated audio does not expand text entitlement.
The provider is selected later by the team behind a provider-neutral adapter,
not an open business rule. A failure is recorded and shows an error/retry
button to the Reader; text reading is unaffected.

### Finance and duplicate-action safety

A Reader selects an Admin-defined fixed top-up package. NovelHub creates a
pending order with a unique payment code of `NH` plus eight random digits
(`NH[0-9]{8}`), owns the payment page/invoice, and displays a VietQR API-generated
QR with prefilled exact amount/content (not editable in bank apps) plus manual
bank account, amount, and transfer content. The Reader transfers from a
bank app; SePay only sends an API-key-authenticated incoming-transfer webhook.
NovelHub deduplicates by SePay transaction ID, extracts the code, and credits
coins at 1:1 exactly once only when code, exact amount, and an unexpired order
match. Pending orders expire after a configurable period, default 24 hours.
External VND receipts/order amounts stay separate from the internal coin
wallets; Reader coins and Author/system earnings have distinct immutable
purposes, all in coins (`FR-COIN-02`–`FR-COIN-04`, `NFR-REL-01`, `BR-09`).
Webhook duplicates are no-ops. Wrong amounts, unknown/unrecognizable codes,
expired orders, and codes for already-paid orders are recorded for Admin
review with no automatic credit (`already-paid` for the last case). Admin
resolution uses a mandatory-reason audited adjustment. Invalid API-key requests
are rejected. Payment codes are unique among orders.

An eligible early unlock checks the explicit published revision,
publication/eligibility, configured price, balance, and existing access; its
coin deduction, chapter entitlement, effective price/access policy snapshot,
and negotiated allocation snapshot commit together under compare-and-set.
Author price is bounded to 200–5,000 coins and early-access duration to 1–14
days; both bounds are Admin-configurable. The same entitlement MUST NOT be
charged twice (`FR-COIN-05`–`FR-COIN-11`, `NFR-REL-02`–`NFR-REL-03`).

Eligible paid-unlock revenue uses a negotiated per-Author rate, falling back to
70% Author/30% platform. The Author share rounds down to whole coins and the
platform receives the remainder. The Author allocation is credited immediately
to the earnings wallet; top-up money is not Author revenue. Completed unlocks
are final and no refunds are provided. Admin coin additions/removals use
audited append-only adjustment entries with mandatory reasons. Reader coins
never expire.
Coins are the only internal balance/price/earnings/withdrawal unit. User-facing
VND amounts are limited to the top-up page and final payout slip; VND receipt
metadata is not a VND wallet.

The confirmed monthly payout-sheet run occurs on the **1st of each month at
00:00 in `Asia/Ho_Chi_Minh`** and evaluates the accumulated available earnings
balance, including coins held from earlier skipped months, not only new
earnings from the immediately preceding month. The current configured threshold
is compared and snapshotted at the cutoff; its default is 100,000 coins.
At `balance >= threshold` and with required bank details (bank name, account
number, account holder), the system debits the whole evaluated balance at
evaluation and creates one pending payout-sheet row. Bank details are not
externally verified; the Author is responsible. Below threshold creates no
withdrawal or notification; coins remain for next month. Missing details create
no withdrawal, leave coins in the wallet, notify the Author once per period,
and recheck next month. Suspended Authors are skipped only for
future monthly evaluations; withdrawals created before suspension remain
payable on the payout sheet. Author-role removal is not suspension and monthly
withdrawals continue. No manual request or prior Admin approval is required.
Deletion forfeits remaining Reader coins through a ledger entry, unpublishes the
Author's stories, blocks new unlocks and further earnings, and cancels all
unreleased work: pending submissions are removed from the Moderator queue, and
approved, scheduled, or due chapters never release. Cancelled/unreleased content
is excluded from similarity sources and uses `cancellationReason =
account-deleted`. The final unpaid earnings balance goes onto the next monthly
sheet regardless of threshold. Use the retained bank snapshot; missing details
follow the audited Admin correction path below. Existing pending withdrawals
remain payable without another debit. Existing unlocks become inaccessible with
no refunds. The account is financially closed, and the retained email is
removed, after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. If deletion finds no
unpaid earnings balance and no pending withdrawal, close the account and remove
the email immediately in the deletion transaction.

NovelHub never initiates a bank transfer. Admin/finance pays outside
the system and records each row `Paid` or `Failed`. Actor/time are required;
transfer reference and note are optional. Failed is a payment-result entry,
not a terminal withdrawal status: the row remains pending until paid later,
without returning coins. The Author contacts support with corrected bank
details; Admin always enters them on the pending row, audited and Admin-only,
without overwriting the original evaluation snapshot. Profile bank-details
updates apply only to future monthly evaluations, never an existing row.
Admin contacts suspended/deleted Authors off-platform as needed. Result
idempotency is per entry: Failed entries may precede one later Paid entry.
A Paid row's
slip appears in earnings history and is emailed. No fee/tax applies: its VND
equals withdrawn coins exactly (1 coin = 1 VND).
For a deleted Author, keep the email address Admin-only until financial
closure (defined above). Send withdrawal-created, Failed, and Paid-slip emails
to it, then remove it; this address is not part of forever-retained finance/audit
history.

### Media, community, and notification

V1 PDF import accepts text-layer PDFs only. Scanned/image PDFs are rejected
with a message; no OCR is performed. Extraction is transient into an editable
draft; no source PDF object, binary, URL, path, key, or `MediaAsset` persists.
Request memory and temporary parser files are cleaned on success, failure,
cancel, and timeout, while the extracted draft and minimal status survive;
retry after disposal requires Author re-upload
(`FR-AUTHOR-09`–`FR-AUTHOR-11`, `UC-AUT-05`).

Actual story assets and narration retain the VPSTTT Object Storage boundary.
For the local demo, the media module uses a configured local adapter behind
the same ownership, checksum, audit and serving contract because VPSTTT
credentials and endpoint details are not available. A production deployment
must replace that adapter before claiming VPSTTT-backed storage; this does not
change the route or revision contract.
Users may delete accounts even with financial history. Public profile/comment
surfaces are anonymized and comments display “Deleted user.” Finance/audit
records remain; finance/payout bank snapshots and legal/account-holder names
are retained forever in V1 and become Admin-only after deletion, not redacted.
While active, the Author and Admin can see the evaluation snapshot; corrected
details are always Admin-only and always entered by Admin from support-supplied
information. Deletion unpublishes Author stories and stops unlocks/earnings;
retained unlocks are inaccessible with no refunds. Published stories with
unlocks cannot be hard-deleted; Authors may only unpublish/archive with no
refunds. Author-role
removal freezes live stories against former-Author edits/unpublishing and
cancels all unreleased work (pending submissions and approved/scheduled/due
chapters); only already-live content stays and keeps earning. Account deletion
has the same cancellation behavior: pending submissions leave the Moderator
queue, approved/scheduled/due chapters never release, cancelled/unreleased
content is excluded from similarity sources, and cancellation uses
`account-deleted`. Admin/Moderator can still unpublish, and only Admin may fix
and directly republish an unpublished former-Author story, audited without
Moderator/AI review as an explicit exception only for former-Author stories.

Categories are Admin-managed; each story has exactly one main category. Authors
may add 0–10 free-form tags of 2–30 letters, digits, `-` or `_`, unique
regardless of case. Authors set story status Ongoing/Completed and may reopen
it. Search covers title, Author name and tags; filters cover category, tag and
status; sorting covers popularity, rating, and newest. Popularity is unique
daily views over a rolling 30 days.
Author V1 statistics cover views per story/chapter, followers, average rating,
unlocks and earnings per chapter/month, and comment counts. A view is unique
Reader/chapter/day, or unique guest device/chapter-one/day after free-text
access; a locked preview counts no view. Stories are
Vietnamese-only. Moderation evidence, audit, finance, notification and media
records are kept forever in V1 with no TTL/automatic deletion.

Readers may follow, rate, comment, and report permitted content. Comments
target stories or chapters; Readers may edit their own comments (shown as
“edited”), soft-delete them (retained for reports/audit), reply one level, and
like comments. Reports target story, chapter, or comment. Resolutions are
Dismiss, Hide comment, Unpublish chapter/story, or Warn Author; there is no
escalate-to-Admin action. A Reader cannot comment on a locked early-access
chapter. Hidden comments remain for audit, and unpublished content stays
hidden until the Author fixes and resubmits, except former-Author stories,
which only Admin may fix and directly republish as described above. Reports
retain target snapshots and unavailable markers
(`FR-READ-07`–`FR-READ-10`, `FR-MOD-09`–`FR-MOD-10`).
Each Reader has one editable/removable 1–5 rating per story; average is shown.
Story/chapter comment threads are separate. Admin suspension is separate from
report resolution; no report action itself suspends an account.

Email supplements in-app for verification/password reset/Google link,
review approval/rejection, and withdrawal created/Paid/Failed/missing-bank
skip. Followed-story new chapters are in-app only.
Committed business results create one source-event-keyed outbox intent;
delivery failure cannot erase the business outcome.
Email retries up to three attempts with backoff, then marks failed; the in-app
notification remains.

## External system boundaries

| Boundary | NovelHub responsibility | Requirement/use-case evidence |
|---|---|---|
| Google OAuth | Validate/link identity; retain role and permission authority | `FR-AUTH-03`–`FR-AUTH-05`, `UC-GST-07` |
| SePay incoming-transfer webhook | Notify NovelHub of incoming balance changes on NovelHub's bank account only; authenticate by API-key header. SePay provides no checkout, invoice, payment page, or transfer. | Confirmed top-up decision; `FR-COIN-02`–`FR-COIN-04`, `UC-RDR-14` |
| VietQR API | Generate the payment-page QR with prefilled exact package amount and payment code. | Confirmed top-up decision |
| Manual bank transfer by Admin/finance outside NovelHub | Admin/finance pays Authors from the payout sheet outside the system; NovelHub records each row's `Paid`/`Failed` result and optional reference, note, actor, and time. NovelHub does not initiate or retry transfers. | Confirmed payout-sheet decision; `FR-PAYOUT-04`, `FR-PAYOUT-09`, `UC-ADM-12`, `UC-ADM-13` |
| OpenAI Embedding Service | Receive submitted text and return vectors; no verdict | `FR-MOD-03`–`FR-MOD-05`, `UC-AUT-10` |
| NovelHub similarity process | Compare stored embeddings; collect actual source IDs/passages, including empty findings | `FR-MOD-04`, `BR-13` |
| OpenAI LLM Service | Synthesize advisory findings from exact revision and actual evidence | `FR-MOD-02`, `UC-MOD-08` |
| TTS Service | Generate narration from permitted text with the single default Vietnamese voice | `FR-MEDIA-04`, `UC-RDR-11` |
| VPSTTT Object Storage | Store/retrieve actual story assets and narration, not source import PDFs | `FR-MEDIA-01`–`FR-MEDIA-05`, confirmed PDF non-retention decision |
| Gmail SMTP Service | Deliver configured messages and return status/errors | `FR-NOTIFY-01`–`FR-NOTIFY-04` |

External providers never decide NovelHub roles, publication, legal rights,
coin policy, or finance rules. Provider outage/status is visible and retains
retry/audit information for provider-backed operations; the manual payout
workflow has no NovelHub payout-provider call. Email failure cannot roll back
a committed business outcome (`NFR-REL-04`, `NFR-MAIN-01`–`NFR-MAIN-03`).

## Database-relevant traceability

This map avoids reproducing the complete catalog while preserving the IDs that
must anchor domain and schema decisions. Canonical use-case IDs come from
`use-case-list.md`; intentional gaps (`UC-AUT-08`, `UC-MOD-07`, `UC-ADM-07`)
are preserved.

| Design boundary | Required traceability anchors |
|---|---|
| Identity, roles, permissions, ownership | `FR-AUTH-01`–`FR-AUTH-08`, `FR-AUTHOR-01`, `FR-ADMIN-01`–`FR-ADMIN-02`, `BR-14`; `UC-GST-05`–`UC-GST-08`, `UC-AUT-01`, `UC-ADM-01`–`UC-ADM-02` |
| Story/chapter/draft/media/rights | `FR-AUTHOR-02`–`FR-AUTHOR-16`, `FR-MEDIA-01`–`FR-MEDIA-05`; `UC-AUT-02`–`UC-AUT-07` |
| Transient PDF extraction and editable draft provenance | `FR-AUTHOR-09`–`FR-AUTHOR-11`, `UC-AUT-05`; confirmed PDF non-retention decision; rights remain `FR-AUTHOR-13`–`FR-AUTHOR-14`, `UC-AUT-07` |
| Exact revisions, submissions, review evidence, decisions/history | `FR-AUTHOR-18`, `FR-MOD-01`–`FR-MOD-13`, `BR-11`–`BR-13`, `NFR-REL-05`–`NFR-REL-06`; `UC-AUT-10`–`UC-AUT-11`, `UC-AUT-14`, `UC-MOD-01`–`UC-MOD-03`, `UC-MOD-06`, `UC-MOD-08` |
| Publication/access/progress/TTS | `FR-GUEST-01`–`FR-GUEST-10` (broader Guest reading/TTS superseded by chapter-one-only rule), `FR-READ-01`–`FR-READ-06`, `FR-MEDIA-04`–`FR-MEDIA-05`, `FR-COIN-05`–`FR-COIN-12`, `BR-02`, `BR-04`–`BR-06`; `UC-GST-01`–`UC-GST-04`, `UC-GST-09`–`UC-GST-11`, `UC-RDR-02`–`UC-RDR-03`, `UC-RDR-10`–`UC-RDR-12` |
| Community and reports | `FR-READ-07`–`FR-READ-10`, `FR-MOD-09`–`FR-MOD-10`; `UC-RDR-04`–`UC-RDR-07`, `UC-MOD-04`–`UC-MOD-06` |
| Top-ups, unlocks, allocation, earnings, withdrawals, reports | `FR-COIN-01`–`FR-COIN-14`, `FR-PAYOUT-01`–`FR-PAYOUT-04`, `FR-PAYOUT-09`–`FR-PAYOUT-10`, `FR-ADMIN-05`–`FR-ADMIN-07`, `FR-ADMIN-09`–`FR-ADMIN-13`, `BR-07`–`BR-10`, `NFR-REL-01`–`NFR-REL-04`; `UC-RDR-09`–`UC-RDR-10`, `UC-RDR-14`–`UC-RDR-15`, `UC-AUT-09`, `UC-AUT-13` (superseded manual-request goal), `UC-AUT-15`–`UC-AUT-17`, `UC-ADM-05`, `UC-ADM-08`–`UC-ADM-13` |
| Notifications and audit | `FR-NOTIFY-01`–`FR-NOTIFY-04`, `FR-MOD-10`, `FR-ADMIN-04`; `UC-RDR-08`, `UC-AUT-11`, `UC-MOD-06`, `UC-ADM-04` |

Any new collection, relationship, uniqueness rule, index, state, or
transaction boundary must cite one of these requirements/use-case anchors or
be labelled a **Proposed technical design** in `decision-log.md` and the
relevant design phase.

## Security, reliability, and non-negotiable invariants

- Protected operations enforce role and resource permission. Suspended
  Authors cannot log in/submit and their stories are hidden. Only future
  monthly withdrawal evaluations pause; existing withdrawals stay payable.
  Suspended Moderators/Admins release claimed work to the shared queue.
  Author-role removal instead preserves live/earning published stories and
  withdrawals but freezes former-Author edits/unpublish and cancels all
  unreleased work; only Admin may directly fix/republish former-Author content,
  audited without Moderator/AI review. Former Authors can never be Moderators.
  Account reinstatement is `suspended → active`; history is preserved.
- Users cannot access another account's progress, wallet, earnings, withdrawal
  data, or unauthorized media; password hashes, email tokens, session
  state, and other tokens are not plaintext, source code, or logs
  (`NFR-SEC-03`–`NFR-SEC-05`).
- Confirmed provider top-ups and successful unlocks are idempotent. Wallet and
  ledger purpose/type/unit are explicit; balance deduction, entitlement,
  effective price/access snapshot, and negotiated-rate allocation are recorded
  consistently (`NFR-REL-01`–`NFR-REL-03`).
- Provider failures expose status and preserve retry/audit context. Stage
  claims and completion CAS prevent stale later calls; manual moderation remains
  possible only after an explicit AI failure, and stored evidence remains usable
  if a provider later becomes unavailable (`NFR-REL-04`, `NFR-REL-05`).
- Published reads/access/TTS/resume use explicit published revision bindings;
  submitted package/rights/reference facts are immutable; current-revision
  validation, moderation status/batch/version/authorization guard, decision,
  and audit history are atomic. Notification failure does not undo a committed
  outcome (`NFR-REL-06`).
- Moderation evidence, finance history, and content/report actions are
  append-only from a user-facing policy perspective; reports retain target
  snapshots or unavailable markers; corrections are explicit
  adjustments/new records, not silent historical rewrites.

## Deferred selection and process-gate pointers

The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

See the [decision record](./decision-log.md#deferred-technical-selection-and-process-gates)
for owners and safe treatment. All business rules are confirmed. AI authoring
assistance is not V1; preferences stop at editor/themes/font-size/dark-mode.
Owner names remain “member TBD” by choice. Draft status is not acceptance.

