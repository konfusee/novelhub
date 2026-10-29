# NovelHub decision log

**Status: DRAFT FOR REVIEW.** This log is the decision surface for the
requirements-to-database work. “Confirmed” is the current accepted contract;
“Proposed technical design” is advice for domain/schema review, not product
policy; deferred technical selections and team process gates are not approval.

## Confirmed product and team decisions

1. **Requirements precede implementation.** The team curates a self-contained
   repository baseline and reviews the domain/MongoDB design before any
   application or monorepo foundation bootstrap. The active sequence is owned
   by `plans/261007-1022-novelhub-requirements-to-database/plan.md`.
2. **Source authority is reconciled, not copied.** The accepted contract and
   this confirmed section outrank `SRS.md`; `SRS-mismatches.md` is the audit
   record; `novelhub_requirements_spec.md` supplies existing `FR-*`, `BR-*`,
   and `NFR-*` IDs; `use-case-list.md` supplies canonical `UC-*` IDs and
   `moderator-use-cases.csv` supplies detailed Moderator behavior. Legacy
   diagrams and template/draft text are evidence only. Existing numbering
   gaps are preserved and use-case drift is mapped by goal.
3. **Revenue uses negotiated rates with a configurable default.** Eligible
   early-unlock revenue uses the Admin-recorded per-Author negotiated rate;
   otherwise default 70% Author/30% platform applies. Author share rounds down
   to whole coins; platform receives the remainder. Top-up is not revenue.
4. **Monthly payout-sheet withdrawal and earnings finality.** The monthly run is
   the **1st of each month at 00:00 in `Asia/Ho_Chi_Minh`**. It evaluates the
   accumulated available Author earnings balance, including balances carried
   over after skipped months, not just the preceding month's new earnings.
   At **`balance >= current configured threshold`** (default 100,000 coins),
   with complete profile bank name/account number/account holder and no
   suspension, it snapshots the threshold and cutoff balance, debits the whole
   evaluated balance, and creates one pending withdrawal/payout row per Author
   per period. Below threshold creates no withdrawal or notification; coins
   remain for next month. Missing bank details creates no withdrawal, keeps
   coins, notifies the Author once per period, and rechecks next month. There
   is no manual Author request or prior Admin approval. Suspension blocks
   future evaluations only, not payment of existing withdrawals. Account
   deletion instead unpublishes the Author's stories, stops new unlocks
   and further earnings, cancels all unreleased work, and forces the final
   unpaid earnings balance onto the next monthly sheet regardless of threshold,
   using the retained bank snapshot. Pending submissions leave the Moderator
   queue; approved, scheduled, or due chapters never release; cancelled/
   unreleased content is excluded from similarity sources and uses
   `cancellationReason = account-deleted`. This is a one-time final payout.
   The account is financially closed, and the retained email is removed, after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. If deletion finds no unpaid
   earnings balance and no pending withdrawal, close and remove the email
   immediately in the deletion transaction. Existing unlocks become inaccessible
   with no refunds.
   Admin/finance pays outside NovelHub and records each row **Paid** or
   **Failed**, retaining actor/time and optional transfer reference/note. Failed
   is a result entry; the withdrawal stays pending until later paid, with no
   coin return. The Author supplies corrected bank details via support;
   **Admin always enters them on the pending row**, audited and Admin-only,
   never overwriting the evaluation snapshot. An Author's profile bank-details
   update applies only to future monthly evaluations, not an existing row.
   For a suspended/deleted Author, Admin contacts them off-platform. Missing
   details on a deleted account follow the same audited correction path.
   Payout slip equals withdrawn coins (1 coin = 1 VND),
   with no fee/tax. NovelHub initiates no transfer; SePay is top-up only.
   Manual/on-demand withdrawals are out of scope. Unlocks immediately credit
   Author share within the debit/entitlement/allocation transaction; unlocks
   are final with no refunds. Admin corrections are append-only adjustments.
   **Coins are the only internal unit.** Reader balances, chapter prices,
   Author earnings, the configurable withdrawal threshold, and withdrawal
   amounts are coins. VND appears only on the top-up page and final payout slip.
