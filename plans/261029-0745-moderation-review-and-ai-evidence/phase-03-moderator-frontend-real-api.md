---
phase: 3
title: "Phase 3: Moderator frontend on the real API"
status: completed
priority: P1
effort: 11h
dependencies: [1, 2]
---

# Phase 3: Moderator frontend on the real API

## Goal

Moderators work entirely on live data: an overview with real counts, a queue with claim and release, a review detail page with the exact package, rights, AI evidence (processing, failed-stage banner, findings, advisory LLM summary), history and the approve/reject decision, a similarity page for one submission's findings, and a decision history page replacing the `/moderator/decisions` placeholder. All strings are Vietnamese locale keys. Mock data for these pages is deleted.

All paths are relative to `novelhub/`. Run every command from the stated working directory.

## Context Links

- Authoritative design: [design decisions](./reports/design-decisions.md) section "Frontend".
- Red team: [red-team findings](./reports/red-team-findings.md) groups 5, 6, 11 and 14.
- API contract produced by [Phase 01](./phase-01-review-lifecycle-and-decision-api.md) Tasks 1.6, 1.7 and 1.10 (response shapes are copied below).
- Scout: [AI and frontend scout](./reports/scout-ai-frontend.md) section 5.

## Key Insights

- The moderator pages read mock data through `useMockResource` (`frontend/src/pages/moderator/SubmissionQueuePage.jsx:15-17,90`, `ContentReviewDetailPage.jsx:18,74`, `ModeratorOverviewPage.jsx:19-20,133-135`, `SimilarityRiskReviewPage.jsx:19,106`) and use hard-coded strings.
- `frontend/src/data/mock/moderation.js` exports `moderationStats` (line 1), `urgentModerationItems` (line 8), `submissionQueue` (line 47) and `communityReports` (line 120). Only `communityReports` stays in use, by the out-of-scope `ReportsQueuePage.jsx:20`.
- Live data helpers: `useBackendDocument(path, initial)` (`frontend/src/api/useBackendResource.js:45-47`) returns `{ status: 'loading'|'ready'|'empty'|'error', data, error, retry }`; `apiRequest(path, { method, body })` throws `ApiError` with `status` and `code` (`frontend/src/api/client.js:18-52`).
- The decision UI pattern with `expectedVersion`, a reason textarea and a `Modal` is `frontend/src/components/admin/AuthorApplications.jsx:41-74,191-263`.
- `DraftReadingCanvas` renders the package and passes `submissionId` to `PrivateChapterImage`, which builds an author-only URL (`frontend/src/pages/author/DraftReadingCanvas.jsx:16,78`; `frontend/src/components/story/PrivateChapterImage.jsx:4-8`; `frontend/src/api/media.js:3-4`). Moderators need the Phase 01 endpoint `/moderator/submissions/:id/media/:mediaId/content`.
- `vi.json` already has unused `reviewHistory` (lines 2-21), `manualReview` (lines 22-61) and `reviewClaims` (lines 84-114) blocks; `manualReview` still mentions the removed AI-deferred admission (`admit`, `aiDeferred`, `acknowledgement`, `admitNote`). Status and evidence labels exist in `submissionData.status.*` and `submissionData.evidenceStatus.*` (`frontend/src/locales/vi.json:1819-1833`). Interpolation uses `{{name}}` (`frontend/src/context/LocaleContext.jsx:9-11`).
- Routes: `/moderator` (`frontend/src/App.jsx:535`), `/moderator/submissions` (`:537-538`), `/moderator/submissions/:submissionId` (`:541-542`), `/moderator/similarity-review/:reviewId` (`:634-635`), placeholder `/moderator/decisions` (`:569-580`). Route helpers live in `frontend/src/app/routes.js:1-26`.
- UI kit: `Tabs({ items: [{ value, label }], value, onChange, label })` renders `aria-pressed` buttons (`frontend/src/components/ui/index.jsx:808-856`); `Pagination` is imported from `frontend/src/components/ui/Pagination.jsx`.
- `npm run icons:check` fails when a page imports an icon without a drawing (`frontend/scripts/check-icons.mjs:21-31`). Import only icons already imported by the current moderator pages: `AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, FileSearch, FileText, Gavel, Info, RotateCcw, Scale, ShieldAlert, ShieldCheck, Sparkles, UserPlus, X`.
- Test conventions: `vi.hoisted` + `vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))`, layouts mocked to `<main>`, render inside `<MemoryRouter><LocaleProvider>`, `afterEach(cleanup)` (`frontend/test/pages/author/SubmittedPackagePage.test.jsx:1-14`, `frontend/test/components/admin/AuthorApplications.test.jsx:1-28`). Vitest includes `test/**/*.{test,spec}.{js,jsx}` (`frontend/vite.config.js:12-15`).

### API contract used by this phase (from Phase 01)

- `GET /moderator/summary` → `{ queue, mine, processing, decidedToday }`.
- `GET /moderator/submissions?view=queue|mine|processing&page=N` → `{ items: [{ id, version, status, submittedAt, type, storyId, chapterId, title, storyTitle, revisionNumber, author: { id, displayName }, claim: null | { ownerAccountId, ownedByMe, expiresAt, expired }, evidence: null | { batchId, batchVersion, status, stage, failedStage, findingsCount, maxScore, llmStatus } }], page, pageSize, total, pageCount }`.
- <!-- Red Team: groups 4, 5, 14 --> `GET /moderator/submissions/:id` → `{ submission: { id, version, status, submittedAt, decisionSummary, type, claim }, story: { id, title }, author: { id, displayName }, revision: { id, number, formatVersion }, packageDigest, rights: { basis, asserted, sourceLicenceNote }, media, chapter?: { id, document }, metadata?: { title, description }, evidence: null | { batch: { id, version, status, stage, failedStage }, findingsCount, maxScore, findingsTruncated, attempts, findings: [{ id, rank, score, queryPassageId, sourcePassageId, sourceChapterId, sourceChapterTitle, sourceStoryTitle, queryText, sourceText }] (at most 50), llmReview: null | { status, summary, riskLevel, riskReasons, suggestions, findingAssessments: [{ findingId, assessment }], droppedIneligibleFindings, reviewedChars, totalChars, criteriaVersion, completedAt } }, history: [{ id, action, outcome, feedback, occurredAt }], actions: { canClaim, canRelease, canDecide } }`. `canRelease` is false once the claim has expired.
- `POST /moderator/submissions/:id/claim|release` body `{ expectedVersion }`; `POST /moderator/submissions/:id/decision` body `{ decision, feedback, expectedVersion, evidenceBatchId, evidenceBatchVersion }`.
- `GET /moderator/decisions?outcome=all|approved|rejected&scope=all|mine&page=N` → `{ items: [{ id, submissionId, revisionId, title, type, outcome, feedback, occurredAt, moderator: { id, displayName }, mine }], page, pageSize, total, pageCount }`.
- Error codes: `evidence_pending`, `claim_held`, `claim_required`, `submission_changed`, `evidence_changed`, `content_changed`, `author_unavailable`, `account_changed`, `forbidden`, `validation_error`.

