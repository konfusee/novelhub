---
phase: 1
title: "Phase 1: Review lifecycle and moderator decision API"
status: completed
priority: P1
effort: 13h
dependencies: []
---

# Phase 1: Review lifecycle and moderator decision API

## Goal

A moderator can list the review queue, claim and release a submission, read the exact submitted package with its stored evidence and history, and approve or reject it through `/api/moderator/*`. Approval leaves the existing release gates satisfiable. Rejection creates a fresh editable draft in the same transaction and unlocks the author according to freeze provenance. Every decision writes `ModerationHistory`, `AuditEvent` and an in-app `Notification`. The legacy AI-deferred release bypass is removed.

All paths below are relative to `novelhub/`. Run every command from the stated working directory.

## Context Links

- Authoritative design: [design decisions](./reports/design-decisions.md) sections "Submission lifecycle", "Decision transaction" and "Moderator API".
- Evidence: [backend scout](./reports/scout-backend-moderation.md) sections 2-8.
- Red team: [red-team findings](./reports/red-team-findings.md) groups 5, 8, 11 and 14.
- Plan overview and executor rules: [plan](./plan.md).

## Key Insights

- `submitContent` creates the submission as `validated` with an `EvidenceBatch{stage:'embedding',status:'pending'}` and, for a story, sets `authoringFrozen = true` and `publicationStatus = 'submitted'` unless already `published` (`backend/src/modules/author-submissions.js:336-372`). Nothing in `src` writes `pending-review`, `decision-pending`, `approved` or `rejected` today.
- The queue counters already count `pending-review` (`backend/src/modules/admin-dashboard.js:53-55`, `backend/src/routes/workspace-data.routes.js:232-234`); they stay unchanged.
- `PublicationSubmission` has the claim fields and the queue index `{status, claimExpiresAt, submittedAt}` (`backend/src/models/review/publication-submission.model.js:22-25,32`). The cancel paths show the claim-release history entry shape `{ownerAccountId, claimVersion, expiresAt, releasedAt, reason, actorAccountId}` (`backend/src/modules/author-access/revocation.js:161-172`, `backend/src/modules/admin-close-author-account.js:111-122`).
- <!-- Red Team: group 11 --> `lockAccount` (CAS on `status`, `authorizationEpoch`, `credentialVersion`, `$inc version`, 409 `account_changed`) stays private (`backend/src/modules/author-access/service.js:23-36`); this plan copies its CAS into `lockModerator` instead of exporting it. `lockAuthor(account, session)` (`backend/src/modules/author-ownership.js:4-21`) already locks an author with the same CAS plus an active author role check and throws 403 `forbidden`; the decision reuses it. `decideApplication` is the reference for an audited decision with a notification (`backend/src/modules/author-access/service.js:102-169`).
- <!-- Red Team: group 11 --> `loadSubmittedPackage(account, submissionId, session)` filters by `authorAccountId: account._id` and `ownStory`, then re-checks revision, rights and every digest (`backend/src/modules/author-submitted-package.js:36-156`); `submittedImage(config, account, submissionId, mediaId)` loads through it and verifies size and checksum (`:187-214`). Passing `{ _id: submission.authorAccountId }` as the owner gives moderators the same integrity checks without refactoring that file.
- `reviseSubmission` clones a revision at `backend/src/modules/author-submissions.js:545-577` and already replays when the current draft's `parentRevisionId` equals the submission revision (`:530-541`). `submissionList.canRevise` is `status === 'rejected' || canReviseUnpublished(...)` (`:462-469`), which is true even when revise would 409 (for example a chapter while the story is frozen, `:506-507`).
- `approvedReviewEvidence` accepts a pending batch plus a `ModerationHistory` row with `correlationId: 'manual-review-ai-deferred-v1'` (`backend/src/modules/review-evidence.js:10-24`). Its only callers are `backend/src/modules/author-story-release.js:63` and `backend/src/modules/author-chapter-release.js:125`. No test references the legacy correlation id.
- Release gates require `submission.status === 'approved'`, revision `approved|immutable`, a terminal batch, and for stories `!authoringFrozen` with status `approved|published|unpublished` (`backend/src/modules/author-story-release.js:15-30,70-90`).
- `notificationView` already maps `publication.decided` to href `/author/submissions`, but builds its title from `payload.title` and its description from `payload.body || payload.reason` (`backend/src/routes/reader-data.routes.js:42-94`), so a decision payload `{title, outcome, feedback}` would render without the outcome or feedback.
- Routers are mounted in `backend/src/app.js:62-76`, before `notFound` at `:77`. CSRF requires an `Origin` header on cookie-bearing writes (`backend/src/middleware/csrf.js`), so tests send `.set('Origin', origin)`.
- `requireRole` checks roles from active `RoleAssignment` rows (`backend/src/middleware/auth.js:18-29`); the decision transaction must still re-check the moderator role (`backend/src/modules/author-access/service.js:105-110` pattern).
- Test conventions: `useTestDatabase()` (`backend/test/db.js:9-27`), `authenticatedAccount(role)` (`backend/test/fixtures/accounts.js:6-20`), `testConfig` built from `.env.example` (`backend/test/config.js:4-9`), supertest with `Cookie` and `Origin` (`backend/test/author-submissions.test.js:20-23`). Story and chapter creation go through `POST /api/author/stories` and `POST /api/author/stories/:storyId/chapters` (`backend/src/routes/author-content.routes.js:301,577`). `Category.normalizedName` is unique (`backend/src/models/governance/category.model.js:14`).

## Files to Create / Modify / Delete

<!-- Red Team: group 11 -->
| Action | Path | Purpose |
|---|---|---|
| Modify | `backend/src/config/env.js` | Add `MODERATION_CLAIM_HOURS` (schema, blank-strip list, `toAppConfig.moderationClaimHours`). |
| Modify | `backend/.env.example` | Add section 11 with `MODERATION_CLAIM_HOURS=24`. |
| Create | `backend/src/modules/moderation/moderator-access.js` | `lockModerator(account, session)`, `lockSubmissionAuthor(authorAccountId, session)`. |
| Delete | `backend/src/modules/moderation/.gitkeep` | Directory now holds real modules. |
| Modify | `backend/src/modules/review-evidence.js` | Delete `approvedReviewEvidence`; keep `terminalEvidenceReady`. |
| Modify | `backend/src/modules/author-story-release.js` | Call `terminalEvidenceReady(batch)`. |
| Modify | `backend/src/modules/author-chapter-release.js` | Call `terminalEvidenceReady(batch)`. |
| Modify | `backend/src/modules/author-submissions.js` | Export `createEditableRevision` and `canReviseRejected`; use them in `reviseSubmission` and `submissionList`. |
| Create | `backend/src/modules/moderation/review-queue.js` | Summary, queue lists, claim, release, decision history. |
| Create | `backend/src/modules/moderation/review-detail.js` | `loadModeratorPackage`, `moderatorSubmittedImage` (Task 1.3) and `moderatorSubmissionDetail` (Task 1.7). |
| Create | `backend/src/modules/moderation/review-decision.js` | `decideSubmission` transaction. |
| Modify | `backend/src/routes/reader-data.routes.js` | Render `publication.decided` notifications. |
| Create | `backend/src/routes/moderator.routes.js` | `/moderator/*` endpoints. |
| Modify | `backend/src/app.js` | Mount the moderator router before `notFound`. |
| Modify | `backend/src/models/review/moderation-history.model.js` | Add index `{ action: 1, occurredAt: -1 }`. |
| Create | `backend/test/fixtures/submissions.js` | Shared API fixtures for submissions, evidence readiness and decisions. |
| Create | `backend/test/moderation-review.test.js` | Queue, claim, release, detail, decision-history tests. |
| Create | `backend/test/moderation-decision.test.js` | Decision transaction tests. |
| Modify | `backend/test/author-media.test.js` | Add the moderator image access test. |

## Tasks

### Task 1.1 — Add the claim TTL configuration