5. **Moderation is ordered and human-controlled.** Every accepted submission or
   revision follows embedding generation, NovelHub similarity/source and
   passage discovery, then LLM synthesis using the actual evidence. Empty but
   successful discovery still reaches LLM. AI output is advisory; it cannot
   approve/reject or produce a legal verdict. Embedding/comparison/LLM failure
   stops automation and leads to manual review with the failed stage and only
   real partial evidence. Pending AI does not permit review, and viewing stored
   results never reruns AI.
6. **Review is revision-scoped.** The exact submitted revision is the review
   subject. Decisions atomically validate current pending status, Moderator
   authority, and unchanged revision. A resubmission creates a new revision and
   review cycle; previous evidence and decisions remain history. Stale or
   failed saves cannot report success.
7. **Identity and authorization are separate.** Google OAuth verifies identity;
   NovelHub assigns roles and resource permissions. Admin does not thereby
   gain routine Moderator decisions, and no actor may access another account's
   personal state without authorization.
8. **Reader continuation is direct.** Saved-position resume may enter an
   accessible chapter directly; reopening Story Detail is not mandatory.
9. **Duplicate financial actions are forbidden.** A matched SePay bank
   transaction credits a top-up once per unique transaction ID. A successful
   unlock does not charge twice for the same entitlement. Balance, entitlement,
   and negotiated
   allocation records remain consistent and auditable; corrections are
   adjustments, not silent rewrites.
10. **External boundaries stay explicit.** Google OAuth, SePay incoming-transfer
    webhooks, VietQR API, OpenAI Embedding/LLM, TTS, VPSTTT Object Storage and
    Gmail SMTP are integrations, not NovelHub business-rule authorities.
    NovelHub owns the invoice/payment page and has no payout provider.
    Provider failure must retain status/audit context; email failure cannot roll back a committed
    business outcome.
11. **Repository documentation is portable.** Committed docs cite source
    filenames, headings, and IDs only. They contain no external filesystem
    links, secrets, personal data, or `links.md`; no application code is part
    of this task.
12. **PDF import retains extracted content, not its source.** A supported
    text-layer PDF is transient input to an editable draft, not a story asset.
    Do not upload the source PDF to object storage, create a `MediaAsset` for
    it, or persist its binary, URL, path, or object key. Discard request memory
    and any necessary temporary local parser file on success, failure,
    cancellation, and timeout. Retain the extracted editable draft and minimal
    extraction status/metadata, with an optional checksum; retry after source
    disposal requires Author re-upload. The Author must review/correct the
    extracted content and declare rights before submission
    (`FR-AUTHOR-09`–`FR-AUTHOR-11`, `FR-AUTHOR-13`–`FR-AUTHOR-14`,
    `UC-AUT-05`, `UC-AUT-07`).
    Scanned/image PDFs are rejected with a message; no OCR is in V1.
    Object storage remains for actual story assets and narration. This
    confirmed constraint is not runtime implementation evidence.

13. **Chapter embeds are image-only for the current scope.** Chapter content
   is text plus image blocks; audio/video embeds are excluded. The stale source
   `FR-AUTHOR-07` audio/media wording is superseded for chapter embeds only.
   TTS remains separate generated narration governed by `FR-READ-04`,
   `FR-MEDIA-04`, and `FR-MEDIA-05`; it does not expand text entitlement.
14. **Interview batch 3 closes access, publication, identity, community,
   reading, formatting, and notification gates.** Entitlements are
   chapter-scoped and last only through early access; chapters become free
   automatically at the configured end. Authors set price and duration within
   Admin-configured bounds: price is 200–5,000 coins and duration is 1–14
   days. Revenue uses a per-Author negotiated rate, with a 70% Author/30%
   platform default when no negotiated rate exists; the Author share rounds
   down and the platform receives the remainder. The Author chooses requested
   release time at submission or schedules/publishes after approval. An elapsed
   requested time makes publication due immediately on approval, without
   bypassing parent visibility or first-release order; a due chapter waits
   until those guards allow it. No requested time means no auto-publication.
15. **Identity and suspension.** Every account is a Reader plus at most one of
   Author, Moderator, or Admin; Author and Moderator cannot be combined.
   Any account that ever held Author is permanently barred from Moderator.
   A suspended Author cannot log in or submit, their stories are hidden, and
   future monthly evaluations pause; existing withdrawals remain payable.
   Suspended Moderators/Admins release claimed reviews/reports back to the
   shared queue; past decisions remain.