## Files to Create / Modify / Delete

<!-- Red Team: group 14 -->
| Action | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/locales/vi.json` | Repair `reviewHistory`, `manualReview`, `reviewClaims` for the approve/reject flow. |
| Modify | `frontend/src/api/media.js` | Add `moderatorMediaUrl`. |
| Modify | `frontend/src/components/story/PrivateChapterImage.jsx` | Accept a `mediaUrl` builder. |
| Modify | `frontend/src/pages/author/DraftReadingCanvas.jsx` | Forward `mediaUrl`. |
| Modify | `frontend/src/app/routes.js` | Add moderator route helpers. |
| Create | `frontend/src/pages/moderator/moderationMessages.js` | Error-code to locale-key mapping. |
| Modify (rewrite) | `frontend/src/pages/moderator/SubmissionQueuePage.jsx` | Live queue, claim, release. |
| Modify (rewrite) | `frontend/src/pages/moderator/ContentReviewDetailPage.jsx` | Live package, evidence, history, claim and decision. |
| Modify (rewrite) | `frontend/src/pages/moderator/SimilarityRiskReviewPage.jsx` | Findings of one submission. |
| Create | `frontend/src/pages/moderator/similarityState.js` | `similarityEmptyState`: fail-closed empty-findings message (Kongming Phase 02 gate). |
| Modify (rewrite) | `frontend/src/pages/moderator/ModeratorOverviewPage.jsx` | Live counts and lists. |
| Create | `frontend/src/pages/moderator/ModerationDecisionsPage.jsx` | Decision history. |
| Modify | `frontend/src/App.jsx` | Lazy import and route for the decision history page. |
| Modify | `frontend/src/data/mock/moderation.js` | Delete the three unused exports. |
| Create | `frontend/test/pages/moderator/SubmissionQueuePage.test.jsx` | Queue tests. |
| Create | `frontend/test/pages/moderator/ContentReviewDetailPage.test.jsx` | Detail and decision tests. |
| Create | `frontend/test/pages/moderator/SimilarityRiskReviewPage.test.jsx` | Findings tests. |
| Create | `frontend/test/pages/moderator/ModeratorOverviewPage.test.jsx` | Overview test. |
| Create | `frontend/test/pages/moderator/ModerationDecisionsPage.test.jsx` | Decision history test. |
| Create | `frontend/test/locales/moderatorLocaleKeys.test.js` | Mechanical check that moderator pages only use existing locale keys. |

## Tasks

### Task 3.1 — Repair the moderator locale blocks

- **Goal:** every string the new pages render exists in `vi.json`, and nothing mentions AI-deferred admission.
- **Target files and symbols:** `frontend/src/locales/vi.json` blocks `reviewHistory` (lines 2-21), `manualReview` (lines 22-61), `reviewClaims` (lines 84-114).
- **Steps:**
  1. In `reviewHistory`: set `"title": "Lịch sử quyết định"` and `"description": "Các quyết định kiểm duyệt đã lưu. Phản hồi và phiên bản được giữ trong lịch sử bất biến."`; add `"scopeAll": "Tất cả kiểm duyệt viên"`, `"scopeMine": "Quyết định của tôi"`, `"outcome": "Kết quả"`, `"moderator": "Kiểm duyệt viên"`. Keep every other key.
  2. In `manualReview`: delete `admit`, `aiDeferred`, `acknowledgement`, `admitNote`. Set `"reason": "Phản hồi cho tác giả (bắt buộc khi từ chối, tối đa 4000 ký tự)"`. Add `"decision-pending": "Chờ quyết định"` to `statuses`. Add these keys with exactly these values:
     ```json
     "back": "Về hàng đợi",
     "author": "Tác giả",
     "submittedAt": "Ngày gửi",
     "revision": "Phiên bản {{number}}",
     "approve": "Phê duyệt",
     "reject": "Từ chối",
     "feedbackHint": "Khi từ chối, nêu rõ mức độ nghiêm trọng và việc tác giả cần sửa.",
     "saved": "Đã lưu quyết định và gửi thông báo cho tác giả.",
     "changed": "Hồ sơ hoặc bằng chứng AI đã thay đổi. Tải lại trước khi quyết định.",
     "evidencePending": "AI đang xử lý bằng chứng. Chưa thể nhận hoặc quyết định hồ sơ này.",
     "authorUnavailable": "Tài khoản tác giả không còn hoạt động; không thể ra quyết định.",
     "permissionChanged": "Quyền kiểm duyệt đã thay đổi. Hãy đăng nhập lại.",
     "saveFailed": "Không lưu được thao tác. Vui lòng thử lại.",
     "actions": {
       "submitted": "Đã gửi duyệt",
       "decided": "Đã ra quyết định",
       "revisionCreated": "Đã tạo bản chỉnh sửa",
       "cancelled": "Đã hủy hồ sơ"
     },
     "evidence": {
       "title": "Bằng chứng AI (chỉ để tham khảo)",
       "none": "Chưa có bằng chứng AI cho hồ sơ này.",
       "processing": "AI đang xử lý: {{status}}",
       "failed": "Giai đoạn AI thất bại: {{stage}}. Hãy kiểm duyệt thủ công.",
       "findings": "{{count}} đoạn tương đồng · điểm cao nhất {{score}}%",
       "noFindings": "Không tìm thấy đoạn tương đồng trong NovelHub.",
       "comparisonSkipped": "Hồ sơ thông tin truyện không chạy so sánh tương đồng.",
       "comparisonUnavailable": "Chưa có kết quả so sánh tương đồng; không thể kết luận là không trùng lặp.",
       "openSimilarity": "Xem chi tiết tương đồng",
       "llmTitle": "Nhận định AI (tham khảo, có thể bị nội dung tác giả tác động)",
       "partialCoverage": "AI chỉ đọc {{reviewed}}/{{total}} ký tự",
       "insufficientData": "Chưa đủ dữ liệu",
       "findingsShown": "Đang hiển thị {{shown}} / {{total}} đoạn tương đồng",
       "advisory": "Kết quả AI chỉ mang tính tham khảo, không phải phán quyết.",
       "riskLevel": "Mức rủi ro: {{level}}",
       "riskLevels": { "low": "Thấp", "medium": "Trung bình", "high": "Cao" },
       "riskReasons": "Lý do rủi ro",
       "suggestions": "Gợi ý cho tác giả",
       "stages": { "embedding": "Tạo embedding", "comparison": "So sánh tương đồng", "llm": "Phân tích LLM" }
     },
     "similarity": {
       "title": "Đối chiếu tương đồng",
       "description": "Từng đoạn của bản gửi đặt cạnh đoạn NovelHub gần nhất. Điểm tương đồng không phải phán quyết.",
       "back": "Về hồ sơ kiểm duyệt",
       "queryPassage": "Đoạn trong bản gửi",
       "sourcePassage": "Đoạn nguồn: {{story}} · {{chapter}}",
       "score": "Điểm tương đồng {{score}}%",
       "assessment": "Nhận định của AI"
     }
     ```
  3. In `reviewClaims`: set `"intake": "Chờ kiểm duyệt"`. Add with exactly these values:
     ```json
     "processing": "Đang chờ AI",
     "claimed": "Đã nhận hồ sơ. Bạn có thể đọc và ra quyết định.",
     "released": "Đã trả hồ sơ về hàng đợi.",
     "claimHeld": "Hồ sơ đang được kiểm duyệt viên khác giữ.",
     "expired": "Claim đã hết hạn",
     "findings": "{{count}} đoạn tương đồng",
     "noEvidence": "Chưa có bằng chứng",
     "author": "Tác giả",
     "status": "Trạng thái",
     "evidence": "Bằng chứng AI",
     "failedStage": "Thất bại ở: {{stage}}",
     "overview": {
       "title": "Tổng quan kiểm duyệt",
       "description": "Số hồ sơ chờ, hồ sơ bạn đang giữ và quyết định gần đây, lấy trực tiếp từ máy chủ.",
       "queue": "Chờ kiểm duyệt",
       "mine": "Tôi đang giữ",
       "processing": "Đang chờ AI",
       "decidedToday": "Tôi đã quyết định hôm nay",
       "oldest": "Hồ sơ chờ lâu nhất",
       "recent": "Quyết định gần đây của tôi",
       "openQueue": "Mở hàng đợi",
       "openHistory": "Xem lịch sử quyết định"
     }
     ```
  4. <!-- Red Team: group 14 --> Create `frontend/test/locales/moderatorLocaleKeys.test.js`:
     ```js
     import { readdirSync, readFileSync } from 'node:fs'
     import { describe, expect, it } from 'vitest'
     import dictionary from '../../src/locales/vi.json'

     const pagesDir = new URL('../../src/pages/moderator/', import.meta.url)
     const lookup = key => key.split('.').reduce((node, part) => node?.[part], dictionary)
     const usedKeys = () =>
       readdirSync(pagesDir)
         .filter(name => /\.(js|jsx)$/.test(name))
         .flatMap(name =>
           [...readFileSync(new URL(name, pagesDir), 'utf8').matchAll(/'((?:manualReview|reviewClaims|reviewHistory|submissionData)\.[A-Za-z0-9_.-]+)'/g)].map(match => match[1]),
         )
         .filter(key => !key.endsWith('.'))
     ```
     with exactly two tests: `removes the AI-deferred admission keys` (each of `manualReview.admit`, `manualReview.aiDeferred`, `manualReview.acknowledgement`, `manualReview.admitNote` has `lookup(key) === undefined`) and `defines every literal locale key used by moderator pages` (every key from `usedKeys()` has `typeof lookup(key) === 'string'`; keys built by concatenation end with `.` and are skipped). Re-run this test after each page task; the regression gate runs it with the whole suite.
- **Success criteria:** the file is valid JSON, the removed keys are gone, and every literal moderator key resolves to a string.
- **Verify:** from `novelhub/frontend` run `npm run i18n:check && npx vitest run test/locales/moderatorLocaleKeys.test.js`. Pass: exit code 0 and output contains `Nguồn nội dung tiếng Việt hợp lệ` and `Tests  2 passed (2)`.

### Task 3.2 — Moderator image URLs and route helpers

- **Goal:** the shared reading canvas can load images through the moderator endpoint, and pages build moderator links from one place.
- **Target files and symbols:** `frontend/src/api/media.js` (lines 1-6); `frontend/src/components/story/PrivateChapterImage.jsx` (`PrivateChapterImage`, lines 4-9); `frontend/src/pages/author/DraftReadingCanvas.jsx` (signature line 16, image line 78); `frontend/src/app/routes.js` (line 24).
- **Steps:**
  1. `media.js`: add `export const moderatorMediaUrl = (submissionId, mediaId) => API_BASE + '/moderator/submissions/' + encodeURIComponent(submissionId) + '/media/' + encodeURIComponent(mediaId) + '/content'` (a template literal in the style of lines 3-4 is equivalent).
  2. `PrivateChapterImage({ block, submissionId, mediaUrl })`: `const src = mediaUrl ? mediaUrl(block.mediaId) : submissionId ? submittedMediaUrl(submissionId, block.mediaId) : privateMediaUrl(block.mediaId)`.
  3. `DraftReadingCanvas({ document, storyTitle, submissionId, mediaUrl, headingLevel = 1 })`; line 78 passes `mediaUrl={mediaUrl}` to `PrivateChapterImage`.
  4. `routes.js`: after `moderatorSubmission` add `moderatorSubmissions: '/moderator/submissions'`, `moderatorSimilarity: id => '/moderator/similarity-review/' + id`, `moderatorDecisions: '/moderator/decisions'`.
- **Success criteria:** author pages render images exactly as before.
- **Verify:** from `novelhub/frontend` run `npx vitest run test/pages/author/SubmittedPackagePage.test.jsx test/components/story/ChapterImages.test.jsx`. Pass: exit code 0 and output contains `Test Files  2 passed (2)`.

### Task 3.3 — Error-code mapping

- **Goal:** all moderator pages show the same message for the same server error code.
- **Target files and symbols:** create `frontend/src/pages/moderator/moderationMessages.js` exporting `moderationErrorKey(code)`.
- **Steps:**
  1. Return `'reviewClaims.claimHeld'` for `claim_held`; `'manualReview.evidencePending'` for `evidence_pending`; `'manualReview.changed'` for `submission_changed`, `evidence_changed`, `content_changed`; `'manualReview.claimRequired'` for `claim_required`; `'manualReview.authorUnavailable'` for `author_unavailable`; `'manualReview.permissionChanged'` for `account_changed` and `forbidden`; otherwise `'manualReview.saveFailed'`.
- **Success criteria:** pure function, no React import.
- **Verify:** no verification needed (the page tests in Tasks 3.4 and 3.5 assert mapped messages).

### Task 3.4 — Live submission queue

- **Goal:** `/moderator/submissions` lists `queue`, `mine` and `processing` from the API and claims or releases with the item's version.
- **Target files and symbols:** rewrite `frontend/src/pages/moderator/SubmissionQueuePage.jsx` (export `SubmissionQueuePage`); create `frontend/test/pages/moderator/SubmissionQueuePage.test.jsx`.
- **Steps:**
  1. Replace the whole file. Imports: `useState` from react; `useNavigate` from `react-router`; `ModeratorLayout` from `../../layouts`; `ROUTES` from `../../app/routes`; `apiRequest` from `../../api/client`; `useBackendDocument` from `../../api/useBackendResource`; `useLocale` from `../../context/LocaleContext`; `Badge, Button, ButtonLink, Card, EmptyState, Modal, Skeleton, Tabs` from `../../components/ui`; `Pagination` from `../../components/ui/Pagination`; icons only from the allowed list; `moderationErrorKey` from `./moderationMessages`.
  2. State: `view` (`'queue'`), `page` (1), `pending` (`{ item, action: 'claim'|'release' }` or null), `saving`, `error`, `notice`. Data: `const resource = useBackendDocument('/moderator/submissions?view=' + view + '&page=' + page, null)`.
  3. Header: `<h1>` `t('reviewClaims.title')`, description `t('reviewClaims.description')`, reload button `t('reviewClaims.reload')` calling `resource.retry`. Tabs (`label={t('reviewClaims.title')}`) with items `queue` → `t('reviewClaims.available')`, `mine` → `t('reviewClaims.mine')`, `processing` → `t('reviewClaims.processing')`; changing the tab sets `page` to 1.
  4. States: loading → `Skeleton` rows plus `<p role="status">{t('reviewClaims.loading')}</p>`; error → `EmptyState` with `t('reviewClaims.error')` and a retry button; ready with no items → `EmptyState` `t('reviewClaims.empty')`.
  5. Table columns: `reviewClaims.submission` (item `title` and the `storyTitle` below it), `reviewClaims.author` (`author.displayName`), `reviewClaims.submittedAt` (`formatDate`), `reviewClaims.status` (`t('submissionData.status.' + status)`), `reviewClaims.evidence` (`t('submissionData.evidenceStatus.' + evidence.status)`, then `t('reviewClaims.findings', { count: evidence.findingsCount })`, and for `failed` `t('reviewClaims.failedStage', { stage: t('manualReview.evidence.stages.' + evidence.failedStage) })`; `t('reviewClaims.noEvidence')` when `evidence` is null), `reviewClaims.expiresAt` (`formatDate(claim.expiresAt)` plus `t('reviewClaims.expired')` when `claim.expired`, otherwise `—`), `reviewClaims.action`.
  6. Actions per row: always a `ButtonLink` `t('reviewClaims.openReview')` to `ROUTES.moderatorSubmission(item.id)`; in `queue` view a `Button` `t('reviewClaims.acquire')` that sets `pending = { item, action: 'claim' }`; in `mine` view a `Button` `t('reviewClaims.release')` that sets `pending = { item, action: 'release' }`; nothing else in `processing` view.
  7. Confirmation `Modal` (`title={t('reviewClaims.title')}`) shows `t('reviewClaims.acquireNote')` or `t('reviewClaims.releaseNote')` and buttons `t('reviewClaims.close')` and `t('reviewClaims.confirm')` (`t('reviewClaims.saving')` while saving). Confirm calls `apiRequest('/moderator/submissions/' + item.id + '/' + action, { method: 'POST', body: { expectedVersion: item.version } })`. On claim success navigate to `ROUTES.moderatorSubmission(item.id)`; on release success close the modal, set `notice = t('reviewClaims.released')` and call `resource.retry()`. On failure keep the modal open and show `<p role="alert">{t(moderationErrorKey(failure.code))}</p>`. Render `notice` in a `<p role="status">` above the table, outside the loading/error branches.
  8. Below the table render `<Pagination page={page} pageCount={resource.data.pageCount} onChange={setPage} />`.
  9. Test file with exactly three tests (mock `apiRequest`; `ModeratorLayout` mocked to `<main>`; render inside `<MemoryRouter><LocaleProvider>`):
     1. `loads the live queue and claims with the current version`: feed `{ items: [{ id: '507f1f77bcf86cd799439011', version: 3, status: 'pending-review', submittedAt: '2026-10-29T00:00:00Z', type: 'chapter', title: 'Chương 1', storyTitle: 'Truyện A', revisionNumber: 2, author: { id: 'a1', displayName: 'Tác giả A' }, claim: null, evidence: { batchId: 'b1', batchVersion: 5, status: 'available-for-human-review', stage: 'llm', failedStage: null, findingsCount: 2, maxScore: 0.91, llmStatus: 'succeeded' } }], page: 1, pageSize: 20, total: 1, pageCount: 1 }`; first call path `/moderator/submissions?view=queue&page=1`; texts `Chương 1`, `Truyện A`, `Tác giả A`, `2 đoạn tương đồng`, `Sẵn sàng cho kiểm duyệt viên` visible; click `Nhận hồ sơ`, then `Xác nhận` → `apiRequest` called with `('/moderator/submissions/507f1f77bcf86cd799439011/claim', { method: 'POST', body: { expectedVersion: 3 } })`.
     2. `shows a held-claim conflict instead of success`: the claim call rejects `Object.assign(new Error('conflict'), { status: 409, code: 'claim_held' })` → alert text `Hồ sơ đang được kiểm duyệt viên khác giữ.`
     3. `releases my claims and keeps processing items read-only`: click tab `Tôi đang giữ` → a call with `/moderator/submissions?view=mine&page=1`; click `Trả hồ sơ`, then `Xác nhận` → POST `.../release` with `{ expectedVersion }`; click tab `Đang chờ AI` → a call with `view=processing`, and no `Nhận hồ sơ` button is rendered.
- **Success criteria:** no mock data import remains in the file.
- **Verify:** from `novelhub/frontend` run `npx vitest run test/pages/moderator/SubmissionQueuePage.test.jsx`. Pass: exit code 0 and output contains `Tests  3 passed (3)`.

### Task 3.5 — Live review detail with evidence and decision

- **Goal:** `/moderator/submissions/:submissionId` shows the exact package, rights, evidence, history and the claim, release and decision controls the API allows.
- **Target files and symbols:** rewrite `frontend/src/pages/moderator/ContentReviewDetailPage.jsx` (export `ContentReviewDetailPage`); create `frontend/test/pages/moderator/ContentReviewDetailPage.test.jsx`.
- **Steps:**
  1. Replace the whole file. Data: `const { submissionId } = useParams()`; `const resource = useBackendDocument('/moderator/submissions/' + submissionId, null)`. Imports as in Task 3.4 plus `useParams` from `react-router`, `DraftReadingCanvas` from `../author/DraftReadingCanvas` and `moderatorMediaUrl` from `../../api/media`.
  2. Header: `ButtonLink` `t('manualReview.back')` to `ROUTES.moderatorSubmissions`; `<h1>` with the chapter or story title (`data.chapter ? data.chapter.document.title : data.metadata.title`); badge `t('manualReview.statuses.' + submission.status)`; `t('manualReview.author')` + `author.displayName`; `t('manualReview.submittedAt')` + `formatDate`; `t('manualReview.revision', { number: revision.number })`.
  3. Rights card: heading `t('manualReview.rights')`; `t(rights.basis === 'licensed' ? 'manualReview.licensed' : 'manualReview.original')`; `sourceLicenceNote` when present (plain text, `whitespace-pre-wrap`); `t('manualReview.digest')` with `packageDigest` in a `<code>`.
  4. Evidence card: heading `t('manualReview.evidence.title')`.
     - No evidence → `t('manualReview.evidence.none')`.
     - `batch.status === 'failed'` → `<p role="alert">` with `t('manualReview.evidence.failed', { stage: t('manualReview.evidence.stages.' + batch.failedStage) })`.
     - Any other status except `available-for-human-review` → `t('manualReview.evidence.processing', { status: t('submissionData.evidenceStatus.' + batch.status) })`.
     - <!-- Red Team: groups 5, 6, 14 --> <!-- Updated: Kongming Phase 02 gate - fail-closed empty state --> Findings (rendered in their own block, never inside the AI block): when `evidence.findingsCount > 0`, `t('manualReview.evidence.findings', { count: evidence.findingsCount, score: Math.round(evidence.maxScore * 100) })`, plus `t('manualReview.evidence.findingsShown', { shown: evidence.findings.length, total: evidence.findingsCount })` when `evidence.findingsTruncated`, and a `ButtonLink` `t('manualReview.evidence.openSimilarity')` to `ROUTES.moderatorSimilarity(submission.id)`. When `findingsCount === 0`, export and use one helper `similarityEmptyState(submission, evidence)` from `frontend/src/pages/moderator/similarityState.js` returning a locale key: `submission.type === 'story'` → `'manualReview.evidence.comparisonSkipped'`; else when `evidence.attempts.some(a => a.stage === 'comparison' && a.status === 'succeeded')` → `'manualReview.evidence.noFindings'`; otherwise → `'manualReview.evidence.comparisonUnavailable'`. Never show `noFindings` for a batch that is processing, failed before or during comparison, or has no succeeded comparison attempt.
     - `llmReview`: heading `t('manualReview.evidence.llmTitle')`, `Badge` `t('manualReview.evidence.advisory')`, the `summary` paragraph, lists under `t('manualReview.evidence.riskReasons')` and `t('manualReview.evidence.suggestions')`. Let `partial = llmReview.reviewedChars != null && llmReview.totalChars != null && llmReview.reviewedChars < llmReview.totalChars`. When `partial`, show `t('manualReview.evidence.partialCoverage', { reviewed: formatNumber(llmReview.reviewedChars), total: formatNumber(llmReview.totalChars) })` and a `Badge` `t('manualReview.evidence.insufficientData')` instead of the risk level; otherwise show `t('manualReview.evidence.riskLevel', { level: t('manualReview.evidence.riskLevels.' + riskLevel) })`.
  5. Package: chapter → `<DraftReadingCanvas document={data.chapter.document} storyTitle={data.story.title} mediaUrl={mediaId => moderatorMediaUrl(submission.id, mediaId)} headingLevel={2} />`; story → a `Card` with `metadata.title` and `metadata.description` (plain text, `whitespace-pre-wrap`).
  6. History: heading `t('manualReview.history')`; one row per entry with `formatDate(occurredAt)`, label `{ submitted: 'manualReview.actions.submitted', 'manual-review.decided': 'manualReview.actions.decided', 'revision-created': 'manualReview.actions.revisionCreated', 'submission.cancelled': 'manualReview.actions.cancelled' }[action]` translated (fall back to the raw action), the outcome label when present, and the feedback text.
  7. Controls (driven only by `data.actions`): `canClaim` → `Button` `t('reviewClaims.acquire')`; `canRelease` → `Button` `t('reviewClaims.release')`; `canDecide` → `Button` `t('manualReview.approve')` and `Button` `t('manualReview.reject')`. When `submission.status === 'validated'` show `t('manualReview.evidencePending')`; when the claim belongs to someone else and has not expired show `t('reviewClaims.claimHeld')`. Claim and release POST `{ expectedVersion: submission.version }` and then call `resource.retry()`; their failures show `role="alert"` text from `moderationErrorKey`.
  8. Decision `Modal` (`title={t('manualReview.confirmTitle')}`): shows the chosen decision label, a `<textarea>` with `<label>` `t('manualReview.reason')` (`maxLength={4000}`), the hint `t('manualReview.feedbackHint')`, the note `t('manualReview.decisionNote')`, buttons `t('manualReview.close')` and `t('manualReview.confirm')` (`t('manualReview.saving')` while saving). Confirm is disabled while saving and, for `reject`, while `feedback.trim()` is empty. Confirm calls `apiRequest('/moderator/submissions/' + submission.id + '/decision', { method: 'POST', body: { decision, feedback: feedback.trim(), expectedVersion: submission.version, evidenceBatchId: evidence.batch.id, evidenceBatchVersion: evidence.batch.version } })`. Success → close the modal, set `notice` and call `resource.retry()`; render `notice` as `<p role="status">{t('manualReview.saved')}</p>` above the resource-dependent content, outside the loading/error branches, so it survives the reload. Failure → keep the modal and the typed text, show `<p role="alert">{t(moderationErrorKey(failure.code))}</p>`.
  9. Loading, error (with retry) and empty states use `t('manualReview.loading')`, `t('manualReview.error')`, `t('manualReview.reload')`.
  10. Test file (route rendered through `<Routes><Route path="/moderator/submissions/:submissionId" element={<ContentReviewDetailPage />} /></Routes>` with `initialEntries={['/moderator/submissions/sub-1']}`) with exactly six tests. Base fixture: submission `{ id: 'sub-1', version: 4, status: 'decision-pending', claim: { ownedByMe: true, expired: false } }`, chapter document `{ title: 'Chương kiểm duyệt', blocks: [{ type: 'paragraph', inlines: [{ text: 'Đoạn văn của gói.', marks: [] }] }, { type: 'image', mediaId: 'img-1', alt: 'Ảnh trong gói', caption: '' }] }`, rights `{ basis: 'original', asserted: true, sourceLicenceNote: '' }`, evidence batch `{ id: 'batch-1', version: 7, status: 'available-for-human-review', stage: 'llm' }` with `findingsCount: 1`, `maxScore: 0.87`, `findingsTruncated: false`, one finding with `score: 0.87`, `llmReview.summary: 'AI thấy một đoạn trùng ý.'`, `riskLevel: 'medium'`, `reviewedChars: 1200`, `totalChars: 1200`, history `[{ action: 'submitted', occurredAt: '2026-10-29T00:00:00Z' }]`, actions `{ canClaim: false, canRelease: true, canDecide: true }`.
      1. `renders the exact package, rights, advisory AI summary and history`: `Đoạn văn của gói.` inside the article; image `Ảnh trong gói` has `src` `/api/moderator/submissions/sub-1/media/img-1/content`; texts `Nội dung do tác giả sáng tác`, `Nhận định AI (tham khảo, có thể bị nội dung tác giả tác động)`, `AI thấy một đoạn trùng ý.`, `Kết quả AI chỉ mang tính tham khảo, không phải phán quyết.`, `Mức rủi ro: Trung bình`, `Đã gửi duyệt`; `apiRequest` first called with `/moderator/submissions/sub-1`.
      2. `requires feedback to reject and sends the exact versions`: click `Từ chối`; `Xác nhận` is disabled; type `Cần sửa đoạn mở đầu.` into the `Phản hồi cho tác giả (bắt buộc khi từ chối, tối đa 4000 ký tự)` field; click `Xác nhận` → `apiRequest` called with `('/moderator/submissions/sub-1/decision', { method: 'POST', body: { decision: 'reject', feedback: 'Cần sửa đoạn mở đầu.', expectedVersion: 4, evidenceBatchId: 'batch-1', evidenceBatchVersion: 7 } })`; then `Đã lưu quyết định và gửi thông báo cho tác giả.` is visible.
      3. `approves without feedback`: click `Phê duyệt`; `Xác nhận` is enabled; click → body `{ decision: 'approve', feedback: '', expectedVersion: 4, evidenceBatchId: 'batch-1', evidenceBatchVersion: 7 }`.
      4. `shows the failed AI stage and keeps manual review available`: batch `{ status: 'failed', failedStage: 'comparison' }`, `llmReview: null`, findings `[]`, submission `pending-review` with `claim: null`, actions `{ canClaim: true, canRelease: false, canDecide: false }` → text `Giai đoạn AI thất bại: So sánh tương đồng. Hãy kiểm duyệt thủ công.` and a `Nhận hồ sơ` button.
      5. `keeps the modal open with a reload message on a stale version`: the decision call rejects `Object.assign(new Error('stale'), { status: 409, code: 'evidence_changed' })` → alert `Hồ sơ hoặc bằng chứng AI đã thay đổi. Tải lại trước khi quyết định.` and the feedback text is still in the textarea.
      6. <!-- Red Team: groups 5, 14 --> `flags partial AI coverage and truncated findings`: `llmReview.reviewedChars: 60000`, `totalChars: 61000`; `findingsCount: 75`, `findingsTruncated: true` with 50 findings → texts `AI chỉ đọc 60.000/61.000 ký tự`, `Chưa đủ dữ liệu` and `Đang hiển thị 50 / 75 đoạn tương đồng` are visible and `Mức rủi ro: Trung bình` is not.
- **Success criteria:** no mock import and no hard-coded SLA, rating or policy checklist remains.
- **Verify:** from `novelhub/frontend` run `npx vitest run test/pages/moderator/ContentReviewDetailPage.test.jsx`. Pass: exit code 0 and output contains `Tests  6 passed (6)`.

### Task 3.6 — Similarity page for one submission

- **Goal:** `/moderator/similarity-review/:reviewId` (where `reviewId` is the submission id) shows the stored findings (at most 50, with the same `findingsShown` disclosure as Task 3.5 when `findingsTruncated`) next to their source passages with the AI assessment. <!-- Updated: Kongming Phase 02 gate - API caps findings at 50 -->
- **Target files and symbols:** rewrite `frontend/src/pages/moderator/SimilarityRiskReviewPage.jsx` (export `SimilarityRiskReviewPage`); create `frontend/test/pages/moderator/SimilarityRiskReviewPage.test.jsx`.
- **Steps:**
  1. Replace the whole file. `const { reviewId } = useParams()`; `const resource = useBackendDocument('/moderator/submissions/' + reviewId, null)`.
  2. Header: `<h1>` `t('manualReview.similarity.title')`, description `t('manualReview.similarity.description')`, `ButtonLink` `t('manualReview.similarity.back')` to `ROUTES.moderatorSubmission(reviewId)`; the submission title below.
  3. Failed comparison (`batch.status === 'failed'`) → the same alert text as Task 3.5 step 4. No findings → `t(similarityEmptyState(submission, evidence))` (Task 3.5 helper). When `evidence.findingsTruncated`, show `t('manualReview.evidence.findingsShown', { shown: evidence.findings.length, total: evidence.findingsCount })` above the cards. <!-- Updated: Kongming Phase 02 gate -->
  4. One `Card` per finding (sorted by score, highest first): two columns, left heading `t('manualReview.similarity.queryPassage')` with `queryText`, right heading `t('manualReview.similarity.sourcePassage', { story: sourceStoryTitle, chapter: sourceChapterTitle })` with `sourceText`; badge `t('manualReview.similarity.score', { score: Math.round(score * 100) })`; when `llmReview.findingAssessments` has an entry for `finding.id`, a block headed `t('manualReview.similarity.assessment')` with its text. All passage text renders as plain text with `whitespace-pre-wrap`.
  5. Test file with exactly two tests:
     1. `shows each finding next to its source with the AI assessment`: two findings (`f1` score 0.87, `f2` score 0.62) with distinct texts and an assessment for `f1`; texts of both passages, `Điểm tương đồng 87%`, `Đoạn nguồn: Truyện nguồn · Chương nguồn` and the `f1` assessment are visible; `apiRequest` called with `/moderator/submissions/sub-1`.
     2. `explains an empty discovery only after a succeeded comparison`: chapter submission, `findings: []`, terminal batch, attempts include `{ stage: 'comparison', status: 'succeeded' }` → `Không tìm thấy đoạn tương đồng trong NovelHub.`; re-render with attempts lacking a succeeded comparison (batch `failed`, `failedStage: 'embedding'`) → `Chưa có kết quả so sánh tương đồng; không thể kết luận là không trùng lặp.` and the no-findings sentence is absent. <!-- Updated: Kongming Phase 02 gate -->
- **Success criteria:** the page never writes and never calls a provider.
- **Verify:** from `novelhub/frontend` run `npx vitest run test/pages/moderator/SimilarityRiskReviewPage.test.jsx`. Pass: exit code 0 and output contains `Tests  2 passed (2)`.

### Task 3.7 — Live overview and decision history

- **Goal:** `/moderator` shows live counts and short lists; `/moderator/decisions` shows the filterable decision history.
- **Target files and symbols:** rewrite `frontend/src/pages/moderator/ModeratorOverviewPage.jsx` (export `ModeratorOverviewPage`); create `frontend/src/pages/moderator/ModerationDecisionsPage.jsx` (export `ModerationDecisionsPage`); `frontend/src/App.jsx` (lazy imports near line 192, route lines 569-580); create the two test files.
- **Steps:**
  1. Overview: three `useBackendDocument` calls — `/moderator/summary`, `/moderator/submissions?view=queue&page=1`, `/moderator/decisions?outcome=all&scope=mine&page=1`. Render `<h1>` `t('reviewClaims.overview.title')`, description, four count cards labelled `reviewClaims.overview.queue|mine|processing|decidedToday` showing `formatNumber(value)`; a list headed `t('reviewClaims.overview.oldest')` with the first five queue items linking to `ROUTES.moderatorSubmission(id)`; a list headed `t('reviewClaims.overview.recent')` with the first five decisions (title, outcome label `t('reviewHistory.' + outcome)`, `formatDate(occurredAt)`); `ButtonLink`s `t('reviewClaims.overview.openQueue')` → `ROUTES.moderatorSubmissions` and `t('reviewClaims.overview.openHistory')` → `ROUTES.moderatorDecisions`. Each section has its own loading and error state with retry.
  2. Decision history page: state `scope` (`'all'`), `outcome` (`'all'`), `page` (1); `useBackendDocument('/moderator/decisions?outcome=' + outcome + '&scope=' + scope + '&page=' + page, null)`. `<h1>` `t('reviewHistory.title')`, description; `Tabs` with `all` → `t('reviewHistory.scopeAll')`, `mine` → `t('reviewHistory.scopeMine')`; a `Select` labelled `t('reviewHistory.outcome')` with options `all|approved|rejected` → `t('reviewHistory.all|approved|rejected')`; a table with columns `reviewHistory.time`, `reviewHistory.submission`, `reviewHistory.result`, `reviewHistory.reason`, `reviewHistory.moderator`, `reviewHistory.action` (a `ButtonLink` `t('reviewHistory.open')` to `ROUTES.moderatorSubmission(submissionId)`); `Pagination`; loading/error/empty use `t('reviewHistory.loading|error|empty')` and `t('reviewHistory.reload')`. Changing scope or outcome resets `page` to 1.
  3. In `App.jsx`, add a lazy import `const ModerationDecisionsPage = lazy(() => import('./pages/moderator/ModerationDecisionsPage').then(m => ({ default: m.ModerationDecisionsPage })))` after the `SimilarityRiskReviewPage` import (line 196), and replace the `/moderator/decisions` route element (lines 569-580) with `element={role('moderator', <ModerationDecisionsPage />)}`.
  4. `frontend/test/pages/moderator/ModeratorOverviewPage.test.jsx`, exactly one test `shows live counts, the oldest queue items and my recent decisions`: `apiRequest.mockImplementation(path => ...)` returning `{ queue: 3, mine: 1, processing: 2, decidedToday: 4 }` for `/moderator/summary`, one queue item titled `Chương chờ lâu`, one decision titled `Chương đã duyệt` with `outcome: 'approved'`; assert the labels `Chờ kiểm duyệt`, `Tôi đang giữ`, `Đang chờ AI`, `Tôi đã quyết định hôm nay` each sit next to their numbers (`3`, `1`, `2`, `4`), `Chương chờ lâu` links to `/moderator/submissions/<id>`, and `Chương đã duyệt` with `Đã phê duyệt` is visible; the three paths above were requested.
  5. <!-- Red Team: group 14 --> `frontend/test/pages/moderator/ModerationDecisionsPage.test.jsx`, exactly one test `lists all decisions and filters mine and rejected outcomes`: first call `/moderator/decisions?outcome=all&scope=all&page=1`; row shows `Cần sửa phần tóm tắt.` and a `Xem gói duyệt` link to `/moderator/submissions/<submissionId>`; click `Quyết định của tôi` → a call with `outcome=all&scope=mine&page=1`; drive the custom `Select` the way `frontend/test/components/admin/AuthorApplications.test.jsx:75-76` does: `fireEvent.click(screen.getByRole('combobox', { name: 'Kết quả' }))`, then `fireEvent.click(screen.getByRole('option', { name: 'Từ chối' }))` → a call with `outcome=rejected&scope=mine&page=1`.
- **Success criteria:** `/moderator/decisions` no longer renders `RoleUtilityPage`.
- **Verify:** from `novelhub/frontend` run `npx vitest run test/pages/moderator/ModeratorOverviewPage.test.jsx test/pages/moderator/ModerationDecisionsPage.test.jsx`. Pass: exit code 0 and output contains `Tests  2 passed (2)`.

### Task 3.8 — Delete unused mock data

- **Goal:** no moderator mock data remains except the one still used by the out-of-scope reports page.
- **Target files and symbols:** `frontend/src/data/mock/moderation.js` (lines 1-119).
- **Steps:**
  1. Delete the `moderationStats`, `urgentModerationItems` and `submissionQueue` exports (lines 1-119, up to the blank line before `export const communityReports` at line 120). Keep `communityReports` unchanged.
- **Success criteria:** no file imports the deleted names.
- **Verify:** from `novelhub` run `git grep -n -E "moderationStats|urgentModerationItems|submissionQueue" -- frontend`. Pass: exit code 1 and no output.

## Todo List

- [x] Task 3.1 — Repair the moderator locale blocks
- [x] Task 3.2 — Moderator image URLs and route helpers
- [x] Task 3.3 — Error-code mapping
- [x] Task 3.4 — Live submission queue
- [x] Task 3.5 — Live review detail with evidence and decision
- [x] Task 3.6 — Similarity page for one submission
- [x] Task 3.7 — Live overview and decision history
- [x] Task 3.8 — Delete unused mock data
- [x] Regression gate

## Regression gate

1. From `novelhub` run `npx prettier --write --ignore-unknown` followed by every file created or modified in this phase. Pass: exit code 0.
2. From `novelhub/frontend` run `npx vitest run`. Pass: exit code 0 and the `Test Files` summary line contains `passed` and does not contain `failed`.
3. From `novelhub/frontend` run `npm run lint`. Pass: exit code 0.
4. From `novelhub/frontend` run `npm run i18n:check`. Pass: exit code 0 and output contains `Nguồn nội dung tiếng Việt hợp lệ`.
5. From `novelhub/frontend` run `npm run icons:check`. Pass: exit code 0 and output contains `Folio verified`.
6. From `novelhub/frontend` run `npm run build`. Pass: exit code 0.
7. From `novelhub/backend` run `npx vitest run`. Pass: exit code 0 and the `Test Files` summary line does not contain `failed`.
8. From `novelhub` run `npm run format:check`. Pass: exit code 0 and output contains `All matched files use Prettier code style!`.

## Risk Assessment

| Risk | Likelihood × impact | Mitigation |
|---|---|---|
| UI and API shapes drift | Medium × Medium | The contract is copied above from Phase 01; tests assert exact request paths and bodies. |
| A stale page submits a decision against changed evidence | Medium × Medium | The body carries `expectedVersion` and the batch id and version; 409 codes map to a reload message. |
| Removed mock exports break the reports page | Low × Low | `communityReports` stays; Task 3.8 greps for the deleted names. |
| The UI preview (`/ui-preview/pNN`) and `pageRegistry` demo links (`frontend/src/data/pageRegistry.js:29,31`) now show API errors | High × Low | Accepted: they render real error states; content reports are out of scope. [UNVERIFIED: the preview routes were not rendered during planning.] |

Rollback: revert this phase's commits; the backend API is unaffected.

## Security Considerations

- Authorization stays on the server; the UI only hides controls the API reports as not allowed.
- Package text, feedback and AI output render as plain text (no `dangerouslySetInnerHTML`); images load from the checksum-verified moderator endpoint with credentials.

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