- **Goal:** `testConfig().moderationClaimHours` is `24` and a blank or missing `MODERATION_CLAIM_HOURS` falls back to 24.
- **Target files and symbols:** `backend/src/config/env.js` (`envSchema` lines 4-67, `loadEnv` blank-strip list lines 75-89, `toAppConfig` lines 115-148); `backend/.env.example` (end of file, after line 80).
- **Steps:**
  1. In `envSchema`, after `GOOGLE_REDIRECT_URI` (line 66), add `MODERATION_CLAIM_HOURS: z.coerce.number().int().min(1).max(168).default(24),`.
  2. Add `'MODERATION_CLAIM_HOURS',` to the key array in `loadEnv` (lines 75-89) so an empty string is deleted before parsing.
  3. In `toAppConfig`, after `mediaStorageDir: env.MEDIA_STORAGE_DIR,` (line 125), add `moderationClaimHours: env.MODERATION_CLAIM_HOURS,`.
  4. Append to `backend/.env.example`, after the existing last line, one blank line and then exactly:
     ```
     # ==================== 11. Kiểm duyệt và bằng chứng AI ====================
     # MODERATION_CLAIM_HOURS: số giờ kiểm duyệt viên giữ hồ sơ; hết hạn thì hồ sơ quay lại hàng đợi.
     MODERATION_CLAIM_HOURS=24
     ```
- **Success criteria:** `loadEnv` accepts `MODERATION_CLAIM_HOURS=''` and returns 24; `toAppConfig` exposes `moderationClaimHours`.
- **Verify:** no verification needed (Task 1.12 test "defaults the claim TTL to 24 hours from .env.example" covers it).

### Task 1.2 — Moderator and author lock helpers

<!-- Red Team: group 11 -->
- **Goal:** one helper locks the moderator account row and re-checks the active moderator role inside a transaction; one helper locks the submitting author through the existing `lockAuthor` and reports 409 `author_unavailable`. No existing module is refactored or re-exported.
- **Target files and symbols:** new `backend/src/modules/moderation/moderator-access.js` (`lockModerator`, `lockSubmissionAuthor`); `lockAuthor` in `backend/src/modules/author-ownership.js:4-21` (unchanged); delete `backend/src/modules/moderation/.gitkeep`.
- **Steps:**
  1. Create `backend/src/modules/moderation/moderator-access.js`:
     ```js
     import { HttpError } from '../../middleware/errors.js'
     import { Account, RoleAssignment } from '../../models/index.js'
     import { lockAuthor } from '../author-ownership.js'

     // Serializes a moderator write with role or epoch changes on the same account.
     // Same CAS as the private lockAccount in author-access/service.js.
     export async function lockModerator(account, session) {
       const locked = await Account.findOneAndUpdate(
         {
           _id: account._id,
           status: 'active',
           authorizationEpoch: account.authorizationEpoch,
           credentialVersion: account.credentialVersion,
         },
         { $inc: { version: 1 } },
         { session, returnDocument: 'after' },
       )
       if (!locked) throw new HttpError(409, 'account_changed', 'Quyền tài khoản vừa thay đổi. Hãy tải lại.')
       const allowed = await RoleAssignment.exists({
         accountId: account._id,
         role: 'moderator',
         status: 'active',
       }).session(session)
       if (!allowed) throw new HttpError(403, 'forbidden', 'Quyền kiểm duyệt không còn hiệu lực.')
       return locked
     }

     // Locks the submitting author with the author flows' own lock.
     // For a moderator, an inactive author is a conflict, not a permission error.
     export async function lockSubmissionAuthor(authorAccountId, session) {
       const author = await Account.findById(authorAccountId)
         .select('status authorizationEpoch credentialVersion')
         .session(session)
         .lean()
       try {
         if (!author) throw new HttpError(403, 'forbidden', 'Không tìm thấy tác giả.')
         await lockAuthor(author, session)
       } catch (error) {
         if (error instanceof HttpError && error.status === 403)
           throw new HttpError(409, 'author_unavailable', 'Tài khoản tác giả không còn hoạt động.')
         throw error
       }
       return author
     }
     ```
  2. Delete `backend/src/modules/moderation/.gitkeep`.
- **Success criteria:** no file outside `backend/src/modules/moderation/` changes; `lockAccount` stays private.
- **Verify:** from `novelhub/backend` run `npx eslint src/modules/moderation`. Pass: exit code 0 and no output.

### Task 1.3 — Moderator package and image access through the existing loaders

<!-- Red Team: group 11 -->
- **Goal:** moderators read the exact submitted package and its images through the unchanged `loadSubmittedPackage` and `submittedImage`, by passing the submission's author as the owner.
- **Target files and symbols:** create `backend/src/modules/moderation/review-detail.js` exporting `loadModeratorPackage` and `moderatorSubmittedImage` (Task 1.7 adds `moderatorSubmissionDetail` to the same file); `loadSubmittedPackage` (`backend/src/modules/author-submitted-package.js:36-156`) and `submittedImage` (`:187-214`) stay unchanged.
- **Steps:**
  1. Create `backend/src/modules/moderation/review-detail.js` starting with:
     ```js
     import { HttpError } from '../../middleware/errors.js'
     import { PublicationSubmission } from '../../models/index.js'
     import { loadSubmittedPackage, submittedImage } from '../author-submitted-package.js'

     async function submissionOwner(submissionId, session) {
       const submission = await PublicationSubmission.findById(submissionId)
         .select('authorAccountId')
         .session(session ?? null)
         .lean()
       if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy gói đã gửi.')
       return { _id: submission.authorAccountId }
     }

     // The owner-scoped loader re-checks story ownership, revision, rights and every digest.
     export async function loadModeratorPackage(submissionId, session) {
       return loadSubmittedPackage(await submissionOwner(submissionId, session), submissionId, session)
     }

     export async function moderatorSubmittedImage(config, submissionId, mediaId) {
       return submittedImage(config, await submissionOwner(submissionId), submissionId, mediaId)
     }
     ```
- **Success criteria:** `backend/src/modules/author-submitted-package.js` is unchanged; both functions are exported.
- **Verify:** from `novelhub/backend` run `npx eslint src/modules/moderation`. Pass: exit code 0 and no output.

### Task 1.4 — Remove the legacy AI-deferred release bypass

- **Goal:** release requires a terminal evidence batch; a `manual-review-ai-deferred-v1` history row no longer satisfies the evidence gate.
- **Target files and symbols:** `backend/src/modules/review-evidence.js` (lines 1 and 10-24); `backend/src/modules/author-story-release.js` (lines 13, 63); `backend/src/modules/author-chapter-release.js` (lines 16, 125).
- **Steps:**
  1. In `review-evidence.js`, delete the `ModerationHistory` import (line 1) and the whole `approvedReviewEvidence` function with its comment (lines 10-24). The file keeps only `export function terminalEvidenceReady(batch)`.
  2. In `author-story-release.js`, change line 13 to `import { terminalEvidenceReady } from './review-evidence.js'` and line 63 to `const evidenceReady = terminalEvidenceReady(batch)`.
  3. In `author-chapter-release.js`, make the same two changes on lines 16 and 125.
- **Success criteria:** no file in `backend` references `approvedReviewEvidence`.
- **Verify:** (a) from `novelhub` run `git grep -n approvedReviewEvidence -- backend`. Pass: exit code 1 and no output. (b) From `novelhub/backend` run `npx vitest run test/author-story-release.test.js test/author-chapter-release.test.js test/author-published-images.test.js test/author-story-unpublish.test.js`. Pass: exit code 0 and output contains `Test Files  4 passed (4)`.

### Task 1.5 — Shared editable-revision helper and an honest `canRevise`