16. **Moderation and community.** Similarity compares only NovelHub published
   and pending chapters, excluding the submitting Author's own work. It has no
   cutoff or flag threshold and remains advisory; score and matched passages
   are shown to the Moderator. Comments target stories or chapters, and a
   Reader cannot comment on a locked early-access chapter. Each Reader has one
   editable/removable 1–5 rating per story. Reports target stories, chapters,
   or comments. Resolutions are Dismiss, Hide comment, Unpublish
   chapter/story, or Warn Author; there is no escalate-to-Admin action.
   Account suspension is a separate Admin action.
   Hidden comments remain for audit. Unpublished content stays hidden until
   the Author fixes and resubmits it, except former-Author stories: only Admin
   may fix and directly republish them in an audited action without Moderator
   or AI review. A chapter unpublished after a paid
   unlock gives no refund; the unlock is valid again when republished,
   bounded by the early-access end.
17. **Reading, TTS, and notifications.** Guests see only chapter 1, with a
   locked preview during early access and free text after expiry. The locked
   preview is title plus login/unlock prompt only, with no chapter text and no
   counted view. No other chapter is readable. TTS is logged-in-only with text
   access, generated on first request and cached by chapter revision and the single default
   Vietnamese voice; there is no voice selection. After a chapter edit,
   resume opens the same chapter from the start with a content-updated notice.
   Email supplements in-app notifications for verification, password reset,
   Google link, review approval/rejection, withdrawal created, Paid, Failed,
   and missing-bank skip. Followed-story new-chapter notices are in-app only.
18. **Google linking uses email matching.** Google sign-in may link to an
   existing account by matching email only, overriding the earlier
   no-email-only-linking proposal. The accepted risk is pre-account hijack when
   someone registers a local account with the victim's email before Google is
   used. Requiring local email verification before login substantially
   mitigates this accepted risk: an unverified account cannot log in and is not
   treated as verified. Provider-subject uniqueness remains an integrity
   constraint, not a second linking safeguard.
19. **Authoring, themes, and rights.** Authoring input is a block editor
   stored as a validated canonical AST; Markdown is not a V1 input. Platform
   themes plus four Author customization tokens are confirmed: accent color
   from a contrast-checked palette, font family from a short platform list,
   heading/divider style presets, and cover/banner image. Raw CSS and custom
   font uploads are excluded. Readers may override font size and dark mode.
   Image alt text is optional but remains an available field; validation MUST
   NOT require it. A rights declaration is per story submission, original or
   licensed, as a checkbox with an optional source/licence note.
20. **Finance, statistics, language, and retention.** Admin-defined fixed
   top-up packages are the only top-up amounts (VND to coins at 1:1), with no
   custom amounts. The withdrawal threshold defaults to 100,000 coins and is
   Admin-configurable. No bank-detail verification is required. When a payout
   row is marked Paid, its slip is shown in earnings history and emailed; a
   failed transfer remains pending until the Author supplies details via
   support and Admin records the correction; no self-service row correction.
   Profile bank changes apply only to future evaluations. V1 Author
   statistics cover views per story/chapter, followers, average rating,
   unlocks and earnings per chapter/month, and comment counts; a view is one
   unique Reader per chapter per day, or one Guest device for chapter one
   after its text is free; a locked preview counts no view.
   V1 retains moderation evidence, audit, finance, notification, and media
   records forever with no automatic deletion. Stories are Vietnamese-only.