- **Goal:** the decision transaction and `reviseSubmission` create the next editable revision with one helper, and the author list shows `canRevise: true` only when revise would succeed.
- **Target files and symbols:** `backend/src/modules/author-submissions.js` (`submissionList` lines 410-486, `reviseSubmission` lines 489-633); new exports `createEditableRevision`, `canReviseRejected`.
- **Steps:**
  1. Add, above `reviseSubmission`:
     ```js
     /** Clones a frozen revision into the next editable revision of the same target. */
     export async function createEditableRevision({ current, storyId, chapterId, authorAccountId, session }) {
       const last = await ContentRevision.findOne({
         storyId,
         contentType: current.contentType,
         chapterId: chapterId ?? null,
       })
         .sort({ revisionNumber: -1 })
         .session(session)
       const [revision] = await ContentRevision.create(
         [
           {
             contentType: current.contentType,
             storyId,
             ...(chapterId ? { chapterId } : {}),
             authorAccountId,
             parentRevisionId: current._id,
             revisionNumber: (last?.revisionNumber ?? 0) + 1,
             content: structuredClone(current.content),
             formatVersion: current.formatVersion,
             mediaIds: current.mediaIds,
             // then the blocks-v3 spread and the altText spread copied verbatim from current lines 564-573
           },
         ],
         { session },
       )
       return revision
     }
     ```
     Copy the `...(current.formatVersion === 'blocks-v3' ? {...} : {})` and `...(current.altText ? { altText: current.altText } : {})` spreads verbatim from current lines 564-573 in place of the comment.
  2. In `reviseSubmission`, replace current lines 545-577 (the `last` lookup and `ContentRevision.create`) with:
     ```js
     const revision = await createEditableRevision({
       current,
       storyId: story._id,
       chapterId: submission.chapterId ? target._id : null,
       authorAccountId: account._id,
       session,
     })
     ```
     Keep everything from current line 578 onward unchanged.
  3. Add, below `canReviseUnpublished`:
     ```js
     // Mirrors the reviseSubmission guards for a rejected package (create or replay).
     export function canReviseRejected(submission, target, current, story) {
       if (submission.status !== 'rejected' || !target || !current) return false
       if (story.publicationStatus === 'archived') return false
       if (submission.chapterId && story.authoringFrozen) return false
       if (['archived', 'cancelled', 'scheduled', 'due'].includes(target.status)) return false
       const replay =
         String(current.parentRevisionId) === String(submission.revisionId) &&
         current.status === 'editable' &&
         !current.immutableAt
       const create = String(current._id) === String(submission.revisionId) && Boolean(current.immutableAt)
       return replay || create
     }
     ```
  4. In `submissionList`:
     - change the stories `.select('title authoringFrozen publicationStatus')` (line 421) to `.select('title authoringFrozen publicationStatus draftRevisionId currentRevisionId')`;
     - after the `chapters` query (line 435), add `const targetOf = item => item.chapterId ? chapters.find(c => c._id.equals(item.chapterId)) : stories.find(s => s._id.equals(item.storyId))` and `const currents = await ContentRevision.find({ _id: { $in: items.map(targetOf).filter(Boolean).map(t => t.draftRevisionId ?? t.currentRevisionId).filter(Boolean) }, authorAccountId: account._id }).select('parentRevisionId status immutableAt').lean()`;
     - inside the `items.map(item => { ... })` callback (line 452), after `const batch = ...` (line 454), add `const target = targetOf(item)` and `const current = target ? currents.find(row => row._id.equals(target.draftRevisionId ?? target.currentRevisionId)) : undefined`;
     - replace `item.status === 'rejected' ||` (line 463) with `canReviseRejected(item, target, current, stories.find(story => story._id.equals(item.storyId)) ?? {}) ||`. Keep the `canReviseUnpublished(...)` operand unchanged.
- **Success criteria:** existing revise and resubmission tests still pass; `canRevise` is false for a rejected chapter while its story is frozen.
- **Verify:** from `novelhub/backend` run `npx vitest run test/author-submissions.test.js test/author-media.test.js test/author-chapter-release.test.js test/author-published-images.test.js`. Pass: exit code 0 and output contains `Test Files  4 passed (4)`.

### Task 1.6 — Queue, claim, release and decision-history module

- **Goal:** pure module functions implement the lifecycle rules for listing, claiming and releasing.
- **Target files and symbols:** create `backend/src/modules/moderation/review-queue.js` exporting `PAGE_SIZE`, `startOfVietnamDay`, `claimView`, `evidenceSummaries`, `moderatorSummary`, `listModeratorSubmissions`, `claimSubmission`, `releaseSubmission`, `listModeratorDecisions`.
- **Steps:**
  1. Imports: `withTransaction` from `../../db/connection.js`; `HttpError` from `../../middleware/errors.js`; `Account, ContentRevision, EvidenceBatch, LlmReview, ModerationHistory, PublicationSubmission, SimilarityFinding, Story` from `../../models/index.js`; `terminalEvidenceReady` from `../review-evidence.js`; `lockModerator` from `./moderator-access.js`.
  2. `export const PAGE_SIZE = 20`.
  3. `export function startOfVietnamDay(now)`: `const shifted = new Date(now.getTime() + 7 * 3600000)` then `return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 7 * 3600000)` (Asia/Ho_Chi_Minh is UTC+7 without DST). [UNVERIFIED: the design doc does not name the timezone for "decided today"; Vietnam time is assumed for this Vietnamese-language product.]
  4. Filters (module-private): `queueFilter(now) = { $or: [{ status: 'pending-review' }, { status: 'decision-pending', claimExpiresAt: { $lte: now } }] }`; `mineFilter(account, now) = { status: 'decision-pending', claimOwnerAccountId: account._id, claimExpiresAt: { $gt: now } }`; `processingFilter = { status: 'validated' }`. <!-- Red Team: group 8 --> Add `async function activeAuthorScope()` returning `{ authorAccountId: { $nin: await Account.distinct('_id', { status: { $ne: 'active' } }) } }`; every count and list in steps 7 and 8 uses `{ ...filter, ...(await activeAuthorScope()) }`, so submissions of suspended, closed or otherwise inactive authors are neither listed nor counted. The admin dashboard counters (`backend/src/modules/admin-dashboard.js:53-55`) stay unchanged.
  5. `export function claimView(submission, account, now)`: return `null` when `submission.claimOwnerAccountId` is empty; otherwise `{ ownerAccountId: String(owner), ownedByMe: String(owner) === String(account._id), expiresAt: submission.claimExpiresAt, expired: !(submission.claimExpiresAt > now) }`.
  6. `export async function evidenceSummaries(batchIds)`: load `EvidenceBatch.find({ _id: { $in: batchIds } }).lean()`, `SimilarityFinding.aggregate([{ $match: { batchId: { $in: batchIds } } }, { $group: { _id: '$batchId', count: { $sum: 1 }, maxScore: { $max: '$score' } } }])` and `LlmReview.find({ batchId: { $in: batchIds }, status: 'succeeded' }).select('batchId').lean()`. Return a `Map` keyed by `String(batch._id)` with `{ batchId: String, batchVersion: batch.version, status, stage: batch.stage ?? null, failedStage: batch.failedStage ?? null, findingsCount: count ?? 0, maxScore: maxScore ?? null, llmStatus }` where `llmStatus` is `'succeeded'` if a succeeded review exists, `'failed'` if `status === 'failed' && failedStage === 'llm'`, `'skipped'` if `status === 'failed'` with another stage, otherwise `'pending'`.
  7. `export async function moderatorSummary(account, now = new Date())` returns `{ queue, mine, processing, decidedToday }`: the first three are `PublicationSubmission.countDocuments({ ...filter, ...scope })` with `scope = await activeAuthorScope()`; `decidedToday` is `ModerationHistory.countDocuments({ action: 'manual-review.decided', actorAccountId: account._id, occurredAt: { $gte: startOfVietnamDay(now) } })`.
  8. `export async function listModeratorSubmissions(account, { view, page }, now = new Date())`: pick the filter by `view` (`queue|mine|processing`); `total = countDocuments(filter)`; rows `find(filter).sort({ submittedAt: 1, _id: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean()`; batch-load revisions (`select('content.title revisionNumber')`), stories (`select('title')`), authors (`Account ... select('displayName')`) and `evidenceSummaries(rows.map(r => r.currentEvidenceBatchId).filter(Boolean))`. Return `{ items, page, pageSize: PAGE_SIZE, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }` where each item is `{ id, version, status, submittedAt, type: chapterId ? 'chapter' : 'story', storyId, chapterId: String or null, title: revision?.content?.title ?? '', storyTitle: story?.title ?? '', revisionNumber: revision?.revisionNumber ?? null, author: { id, displayName }, claim: claimView(row, account, now), evidence: summary ?? null }`.
  9. `export async function claimSubmission(account, submissionId, { expectedVersion }, config, now = new Date())` runs `withTransaction(async session => { ... })` with these checks in order:
     1. `await lockModerator(account, session)`.
     2. `PublicationSubmission.findById(submissionId).session(session)`; missing → `HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.')`.
     3. If `status === 'decision-pending'`, the owner is `account._id` and `claimExpiresAt > now`, return `{ id, version, status, claimExpiresAt, replayed: true }` without writing.
     4. If `status === 'validated'` → `HttpError(409, 'evidence_pending', 'AI đang xử lý bằng chứng; chưa thể nhận hồ sơ.')`.
     5. `const expired = status === 'decision-pending' && !(claimExpiresAt > now)`. If `status === 'decision-pending' && !expired` → `HttpError(409, 'claim_held', 'Hồ sơ đang được kiểm duyệt viên khác giữ.')`.
     6. If `status !== 'pending-review' && !expired`, or `version !== expectedVersion` → `HttpError(409, 'submission_changed', 'Hồ sơ đã thay đổi. Hãy tải lại.')`. <!-- Red Team: group 8 --> Then load `Account.findById(submission.authorAccountId).select('status').session(session).lean()`; missing or `status !== 'active'` → `HttpError(409, 'author_unavailable', 'Tài khoản tác giả không còn hoạt động.')`.
     7. Load `EvidenceBatch.findById(submission.currentEvidenceBatchId).session(session).lean()`; if `!terminalEvidenceReady(batch)` → 409 `evidence_pending` (same message as step 4).
     8. If `expired`, push `{ ownerAccountId: submission.claimOwnerAccountId, claimVersion: submission.claimVersion, expiresAt: submission.claimExpiresAt, releasedAt: now, reason: 'expired', actorAccountId: account._id }` to `claimReleaseHistory`.
     9. Set `status = 'decision-pending'`, `claimOwnerAccountId = account._id`, `claimExpiresAt = new Date(now.getTime() + config.moderationClaimHours * 3600000)`, `claimVersion += 1`; `await submission.save({ session })`; return `{ id, version: submission.version, status, claimExpiresAt, replayed: false }`.
  10. <!-- Red Team: group 11 --> `export async function releaseSubmission(account, submissionId, { expectedVersion }, now = new Date())`: `withTransaction`; `lockModerator`; 404 as above; if `status !== 'decision-pending'`, the owner is not `account._id`, or `!(claimExpiresAt > now)` → `HttpError(409, 'claim_required', 'Bạn cần giữ claim còn hạn của hồ sơ này.')` (an expired claim can only be taken over through `claimSubmission`, which records `reason: 'expired'`); if `version !== expectedVersion` → 409 `submission_changed`; push history with `reason: 'released'`; set `status = 'pending-review'`, `claimOwnerAccountId = undefined`, `claimExpiresAt = undefined`, `claimVersion += 1`; save; return `{ id, version, status }`.
  11. `export async function listModeratorDecisions(account, { outcome, scope, page })`: filter `{ action: 'manual-review.decided', ...(outcome === 'all' ? {} : { outcome }), ...(scope === 'mine' ? { actorAccountId: account._id } : {}) }`; sort `{ occurredAt: -1, _id: -1 }`; paginate with `PAGE_SIZE`; batch-load submissions (`select('revisionId chapterId')`), their revisions (`select('content.title')`) and moderator accounts (`select('displayName')`). Item: `{ id, submissionId, revisionId, title, type, outcome, feedback: feedback ?? '', occurredAt, moderator: { id, displayName }, mine: String(actorAccountId) === String(account._id) }`. Return the same page envelope as step 8.