21. **Content lifecycle and discovery.** Report/account actions do not hard
   delete history: account deletion anonymizes public profile/comment surfaces
   (“Deleted user”), even when finance history exists. Finance/audit records
   remain; bank snapshots and legal/account-holder names stay forever in V1.
   The Author and Admin may see the evaluation snapshot while the account is
   active; after deletion, only Admin may see it. Corrected details remain
   Admin-only. Deletion forfeits Reader coins through a ledger entry, unpublishes
   stories, blocks new unlocks and further earnings, and cancels all unreleased
   work. Pending submissions leave the Moderator queue; approved/scheduled/due
   chapters never release; cancelled/unreleased content is excluded from
   similarity sources and uses `cancellationReason = account-deleted`.
   Deletion puts the final unpaid earnings balance on the next monthly sheet
   regardless of threshold, using the retained snapshot or audited Admin
   correction. The account is financially closed, and its retained email is
   removed, after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. If deletion finds no
   unpaid earnings balance and no pending withdrawal, close and remove the email
   immediately in the deletion transaction. Keep its email Admin-only until financial closure, and send withdrawal-created, Failed, and Paid-slip
   emails to it before removal.
   Authors cannot hard-delete published stories with unlocks; they
   may only unpublish/archive, with no refunds. Admin-managed categories require
   one or more per story. Authors set Ongoing/Completed status and may
   reopen it. Search covers title and Author name; filters cover category and
   status; sorting covers popularity, rating, and newest. Popularity is unique
   daily views over a rolling 30 days.
22. **Early-access bounds and revenue default.** The default price bounds are
   200–5,000 coins and duration bounds are 1–14 days, both Admin-configurable
   afterwards. The default revenue split is 70% Author/30% platform only when
   no negotiated per-Author rate exists; negotiated rates override it and the
   Author share rounds down.
23. **Superseded source wording.** Earlier secure Google-link language that
   forbade email-only linking, open entitlement/reuse wording, automatic
   publication ambiguity, multi-role alternatives, generic similarity/TTS
   gates, required alt text, Markdown/custom-theme proposals, variable
   top-up amounts, retained-PDF/OCR assumptions, hard-delete assumptions,
   fixed-or-undefined finance wording, and incomplete report/notification
   sets are superseded by decisions 14–32.
   Existing source IDs remain traceability anchors; stale wording is not an
   additional requirement.
24. **Accounts, coins, and moderation workflow.** Reader coins never expire.
   Admin may manually add or remove coins only through an audited append-only
   adjustment with a mandatory reason. Local email/password accounts must
   verify email before login. Admin approves/rejects Author applications with
   a reason; a rejected applicant may re-apply anytime. Removing the Author role
   leaves published stories live, earning, and frozen against Author edits/
   unpublish; allocations and monthly withdrawals continue. Admin/Moderator may
   still unpublish; the stories are otherwise frozen as-is. Only already-live
   content stays: all unreleased work is cancelled, including pending
   submissions and approved/scheduled/due chapters; none may auto-release.
   Account deletion has the same cancellation behavior: pending submissions are
   removed from the Moderator queue, cancelled/unreleased content is excluded
   from similarity sources, and cancellation uses `account-deleted`.
   If a former-Author story is unpublished, only Admin may fix and publish it
   directly as an audited Admin action without Moderator/AI review. This is an
   explicit exception only for former-Author stories; the former Author
   still cannot edit and can never become a Moderator.
25. **Review and publication controls.** Moderators claim queue items and other
   Moderators cannot decide a claimed item. Unanswered claims release
   automatically after a configurable period, default 24 hours. Decisions are
   approve or reject only (decision 32); rejection requires actionable
   feedback and permits unlimited resubmissions, each with a new
   revision/review cycle. Moderator review covers story metadata and every
   new/edited chapter; old published chapter/metadata versions remain live
   until approval.
   Authors may request release time at submission or schedule/publish after
   approval. Sequential order applies only to first release: chapter N+1's
   first release cannot precede N's first release. Late approval makes a
   chapter due; it auto-releases when parent visibility and first-release
   guards permit, immediately if the preceding chapter has already had its
   first release. Unpublishing N leaves later chapters live and does not block
   first release of new chapters N+2 and beyond.
26. **Comment lifecycle.** Readers may edit their own comments (shown as
   “edited”) and soft-delete them; deleted comments remain for reports/audit.
   Replies are limited to one level and comments support likes.
27. **Top-up is a NovelHub-owned bank-transfer matching flow.** SePay is only
   an API-key-authenticated webhook announcing incoming balance changes on
   NovelHub's bank account; it does not provide checkout, invoices, payment
   pages, or transfers. NovelHub creates pending fixed-package orders with a
   unique `NH` plus eight random digits payment code (`NH[0-9]{8}`), owns the
   payment page and invoice, and displays a VietQR API-generated QR with
   prefilled exact amount/content (not editable in bank apps) plus manual
   bank account, amount, and transfer content. A valid webhook is
   deduplicated by SePay transaction ID, code-extracted by regex, and credits
   exactly the matching unexpired order once. Wrong amounts, unknown or
   unrecognizable codes, expired orders, and reused codes of already-paid
   orders enter Admin review without credit (`already-paid` for the last case).
   Invalid API-key requests are rejected. Orders expire after a configurable
   period, default 24 hours. Admin resolution is audited and may assign a
   transaction to an order/user through a mandatory-reason adjustment.