- **Success criteria:** the module lints cleanly; behavior is asserted in Task 1.12.
- **Verify:** from `novelhub/backend` run `npx eslint src/modules/moderation`. Pass: exit code 0 and no output.

### Task 1.7 — Moderator submission detail

- **Goal:** one read-only call returns the exact package, rights, stored evidence, history and the viewer's allowed actions, without starting any AI work.
- **Target files and symbols:** create `backend/src/modules/moderation/review-detail.js` exporting `moderatorSubmissionDetail(account, submissionId, now = new Date())`.
- **Steps:**
  1. <!-- Red Team: group 11 --> `const { submission, revision, rights, parent, manifest, document } = await loadModeratorPackage(submissionId)` (Task 1.3, same file). Errors propagate (404 `not_found`, 409 `package_unavailable`).
  2. Load `author = Account.findById(submission.authorAccountId).select('displayName status').lean()`; `authorActive = author?.status === 'active'` (group 8).
  3. Load `batch = EvidenceBatch.findById(submission.currentEvidenceBatchId).lean()`. When present, also load:
     - `ProcessingAttempt.find({ batchId: batch._id }).sort({ createdAt: 1 }).select('stage status failureCode startedAt finishedAt').lean()`;
     - <!-- Red Team: group 14 --> `SimilarityFinding.find({ batchId: batch._id }).sort({ score: -1, rank: 1 }).limit(50).lean()`, `findingsCount = SimilarityFinding.countDocuments({ batchId: batch._id })`, then `Chapter.find({ _id: { $in: sourceChapterIds } }).select('title storyId').lean()` and `Story.find({ _id: { $in: thoseStoryIds } }).select('title').lean()`; `maxScore = findings[0]?.score ?? null`; `findingsTruncated = findingsCount > findings.length`;
     - `LlmReview.findOne({ batchId: batch._id, status: 'succeeded' }).lean()`.
  4. Load `ModerationHistory.find({ submissionId: submission._id }).sort({ occurredAt: 1, _id: 1 }).select('action outcome feedback occurredAt').lean()`.
  5. <!-- Red Team: group 11 --> Compute `const terminal = terminalEvidenceReady(batch)`, `const claim = claimView(submission, account, now)` (from `./review-queue.js`), `canClaim = terminal && authorActive && (submission.status === 'pending-review' || (submission.status === 'decision-pending' && claim?.expired))`, `canRelease = submission.status === 'decision-pending' && claim?.ownedByMe && !claim.expired`, `canDecide = terminal && submission.status === 'decision-pending' && claim?.ownedByMe && !claim.expired`.
  6. Return:
     ```js
     {
       submission: { id, version, status, submittedAt, decisionSummary: decisionSummary ?? '', type, claim },
       story: { id: String(submission.storyId), title: parent?.content.title ?? revision.content.title },
       author: { id, displayName },
       revision: { id, number: revision.revisionNumber, formatVersion: revision.formatVersion },
       packageDigest: revision.packageDigest,
       rights: rightsFacts(rights),
       media: manifest,
       ...(submission.chapterId ? { chapter: { id: String(submission.chapterId), document } } : { metadata: revision.content }),
       evidence: batch ? {
         batch: { id, version, status, stage: stage ?? null, failedStage: failedStage ?? null, updatedAt },
         // Red Team: group 14
         findingsCount, maxScore, findingsTruncated,
         attempts: [{ stage, status, failureCode: failureCode ?? null, startedAt, finishedAt }],
         findings: [{ id, rank, score, queryPassageId, sourcePassageId, sourceChapterId, sourceChapterTitle, sourceStoryTitle, queryText: matchedSnippets?.[0]?.queryText ?? '', sourceText: matchedSnippets?.[0]?.sourceText ?? '' }],
         llmReview: review ? { status, summary: review.summary ?? '', riskLevel: review.riskLevel ?? null, riskReasons, suggestions, findingAssessments: (review.evidenceRefs ?? []).filter(ref => ref.findingId), droppedIneligibleFindings: (review.evidenceRefs ?? []).find(ref => ref.droppedIneligibleFindings)?.droppedIneligibleFindings ?? [], reviewedChars: review.reviewedChars ?? null, totalChars: review.totalChars ?? null, criteriaVersion: review.criteriaVersion ?? null, completedAt } : null, // Red Team: groups 4 and 5
       } : null,
       history: [{ id, action, outcome: outcome ?? '', feedback: feedback ?? '', occurredAt }],
       actions: { canClaim, canRelease, canDecide },
     }
     ```
     `rightsFacts` comes from `../submission-digests.js`. All ids are strings.