28. **Similarity retrieval is confirmed.** Split chapters into passages,
   embed each passage with OpenAI Embedding, and retrieve top-k nearest
   NovelHub passages using cosine similarity through MongoDB vector search.
   Only published/pending chapters are eligible, excluding the submitting
   Author's own work. Matches feed the LLM; findings remain advisory with no
   cutoff. Chunk size and top-k are implementation parameters, not product
   policy gates.
29. **TTS failure and adapter boundary.** The team chooses the provider later
   behind a provider-neutral adapter; this is a deferred technical selection,
   not an open business rule. Failure is recorded and shows the Reader an
   error with a retry button; text reading is unaffected.
30. **V1 authoring scope and email delivery.** AI authoring assistance is not
   in V1. Preference scope is only the confirmed block editor, four theme
   tokens, and Reader font-size/dark-mode overrides; additional preferences
   are not an open scope item. Email delivery retries up to three attempts
   with backoff, then marks failed; the in-app notification still exists.
   Owner names remain “member TBD” by user choice;
   team acceptance and local-tooling prerequisites are process gates.

31. **Guest chapter-one preview, finance retention, and suspension timing.**
   Chapter 1 may be in early access: a Guest sees only its title and a
   login/unlock prompt, never text or a counted view, until the window ends;
   then its full text is free. Guests cannot read any other chapter. Account
   deletion anonymizes public profile/comment surfaces but retains finance,
   payout bank snapshots and legal/account-holder names forever, Admin-only
   after deletion. While active, the Author and Admin can see the evaluation
   snapshot; corrected payment details are always Admin-only. Deletion is
   allowed with finance history, forfeits Reader coins by ledger entry, cancels
   all unreleased work, and forces the final earnings balance onto the next sheet
   regardless of threshold. Pending submissions leave the Moderator queue;
   approved/scheduled/due chapters never release; cancelled/unreleased content
   is excluded from similarity sources and uses `account-deleted`.
   Deletion unpublishes the Author's stories, with no new unlocks or further
   earnings; retained unlocks are inaccessible, without refunds. The account
   is financially closed, and its retained email is removed, after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. If deletion finds no unpaid earnings
   balance and no pending withdrawal, close and remove the email immediately in
   the deletion transaction. Retain the email Admin-only until financial closure, and send withdrawal-created, Failed, and Paid-slip emails before
   removal.
   If an Author is suspended after a withdrawal was
   created, that existing withdrawal remains payable and stays on the payout
   sheet; suspension pauses only future monthly evaluations.

32. **Publication decisions are approve or reject only (confirmed
   2026-10-29).** A Moderator leaves a submission pending, approves it, or
   rejects it. The former separate request-revision outcome, its
   `revision-requested` submission status, and the reject-for-substantial/
   revise-for-minor split are removed; the Moderator states severity in the
   written feedback. Rejection requires actionable reasons. A rejected Author
   may revise and resubmit without limit; every resubmission is a new
   revision, submission, and evidence batch/review cycle. Rejection unlocks
   immediately: rejecting a story-metadata submission clears the story's
   `authoringFrozen` state held for that review and returns the story to
   draft, or to unpublished if it previously had a published version; a
   published story stays published with its old public version live.
   Rejecting a chapter submission returns any non-live chapter to draft,
   including a chapter that was published, then unpublished and revised:
   it stays hidden, keeps its old published version and first-release
   marker, and may be resubmitted. A published chapter stays published
   with its old version live. A chapter decision never clears the story
   freeze, which a metadata review may own,
   and rejection never clears a freeze caused by Author-role removal or
   account deletion. Revise still starts a new editable revision from the
   rejected one but is no longer needed to unblock editing. Approval still
   does not publish by itself, and submissions have no escalation outcome.