- **Success criteria:** the function never writes; it reads `summary` and `riskLevel` defensively so Phase 02 only adds the model fields.
- **Verify:** from `novelhub/backend` run `npx eslint src/modules/moderation`. Pass: exit code 0 and no output.

### Task 1.8 — Decision transaction

- **Goal:** `decideSubmission` applies the design's decision transaction, steps 1-11, ending with the in-app notification. <!-- Updated: Validation Session 1 - decision e-mail and its outbox row deferred; the transaction writes no NotificationOutbox row -->
- **Target files and symbols:** create `backend/src/modules/moderation/review-decision.js` exporting `decideSubmission(account, submissionId, input, { correlationId, now = new Date() } = {})`. `input` is `{ decision, feedback, expectedVersion, evidenceBatchId, evidenceBatchVersion }`.
- **Steps:** inside one `withTransaction(async session => { ... })`, in this order:
  1. `await lockModerator(account, session)`.
  2. <!-- Red Team: group 11 --> `const submission = await PublicationSubmission.findById(submissionId).session(session)`; missing → 404 `not_found` 'Không tìm thấy hồ sơ.'. Then, in this order: if `['approved', 'rejected', 'cancelled'].includes(submission.status)` → `HttpError(409, 'submission_changed', 'Hồ sơ đã thay đổi. Hãy tải lại.')`; if `submission.status !== 'decision-pending'` (for example `pending-review` or `validated`), the claim owner is not `account._id`, or `!(submission.claimExpiresAt > now)` → `HttpError(409, 'claim_required', 'Bạn cần giữ claim còn hạn của hồ sơ này.')`; if `submission.version !== input.expectedVersion` → 409 `submission_changed` (same message).
  3. `const batch = await EvidenceBatch.findById(submission.currentEvidenceBatchId).session(session).lean()`. Throw `HttpError(409, 'evidence_changed', 'Bằng chứng AI đã thay đổi. Hãy tải lại.')` unless all hold: `String(submission.currentEvidenceBatchId) === input.evidenceBatchId`, `batch`, `batch.version === input.evidenceBatchVersion`, `terminalEvidenceReady(batch)`, `batch.packageDigest === submission.packageDigest`, `String(batch.submissionId) === String(submission._id)`.
  4. <!-- Red Team: group 11 --> `const author = await lockSubmissionAuthor(submission.authorAccountId, session)` (from `./moderator-access.js`). It reuses `lockAuthor` (active account, unchanged epoch and credential version, active author role) and turns its 403 into 409 `author_unavailable`.
  5. Load `story = Story.findOne({ _id: submission.storyId, authorAccountId: submission.authorAccountId }).session(session)`, `target = submission.chapterId ? Chapter.findOne({ _id: submission.chapterId, storyId: submission.storyId }).session(session) : story`, and `revision = ContentRevision.findOne({ _id: submission.revisionId, storyId: submission.storyId, chapterId: submission.chapterId ?? null, status: 'submitted', immutableAt: { $ne: null } }).session(session)`. Throw `HttpError(409, 'content_changed', 'Nội dung đã chuyển sang phiên bản khác.')` unless `story && target && revision && revision.packageDigest === submission.packageDigest && String(target.draftRevisionId ?? target.currentRevisionId) === String(revision._id)`.
  6. `const outcome = input.decision === 'approve' ? 'approved' : 'rejected'`. Approve:
     - `revision.status = 'approved'`; `await revision.save({ session })`;
     - chapter: `if (target.status !== 'published') target.status = 'approved'`; `await target.save({ session })`;
     - story: `story.authoringFrozen = false`; `if (!['published', 'unpublished'].includes(story.publicationStatus)) story.publicationStatus = 'approved'`; `await story.save({ session })`;
     - never assign `publishedRevisionId`, `firstReleasedAt` or anything on `RightsDeclaration`.
  7. Reject:
     - `revision.status = 'rejected'`; `await revision.save({ session })` (`immutableAt` stays);
     - `const draft = await createEditableRevision({ current: revision, storyId: story._id, chapterId: submission.chapterId ?? null, authorAccountId: submission.authorAccountId, session })`; `target.draftRevisionId = draft._id`; `target.currentRevisionId = draft._id`;
     - chapter: `if (target.status !== 'published') target.status = 'draft'`; `await target.save({ session })`; do not load-modify-save `story` for chapter decisions;
     - story: `if (!['author-role-removed', 'account-deleted'].includes(story.publicationTransition?.result)) story.authoringFrozen = false`; `if (story.publicationStatus !== 'published') story.publicationStatus = story.publishedRevisionId ? 'unpublished' : 'draft'`; `await story.save({ session })`.
  8. Push `{ ownerAccountId: submission.claimOwnerAccountId, claimVersion: submission.claimVersion, expiresAt: submission.claimExpiresAt, releasedAt: now, reason: 'decided', actorAccountId: account._id }` to `claimReleaseHistory`; set `claimOwnerAccountId = undefined`, `claimExpiresAt = undefined`, `claimVersion += 1`, `status = outcome`, `decisionSummary = input.feedback || undefined`; `await submission.save({ session })`.
  9. `ModerationHistory.create([{ aggregateType: submission.chapterId ? 'chapter' : 'story', aggregateId: target._id, action: 'manual-review.decided', outcome, submissionId: submission._id, revisionId: revision._id, evidenceBatchId: batch._id, evidenceBatchVersion: batch.version, actorAccountId: account._id, actorAuthorizationEpoch: account.authorizationEpoch, reason: input.feedback || undefined, feedback: input.feedback || undefined, beforeStateDigest: submission.packageDigest, afterStateDigest: digest({ outcome, revisionId: String(revision._id), evidenceBatchVersion: batch.version }), occurredAt: now, correlationId }], { session })`.
  10. `AuditEvent.create([{ actorType: 'account', actorId: account._id, action: 'publication.decided', targetType: 'PublicationSubmission', targetId: submission._id, targetVersion: submission.version, result: outcome, reason: input.feedback || undefined, occurredAt: now, correlationId, dataDigest: submission.packageDigest }], { session })`.
  11. Create the in-app notification:
      ```js
      await Notification.create(
        [
          {
            recipientAccountId: author._id,
            eventType: 'publication.decided',
            sourceEventKey: `publication-submission:${submission._id}:decided`,
            payload: {
              submissionId: String(submission._id),
              storyId: String(submission.storyId),
              chapterId: submission.chapterId ? String(submission.chapterId) : null,
              title: revision.content?.title ?? '',
              outcome,
              feedback: input.feedback ?? '',
            },
            deliveryState: 'available',
          },
        ],
        { session },
      )
      ```
  12. Return `{ id: String(submission._id), version: submission.version, status: outcome, decisionSummary: submission.decisionSummary ?? '' }`.
  Imports: `withTransaction`, `HttpError`, models `AuditEvent, Chapter, ContentRevision, EvidenceBatch, ModerationHistory, Notification, PublicationSubmission, Story` from `../../models/index.js`, `terminalEvidenceReady`, `createEditableRevision` from `../author-submissions.js`, `digest` from `../submission-digests.js`, `lockModerator` and `lockSubmissionAuthor` from `./moderator-access.js`.
- **Success criteria:** every check above maps to the stated status and code; every write passes `{ session }`.
- **Verify:** from `novelhub/backend` run `npx eslint src/modules/moderation`. Pass: exit code 0 and no output.

### Task 1.9 — Render decision notifications