Evidence class: user-confirmed target decisions from the requirements interview,
including final payout correction, deleted-account email/closure, chapter-one,
retention and suspension clarifications, and the approve/reject decision
change.
Source narratives/catalogues are traceability evidence, not release proof.

## Proposed technical design (not product policy)

These proposals make confirmed invariants implementable. The domain and MongoDB
phases may accept, revise, or reject proposed field/transaction shapes with
rationale, without reopening confirmed business rules.

- **Revision identity:** represent an immutable content-revision identity and
  make each submission, analysis stage, evidence set, decision, and history
  record reference that identity. Do not overwrite a prior revision or reuse
  its analysis for a new revision.
- **Publication binding:** keep draft/current projections separate from an
  explicit `publishedRevisionId` on story and chapter records. Public reads,
  access, TTS, and saved-position resume resolve through that binding. A
  publication transition records actor, preconditions, result, failure, and
  timestamp; requested release is optional at submission. Late approval makes
  release due; a guarded scheduler cascades through due chapters whose prior
  chapter has a `firstReleasedAt` marker. First-release order and parent
  visibility remain guards; later unpublishing a prior chapter is not a
  sequential blocker. Absent a requested time, the Author schedules or
  publishes after approval. Role-removal cancellation prevents release.
- **Submitted package freeze:** freeze submitted revision content structure,
  rights facts, and media-reference metadata/checksum/availability digest.
  Submitted facts are immutable; unavailable assets are tombstones. Rights
  are declared per story submission.
- **Validated AST and theme fields:** the block editor accepts paragraph,
  heading, bold/italic, scene break, and image blocks and stores a canonical
  AST. Reject raw HTML/CSS, arbitrary styles, Markdown input, and unsupported
  media. Platform themes and four bounded custom tokens (accent color, font
  family, heading/divider presets, cover/banner image) are proposed fields;
  published theme versions remain immutable. Alt text is optional.
- **Stage claims and completion:** create a deterministic attempt key and
  lease/claim before each external stage call. Completion uses compare-and-set
  against the claim and batch version. Pending, retryable, terminal/manual,
  and available outcomes are distinct; comparison failure or stale claims
  make LLM invocation impossible.
- **Decision authorization and queue claims:** a Moderator decision guard
  includes evidence batch identity/version, an allowed terminal state, and
  active authorization epoch. A claimed queue item is unavailable to other
  Moderators; the confirmed claim expiry defaults to 24 hours and is
  Admin-configurable.
- **Credential and linking safety:** the password is embedded in `accounts`
  as a hash only (never plaintext), excluded from normal reads (`select: false`)
  and absent for Google-only accounts; a separate credential collection was
  rejected because each account has at most one password; local email/password login requires verified
  email. Email verification and password reset share one `emailTokens` collection
  (`purpose: email-verification | password-reset`): each emailed token is stored
  only as a hash, expires, is single-use, and a new token revokes older unused
  tokens of the same purpose. Verification activates the account; a reset sets
  the new password hash and increments `credentialVersion`, signing out all
  sessions. Google linking matches
  the existing account email; provider-subject uniqueness is enforced with
  compare-and-set and does not reintroduce the superseded prohibition.
- **Typed finance records:** wallets and ledger entries carry explicit
  immutable purpose, type, and unit. VND receipts/order amounts are external
  payment metadata, not wallets; Reader coins and Author/system earnings are
  distinct coin-purpose wallets. Unlock commits effective price/access
  and negotiated allocation snapshots under compare-and-set. Reader coins
  never expire; Admin coin additions/removals are audited append-only
  adjustments with mandatory reasons.
- **Durable secondary work:** committed business results emit transactional
  source-event-keyed notification/outbox intents; delivery is asynchronous
  and idempotent. Reports freeze target revision snapshot/hash and mark
  unavailable content rather than retargeting. PDF metadata points only to
  extracted drafts; Author statistics use a proposed event/projection for
  confirmed V1 metrics without becoming entitlement or finance truth.