- **Goal:** the author's notification list shows the decision outcome and the feedback for `publication.decided`.
- **Target files and symbols:** `backend/src/routes/reader-data.routes.js` `notificationView` (lines 42-94).
- **Steps:**
  1. After line 44 add `const publication = item.eventType === 'publication.decided'`.
  2. Replace the `title` expression (lines 68-72) with:
     ```js
     const title = publication
       ? `${item.payload?.outcome === 'approved' ? 'Đã duyệt' : 'Cần chỉnh sửa'}: ${text(item.payload?.title, 200) || 'Gói gửi duyệt'}`
       : decided
         ? item.payload?.status === 'approved'
           ? 'Đơn đăng ký tác giả đã được duyệt'
           : 'Đã có kết quả xét duyệt đăng ký tác giả'
         : text(item.payload?.title, 300) || 'Thông báo mới'
     ```
  3. Change the `description` line (73) to `const description = text(item.payload?.body) || text(item.payload?.reason) || text(item.payload?.feedback)`.
  4. Change `status: text(item.payload?.status, 40)` (line 79) to `status: text(item.payload?.status ?? item.payload?.outcome, 40)`.
  5. Change `action: decided` (line 86) to `action: decided || publication`.
- **Success criteria:** a rejected decision notification renders title `Cần chỉnh sửa: <title>`, description = feedback, href `/author/submissions`, action `Xem kết quả`.
- **Verify:** no verification needed (Task 1.13 test "commits exactly one decision under concurrent requests and one notification" asserts the rendered notification).

### Task 1.10 — Moderator router, mounting and history index

- **Goal:** the API exposes the eight moderator endpoints behind `requireAuth` and `requireRole('moderator')`.
- **Target files and symbols:** create `backend/src/routes/moderator.routes.js` (`createModeratorRouter(config)`); `backend/src/app.js` (imports, line 76); `backend/src/models/review/moderation-history.model.js` (after line 25).
- **Steps:**
  1. Create the router with `Router()` from express and zod schemas:
     ```js
     const id = z.string().regex(/^[a-f\d]{24}$/i)
     const versionBody = z.object({ expectedVersion: z.number().int().min(0) }).strict()
     const page = z.coerce.number().int().min(1).max(100000).default(1)
     const listQuery = z.object({ view: z.enum(['queue', 'mine', 'processing']).default('queue'), page }).strict()
     const decisionsQuery = z.object({ outcome: z.enum(['all', 'approved', 'rejected']).default('all'), scope: z.enum(['all', 'mine']).default('all'), page }).strict()
     const decisionBody = z
       .object({
         decision: z.enum(['approve', 'reject']),
         feedback: z.string().trim().max(4000).default(''),
         expectedVersion: z.number().int().min(0),
         evidenceBatchId: id,
         evidenceBatchVersion: z.number().int().min(0),
       })
       .strict()
       .refine(value => value.decision === 'approve' || value.feedback.length > 0, { path: ['feedback'] })
     ```
     and `function parse(schema, value)` that throws `new HttpError(400, 'validation_error', 'Thông tin kiểm duyệt không hợp lệ.')` on failure (same shape as `backend/src/routes/author-submissions.routes.js:39-44`).
  2. `router.use('/moderator', requireAuth(config), requireRole('moderator'))`, then:
     - `GET /moderator/summary` → `res.set('Cache-Control', 'private, no-store').json(await moderatorSummary(req.account))`;
     - `GET /moderator/submissions` → `listModeratorSubmissions(req.account, parse(listQuery, req.query))`;
     - `GET /moderator/submissions/:submissionId` → `moderatorSubmissionDetail(req.account, parse(id, req.params.submissionId))` with `Cache-Control: private, no-store` and `Vary: Cookie`;
     - `GET /moderator/submissions/:submissionId/media/:mediaId/content` → `moderatorSubmittedImage(config, parse(id, ...), parse(id, req.params.mediaId).toLowerCase())` (from `../modules/moderation/review-detail.js`) with the same five headers as `backend/src/routes/author-submissions.routes.js:66-72`;
     - `POST /moderator/submissions/:submissionId/claim` → `res.json({ submission: await claimSubmission(req.account, submissionId, parse(versionBody, req.body), config) })`;
     - `POST /moderator/submissions/:submissionId/release` → `res.json({ submission: await releaseSubmission(req.account, submissionId, parse(versionBody, req.body)) })`;
     - `POST /moderator/submissions/:submissionId/decision` → `res.json({ submission: await decideSubmission(req.account, submissionId, parse(decisionBody, req.body), { correlationId: String(req.id ?? randomUUID()) }) })` with `randomUUID` from `node:crypto`;
     - `GET /moderator/decisions` → `listModeratorDecisions(req.account, parse(decisionsQuery, req.query))`.
     Every handler wraps its body in `try { ... } catch (error) { next(error) }`.
  3. In `backend/src/app.js`, add `import { createModeratorRouter } from './routes/moderator.routes.js'` after line 22 and `app.use('/api', createModeratorRouter(config))` after line 76 (before `app.use(notFound)`).
  4. In `moderation-history.model.js`, after line 25 add `schema.index({ action: 1, occurredAt: -1 })`.
- **Success criteria:** `GET /api/moderator/summary` returns 401 anonymous, 403 for non-moderators and 200 for moderators.
- **Verify:** from `novelhub/backend` run `npm run lint`. Pass: exit code 0 and no ESLint problems printed.

### Task 1.11 — Shared submission fixtures for tests

- **Goal:** tests create real submissions through the author API and reach the moderator states with one call.
- **Target files and symbols:** create `backend/test/fixtures/submissions.js`.
- **Steps:** export these functions (disposable test database only; never load `.env`):
  1. `export const origin = 'http://localhost:5173'`.
  2. `export function apiClient(app)` returning `{ get: (cookie, url) => request(app).get(url).set('Cookie', cookie), write: (cookie, url, body, method = 'post') => request(app)[method](url).set('Cookie', cookie).set('Origin', origin).send(body) }` (`request` from `supertest`).
  3. `export async function submitStory(api, { author, title = 'Truyện chờ kiểm duyệt', description = 'Tóm tắt thật để gửi duyệt.' } = {})`: create `author ??= await authenticatedAccount('author')`; `Category.create({ name: 'Kỳ ảo', normalizedName: 'ky ao ' + crypto.randomUUID(), createdBy: author.account._id })`; `POST /api/author/stories` with `{ title, description, categoryIds: [String(category._id)] }`; `GET /api/author/submissions/prepare?storyId=...`; `POST /api/author/submissions` with `{ storyId, revisionId: prepared.target.revisionId, expectedVersion: prepared.target.version, rights: { basis: 'original', asserted: true, sourceLicenceNote: '' } }`; `expect(sent.status).toBe(201)`; return `{ author, category, storyId, submissionId: sent.body.submission.id }`.
  4. `export async function submitChapter(api, { author, storyId, title = 'Chương chờ kiểm duyệt', paragraphs = ['Nội dung chương thật để kiểm duyệt.'] })`: `POST /api/author/stories/${storyId}/chapters` with `{ title, paragraphs }`, prepare with `chapterId`, submit `{ storyId, chapterId, revisionId, expectedVersion }`; expect 201; return `{ chapterId, submissionId }`.
  5. `export async function markEvidenceReady(submissionId, { failedStage } = {})`: load the submission and its batch; set the batch to `{ status: 'failed', failedStage }` when `failedStage` is given, otherwise `{ status: 'available-for-human-review', stage: 'llm' }`; save the batch; set the submission `status = 'pending-review'` and save; return `{ submission, batch }` as fresh documents. (This simulates the Phase 02 worker's terminal transition.)
  6. `export async function claim(api, moderator, submissionId)`: read the current version with `PublicationSubmission.findById`, `POST /api/moderator/submissions/${submissionId}/claim` with `{ expectedVersion }`; return the response.
  7. `export async function decide(api, moderator, submissionId, { decision = 'approve', feedback = '' } = {})`: reload submission and batch, `POST /api/moderator/submissions/${submissionId}/decision` with `{ decision, feedback, expectedVersion: submission.version, evidenceBatchId: String(batch._id), evidenceBatchVersion: batch.version }`; return the response.
  8. `export async function approvedStory(api, moderator, options)`: `submitStory` → `markEvidenceReady` → `claim` (expect 200) → `decide` approve (expect 200); return the `submitStory` result.
- **Success criteria:** the fixtures import only `supertest`, `vitest` (`expect`), the models and `./accounts.js`.
- **Verify:** no verification needed (Tasks 1.12 and 1.13 exercise every fixture).

### Task 1.12 — Queue, claim, release and detail tests

- **Goal:** consumer-visible tests cover the lifecycle rules outside the decision.
- **Target files and symbols:** create `backend/test/moderation-review.test.js` with `useTestDatabase()`, `afterEach(() => vi.restoreAllMocks())`, `const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))`, `const api = apiClient(app)`.
- **Steps:** write exactly these nine tests: <!-- Red Team: groups 8, 11, 14 -->
  1. `defaults the claim TTL to 24 hours from .env.example`: `expect(testConfig().moderationClaimHours).toBe(24)`.
  2. `rejects anonymous callers with 401 and readers or authors with 403`: `GET /api/moderator/summary` without cookie → 401; reader → 403; author → 403; moderator → 200 with body `{ queue: 0, mine: 0, processing: 0, decidedToday: 0 }`.
  3. `keeps validated submissions in processing and blocks claims until evidence is terminal`: `submitStory`; `GET /api/moderator/submissions?view=processing` lists the id with `status: 'validated'`; `view=queue` returns `items: []`; claim → 409 with `error.code === 'evidence_pending'`; summary `processing` is 1.
  4. `moves a ready submission through queue, claim and release with version CAS`: `markEvidenceReady`; queue item has `evidence` matching `{ status: 'available-for-human-review', stage: 'llm', findingsCount: 0, llmStatus: 'pending' }`; claim with `expectedVersion - 1` → 409 `submission_changed`; claim with the current version → 200, `submission.status === 'decision-pending'` and `claimExpiresAt` within 5 seconds of `Date.now() + 24 * 3600000`; queue empty; `view=mine` lists it with `claim.ownedByMe === true`; summary `{ queue: 0, mine: 1 }`; a second moderator's claim → 409 `claim_held`; the second moderator's release → 409 `claim_required`; the owner's release with the current version → 200 `status: 'pending-review'`; in the database `claimReleaseHistory.at(-1).reason === 'released'`, `claimOwnerAccountId` is undefined and `claimVersion === 2`.
  5. `admits exactly one of two concurrent claims`: two moderators claim the same ready submission in `Promise.all`; sorted statuses equal `[200, 409]`.
  6. `lets another moderator take over an expired claim and records the expiry`: moderator A claims; set `claimExpiresAt = new Date(Date.now() - 1000)` with `PublicationSubmission.updateOne`; queue lists it with `claim.expired === true`; A's release with the current version → 409 `claim_required`; A's `GET /api/moderator/submissions/:id` has `actions.canRelease === false`; moderator B claims with the current version → 200; `claimReleaseHistory[0]` matches `{ reason: 'expired', ownerAccountId: A's id }`; `claimOwnerAccountId` equals B.
  7. `returns the exact package, evidence and history without running AI`: ready story submission; record `ProcessingAttempt.countDocuments()`; `GET /api/moderator/submissions/:id` → 200 with `metadata.title === 'Truyện chờ kiểm duyệt'`, `rights.basis === 'original'`, `evidence.batch.status === 'available-for-human-review'`, `evidence.findingsCount === 0`, `evidence.maxScore === null`, `evidence.findingsTruncated === false`, `history[0].action === 'submitted'`, `actions.canClaim === true`, header `cache-control` equal to `private, no-store`; the attempt count is unchanged; an unknown valid id → 404; `GET /api/moderator/submissions/not-an-id` → 400.
  8. `lists decisions for everyone or only mine with outcome filters`: moderator A approves one ready submission and moderator B rejects another with feedback `Cần sửa phần tóm tắt.` (use `claim` + `decide`); as A, `GET /api/moderator/decisions` → `total: 2`; `?scope=mine` → one item with `outcome: 'approved'` and `mine: true`; `?outcome=rejected` → one item with `feedback: 'Cần sửa phần tóm tắt.'`; A's summary `decidedToday` is 1.
  9. `hides submissions of inactive authors from lists and counts and refuses their claims`: a ready story submission; set the author `status: 'suspended'` with `Account.updateOne`; as a moderator, `view=queue` returns `items: []`, summary `queue` is 0, the detail has `actions.canClaim === false`, and claim with the current version → 409 `author_unavailable`; restore `status: 'active'` → `view=queue` lists the id again and summary `queue` is 1.
- **Success criteria:** all nine tests pass without network access.
- **Verify:** from `novelhub/backend` run `npx vitest run test/moderation-review.test.js`. Pass: exit code 0 and output contains `Test Files  1 passed (1)` and `Tests  9 passed (9)`.

### Task 1.13 — Decision transaction tests

- **Goal:** consumer-visible tests cover state transitions, unlock rules, CAS conflicts, role and claim checks, freeze provenance, notification idempotency and rollback.
- **Target files and symbols:** create `backend/test/moderation-decision.test.js` with the same setup as Task 1.12.
- **Steps:** write exactly these sixteen tests (moderator = `authenticatedAccount('moderator')`; "ready and claimed" means `markEvidenceReady` then `claim` expecting 200):
  1. `approves a story, unfreezes it and leaves the release gates satisfiable`: approve with empty feedback → 200. Database: submission `approved`, `claimOwnerAccountId` undefined, `claimReleaseHistory.at(-1).reason === 'decided'`; revision `approved`; story `authoringFrozen === false`, `publicationStatus === 'approved'`; one `ModerationHistory` with `action: 'manual-review.decided'`, `outcome: 'approved'`, `evidenceBatchId`, `evidenceBatchVersion` equal to the batch, `beforeStateDigest === submission.packageDigest`; one `AuditEvent` with `action: 'publication.decided'`, `result: 'approved'`. Then as the author `GET /api/author/stories/:storyId/release` → `ready === true`, and `POST` the same path with `{ revisionId: target.revisionId, submissionId: target.submissionId, expectedVersion: target.version }` → 201.
  2. `rejects a never-published story with a fresh draft that revise replays`: reject with feedback `Cần làm rõ phần tóm tắt.` → 200. Database: submission `rejected` with `decisionSummary` equal to the feedback; old revision `rejected` with `immutableAt` set; story `draftRevisionId` points to a new revision with `status: 'editable'` and `parentRevisionId` equal to the old revision; story `authoringFrozen === false`, `publicationStatus === 'draft'`. Author `GET /api/author/submissions` item has `canRevise: true` and a history row with `action: 'manual-review.decided'` and the feedback. `POST /api/author/submissions/:id/revise` with the current version → 200 and `revision.id` equals the new draft id. `ContentRevision.countDocuments({ storyId })` is 2.
  3. `rejects a previously published story to unpublished`: before deciding, set `story.publishedRevisionId = new mongoose.Types.ObjectId()` and save; reject → story `publicationStatus === 'unpublished'`, `authoringFrozen === false`.
  4. `rejects a currently published story without changing its publication status`: before deciding, set `publicationStatus = 'published'` and `publishedRevisionId` to a new ObjectId; reject → `publicationStatus === 'published'`, `authoringFrozen === false`.
  5. `keeps a role-removal or account-deletion freeze when rejecting a story`: for each of `author-role-removed` and `account-deleted`, a fresh ready and claimed story submission whose story gets `publicationTransition = { result }` before deciding; reject → `authoringFrozen === true` and `publicationStatus === 'draft'`.
  6. `approves a chapter without touching the story freeze`: `approvedStory`; `submitChapter`; ready and claimed; set `story.authoringFrozen = true` directly; approve → chapter `status === 'approved'`, story `authoringFrozen === true`.
  7. `rejects a draft chapter to draft and keeps a published chapter published`: two chapters of an approved story. Chapter A (status `submitted`) reject → `status === 'draft'` and a new `draftRevisionId`. Chapter B: before deciding, load it with `Chapter.findById`, set `status = 'published'`, `publishedRevisionId = X`, `firstReleasedAt = T` and call `save()` (`firstReleasedAt` is a set-once field, `backend/src/models/content/chapter.model.js:55`; do not use `updateOne` for it) <!-- Red Team: group 14 -->; reject → `status === 'published'`, `publishedRevisionId` equals X, `firstReleasedAt` equals T, `draftRevisionId` is a new editable revision.
  8. `rejects an unpublished chapter to draft and keeps its release history`: before deciding, load the chapter with `Chapter.findById`, set `status = 'unpublished'`, `publishedRevisionId = X`, `firstReleasedAt = T` and call `save()`; reject → `status === 'draft'`, `publishedRevisionId` equals X, `firstReleasedAt` equals T.
  9. `requires feedback for rejection and a strict body`: reject with empty feedback → 400 `validation_error`; an extra body key → 400; feedback of 4001 characters → 400; the submission stays `decision-pending`.
  10. `refuses decisions without an own unexpired claim`: <!-- Red Team: group 11 --> with the current `expectedVersion` each time: on a ready but unclaimed (`pending-review`) submission → 409 `claim_required`; claimed by A, decided by B → 409 `claim_required`; A's claim expired via `updateOne` → A's decision → 409 `claim_required`; a reader → 403.
  11. `refuses stale submission or evidence versions and terminal submissions`: stale `expectedVersion` on A's own claim → 409 `submission_changed`; `evidenceBatchVersion + 1` → 409 `evidence_changed`; a different valid `evidenceBatchId` → 409 `evidence_changed`; batch reset to `status: 'pending'` with `updateOne` → 409 `evidence_changed`; after a successful approve, a second decision with the new current version → 409 `submission_changed`.
  12. `refuses decisions when the author is inactive or no longer an author`: author `status = 'suspended'` → 409 `author_unavailable`; restore `active`, set the author `RoleAssignment.status = 'revoked'` → 409 `author_unavailable`.
  13. `refuses decisions when the reviewed revision is no longer current`: set `story.draftRevisionId` to a new ObjectId with `updateOne`; decide → 409 `content_changed`.
  14. `commits exactly one decision under concurrent requests and one notification`: two identical reject requests in `Promise.all` → sorted statuses `[200, 409]`; `Notification.countDocuments({ sourceEventKey: 'publication-submission:' + submissionId + ':decided' })` is 1; `ModerationHistory.countDocuments({ action: 'manual-review.decided' })` is 1; author `GET /api/reader/notifications` → first item has `title` starting with `Cần chỉnh sửa:`, `description` equal to the feedback, `href === '/author/submissions'` and `action === 'Xem kết quả'`.
  15. `rolls back the whole decision when the notification write fails`: `vi.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('notification unavailable'))`; reject → 500; submission still `decision-pending` with the same version; revision `submitted`; story `authoringFrozen === true`; no `manual-review.decided` history; `ContentRevision.countDocuments({ storyId })` is 1.
  16. `no longer accepts the legacy AI-deferred history as release evidence`: `submitStory`; set submission `approved`, revision `approved`, story `publicationStatus = 'approved'` and `authoringFrozen = false`, leave the batch `pending` without `activeLeaseId`; create `ModerationHistory { aggregateType: 'story', aggregateId: storyId, action: 'manual-review.decided', outcome: 'approved', submissionId, revisionId, evidenceBatchId: batch._id, evidenceBatchVersion: batch.version, beforeStateDigest: submission.packageDigest, correlationId: 'manual-review-ai-deferred-v1', actorAccountId: moderator.account._id }`; author `GET /api/author/stories/:storyId/release` → `ready === false` and the `evidence` check has `ok === false`.
- **Success criteria:** all sixteen tests pass without network access.
- **Verify:** from `novelhub/backend` run `npx vitest run test/moderation-decision.test.js`. Pass: exit code 0 and output contains `Test Files  1 passed (1)` and `Tests  16 passed (16)`.

### Task 1.14 — Moderator image access test

- **Goal:** moderators read checksum-verified package images; authors cannot use the moderator route.
- **Target files and symbols:** `backend/test/author-media.test.js` (fixture `submissionWithImages` at lines 511-576, helper `get` at line 47).
- **Steps:**
  1. Append one test `serves submitted package images to moderators only through the moderator route`: `const f = await submissionWithImages()`; submit with the file's existing `chapterWrite(f.author.cookie, '/api/author/submissions', f.body)` → 201 and keep `const submissionId = sent.body.submission.id`; `const moderator = await authenticatedAccount('moderator')`; `get(moderator.cookie, '/api/moderator/submissions/' + submissionId + '/media/' + f.asset.id + '/content')` → 200, `content-type` contains `image/webp`, `cache-control` is `private, no-store`; the same URL with `f.author.cookie` → 403; with a random valid ObjectId as media id → 404.
- **Success criteria:** the new test passes alongside the existing ones.
- **Verify:** from `novelhub/backend` run `npx vitest run test/author-media.test.js`. Pass: exit code 0 and output contains `Test Files  1 passed (1)`.

## Todo List

- [x] Task 1.1 — Add the claim TTL configuration
- [x] Task 1.2 — Moderator and author lock helpers
- [x] Task 1.3 — Moderator package and image access through the existing loaders
- [x] Task 1.4 — Remove the legacy AI-deferred release bypass
- [x] Task 1.5 — Shared editable-revision helper and an honest `canRevise`
- [x] Task 1.6 — Queue, claim, release and decision-history module
- [x] Task 1.7 — Moderator submission detail
- [x] Task 1.8 — Decision transaction
- [x] Task 1.9 — Render decision notifications
- [x] Task 1.10 — Moderator router, mounting and history index
- [x] Task 1.11 — Shared submission fixtures for tests
- [x] Task 1.12 — Queue, claim, release and detail tests
- [x] Task 1.13 — Decision transaction tests
- [x] Task 1.14 — Moderator image access test
- [x] Regression gate

## Regression gate

Run in this order. Each command must meet its pass condition.

1. From `novelhub` run `npx prettier --write --ignore-unknown` followed by every file you created or modified in this phase (space-separated paths from the table above; `--ignore-unknown` skips `backend/.env.example`, which Prettier cannot parse). Pass: exit code 0.
2. From `novelhub/backend` run `npx vitest run`. Pass: exit code 0 and the `Test Files` summary line contains `passed` and does not contain `failed`.
3. From `novelhub/backend` run `npm run lint`. Pass: exit code 0.
4. From `novelhub/frontend` run `npx vitest run`. Pass: exit code 0 and the `Test Files` summary line does not contain `failed`.
5. From `novelhub` run `npm run format:check`. Pass: exit code 0 and output contains `All matched files use Prettier code style!`.

## Risk Assessment

| Risk | Likelihood × impact | Mitigation |
|---|---|---|
| A decision leaves a story or chapter in a state the release gates reject | Medium × High | Test 1.13.1 releases the approved story through the real endpoint. |
| A concurrent role revocation or account closure races a decision | Medium × High | <!-- Red Team: group 11 --> The decision locks the moderator (`lockModerator`) and the author (`lockSubmissionAuthor`, which reuses `lockAuthor`), so the transactions conflict and one retries or fails; tests 1.13.12 and 1.13.14 cover the 409 and race paths. |
| `canRevise` diverges from `reviseSubmission` guards | Medium × Medium | `canReviseRejected` mirrors lines 500-543 one to one; test 1.13.2 calls revise after checking the flag. |
| Removing the AI-deferred branch breaks a fixture | Low × Medium | `git grep` found no test using the correlation id; Task 1.4 runs the release suites. |
| Lazy claim expiry leaves stale `decision-pending` rows | Low × Low | The queue filter and claim takeover treat `claimExpiresAt <= now` as available; no sweeper needed. |

Rollback: revert this phase's commits. No migration runs and no existing document shape changes; the added index is additive.

## Security Considerations

- Every endpoint is behind `requireAuth` and `requireRole('moderator')`; every write re-checks the moderator role and the account epoch inside the transaction (`lockModerator`).
- Writes require an `Origin` in `CORS_ORIGIN` (existing CSRF middleware).
- The detail and image endpoints are read-only, `private, no-store`, and verify package digests before returning content.
- Error responses expose only `HttpError` codes and messages; 5xx stays generic (`backend/src/middleware/errors.js:15-26`).
- Feedback is stored as plain text, capped at 4000 characters, and never rendered as HTML.

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