- **Revocation and revision behavior:** suspended Authors cannot log in or
  submit and stories hide. Future monthly evaluations pause; existing payouts
  remain payable. Suspended Moderators/Admins release claims to the shared queue;
  past decisions remain. Removing the Author role leaves published stories
  live and earning, freezes them against Author edits/unpublishing, and
  continues allocation and withdrawals; Admin/Moderator may unpublish.
  Role removal increments the authorization epoch and cancels all unreleased
  work. Only Admin may directly fix/republish former-Author content, audited,
  without Moderator/AI review. An account's Author history bars Moderator grant.
  Resume-on-revision opens the same chapter from the start with a
  content-updated notice. TTS is generated on first request and cached by
  chapter revision and the single default Vietnamese voice.
- **State transitions:** model submission/publication state separately from
  embedding, comparison, and LLM processing state. Include explicit pending,
  unavailable, and reported-failure stage outcomes so manual fallback is
  representable without a fake “clean” result.
- **Idempotency:** use unique SePay transaction IDs and scoped
  operation/entitlement identity. Duplicate webhook delivery is a no-op;
  already-paid code reuse is a new exception receipt, not a second credit.
  Payout-result keys identify entries, allowing Failed entries then one Paid.
- **Financial history:** keep append-only transaction/allocation/adjustment
  records beside derived balances. Store the effective negotiated policy
  reference/rate with each allocation, falling back to the confirmed
  configurable 70% Author/30% platform default; round the Author share down.
- **Atomic decisions and queue claims:** enforce current revision, pending
  state, authority, decision/history, and status transition in one consistency
  boundary. Claimed review items are unavailable to other Moderators until
   configurable expiry (default 24 hours), then release automatically.
- **Monthly withdrawal identity:** retain `withdrawalRequests` as
  system-generated records. Proposed records capture period, threshold,
  evaluated balance, timestamp, bank snapshot, and policy version. The
  default threshold is 100,000 coins and remains Admin-configurable; complete
  (not externally verified) bank details are required. Paid rows appear in
  earnings history and are emailed. Admin always records support-supplied
  corrected details on a pending row, audited and Admin-only, without rewriting
  evaluation facts; profile updates affect future evaluations only. Failed
  stays pending. Missing-bank skips emit a per-Author/period outbox intent,
  not a withdrawal; below-threshold skips emit no notification. Deletion stops
  future earnings and forces one final threshold-free balance payout on the
  next sheet; financial closure and retained-email removal occur after the final deletion evaluation has run, no unpaid earnings balance remains, and every withdrawal for the account is Paid. If deletion finds no unpaid earnings balance and no
  pending withdrawal, close and remove the email immediately in the deletion
  transaction. The retained Admin-only email receives withdrawal-created,
  Failed, and Paid-slip emails and is then removed.
  Allocation rounds down and the platform receives the remainder.
- **Authorization boundary:** represent Reader plus at most one additional
  staff role; Author and Moderator are mutually exclusive, and historical
  Author role permanently bars Moderator assignment. Separate
  role-assignment records retain history.
- **Polymorphic targets and comments:** represent confirmed story/chapter
  comment and story/chapter/comment report targets. Keep hidden/deleted
  comments for audit, with one-level replies and likes; soft deletion is
  preferred over physical deletion.
- **Retention:** V1 keeps moderation evidence, audit, finance, notification,
  and media records forever. Do not add TTL or automatic deletion.
   Public anonymization does not redact finance/payout bank snapshots or
   legal/account-holder names. The evaluation snapshot is visible to Author
   and Admin while active, Admin-only after deletion; corrected details are
   always Admin-only. Deletion forfeiture is a ledger entry, not expiry. The
   deleted Author's email is the retention exception: Admin-only until financial closure; send withdrawal-created, Failed, and Paid-slip emails,
   then remove it, not retain it forever. If deletion finds no unpaid earnings
   balance and no pending withdrawal, close and remove the email immediately in
   the deletion transaction.

## Deferred technical selection and process gates

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

| Remaining item | Owner | Gate and safe treatment |
|---|---|---|
| TTS provider selection | Database/integration (member TBD) | Integration design acceptance; provider-neutral adapter preserves confirmed access/cache/voice/failure rules. |
| Team acceptance/process gates | Integration/review (member TBD), with all five lanes | Explicit baseline/domain/database review and freeze; draft status is not approval. |
| Local tooling prerequisites | Integration/review (member TBD) | Agreed local entry points and replica-set-capable MongoDB before transaction-dependent work; no guessed commands or downgraded invariants. |

## Reconciliation notes

- The canonical use-case catalogue is goal-based: `UC-GST-*`, `UC-RDR-*`,
  `UC-AUT-*`, `UC-MOD-*`, and `UC-ADM-*`. It preserves gaps and resolves
  draft collisions by goal; no replacement ID convention is introduced.
- Draft unprefixed Guest/Reader IDs map to the catalogue's Guest/Reader goals;
  the conflicting draft Author/Moderator/Admin numbers are not reused. The
  accepted goal anchors include `UC-AUT-10` (submit), `UC-MOD-02` (review),
  `UC-MOD-03` (decide), and `UC-ADM-09` (system revenue), rather than their
  differently numbered draft counterparts.
- Source wording that treats 70/30 as either a universal fixed rate or as stale
  is superseded:
  the confirmed default is configurable 70% Author/30% platform when no
  negotiated per-Author rate exists, with the Author share rounded down.
  Negotiated rates override the default; current records retain the effective
  negotiated/default policy snapshot rather than assuming a universal rate.
- The owner's payout-sheet correction supersedes manual-request
  prerequisites, provider-payout assumptions, and open-frequency/threshold
  wording in `SRS.md`, `SRS-mismatches.md`,
  `novelhub_requirements_spec.md` (`FR-PAYOUT-03`, `FR-PAYOUT-04`, `BR-10`)
  and `use-case-list.md` (`UC-AUT-13`). Existing IDs remain traceability
  anchors, not authority for the superseded wording. The fixed run is the 1st
  at 00:00 `Asia/Ho_Chi_Minh`; SePay is top-up only, while Admin records
  external payout-sheet results. Author-access application approval remains a
  separate Admin governance flow.
- The mandatory moderation order, exact revision lineage, empty-discovery-to-
  LLM rule, manual fallback, and no-rerun viewing rule override simplified or
  binary legacy approval diagrams.
- `novelhub_requirements_spec.md` (`FR-MEDIA-01`, provider boundary),
  `use-case-list.md` (storage association with `UC-AUT-05`), and `SRS.md`
  (media management/provider and import dependency) still describe retained
  source PDFs. The confirmed PDF non-retention decision overrides that wording;
  upload in `FR-AUTHOR-09` means transient extraction input for `UC-AUT-05`,
  not source object storage. These external source documents remain unchanged.
- `novelhub_requirements_spec.md` (`FR-GUEST-09`, `FR-GUEST-10`) and
  `use-case-list.md` (`UC-GST-10`, `UC-GST-11`) allow broader Guest reading/TTS.
  Confirmed chapter-one-only preview/free access and logged-in-only TTS override
  them. The IDs remain historical goal anchors, not shipped Guest capabilities.
- `SRS.md`, `novelhub_requirements_spec.md` (`FR-COIN-02`, external boundary)
  and `use-case-list.md` (`UC-RDR-14`, external actors) describe a SePay gateway.
  Confirmed NovelHub-owned orders/invoice/payment page, VietQR and authenticated
  incoming webhook matching supersede checkout and payout assumptions.
- `novelhub_requirements_spec.md` (`FR-AUTHOR-08`, `FR-AUTHOR-12`,
  `FR-AUTHOR-14`) and `use-case-list.md` (`UC-AUT-06`, `UC-AUT-07`) retain
  conditional video/OCR and broader rights categories. V1 uses text/images,
  no OCR, and original/licensed per-story declarations only.
- `SRS.md` preference/AI-assistance/statistics/retention gaps and
  `SRS-mismatches.md` earlier open-policy lists are superseded by the confirmed
  interview contract. Neither creates a new scope gate. Source evidence files
  are intentionally unchanged.
- Requirement numbering gaps are preserved as well as UC gaps: no
  `FR-PAYOUT-05`–`FR-PAYOUT-08` or `FR-ADMIN-08` is invented by a range.

## Review notes

The earlier independent review outcome was **safe to show as a draft, unsafe
to implement**. Its publication/lineage, evidence/CAS, identity, finance,
outbox/report and import/statistics concerns have proposed controls in Phases
2–5; they still need team design acceptance and later implementation evidence.
This historical review is not a new business-policy gate or a release claim.
