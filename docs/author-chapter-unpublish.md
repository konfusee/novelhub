# Author chapter unpublication

An active Author can unpublish an owned published chapter through the existing lifecycle endpoint:

`POST /api/author/stories/:storyId/chapters/:chapterId/lifecycle`

The strict request contains `action: "unpublish"`, `expectedVersion` and `expectedStoryVersion`. The parent must be published or unpublished and not frozen. This action does not accept a client status, change ownership, delete content or grant approval. Former Authors and unrelated Admin/Moderator roles cannot use the Author endpoint.

The transaction locks current Author authority and checks both captured versions. It changes only publication state/transition metadata and the chapter/parent versions, then records `chapter.unpublished` with actor, time, target version and a digest binding the published revision. The published/current/draft pointers, revision records, chapter number, first release date and original publication date remain intact. Audit failure rolls the entire transition back. Concurrent identical writes yield one success and one stale-state error; the UI requires a reload after a conflict.

Unpublication does not mutate entitlements, prices, the early-access end, wallets or ledgers. Existing entitlements cannot bypass the unpublished state. Previously released earlier chapters retain their first-release markers, so unpublishing one does not block later first releases or unpublish other chapters. No refund is created.

The manager uses a server `canUnpublish` hint and the existing confirmation dialog. The notice explains preservation of content/history and paid rights. A successful response must identify the actual chapter in the unpublished state before the UI claims completion. The row remains in the manager and is available through the “Đã gỡ xuất bản” filter. The shell, editor, preview and draft lifecycle actions remain in place.

Validation: 39 related backend tests and 21 frontend tests passed, covering retained snapshots/release dates, paid rights/access windows, auth/ownership, frozen parents, stale/concurrent writes, forged status/republish requests, audit rollback, confirmation and row refresh. Browser verification uses isolated MongoDB and fixture human approvals, with desktop/laptop/tablet/mobile and light/dark checks. Production/shared records are not auto-approved or unpublished by verification.

## Correcting unpublished chapters

The manager now offers “Tạo bản sửa chương” for the exact owned, approved, immutable package bound to an unpublished chapter. The server supplies the source submission ID/version; the confirmation uses the existing `/author/submissions/:submissionId/revise` endpoint. The submission history exposes the same action only when server eligibility allows it, with wording that distinguishes an unpublished correction from a rejection response.

The endpoint rechecks current authority, source version, parent state and chapter binding, then verifies the old package before copying it. It creates one editable child revision and preserves the immutable old revision, publication binding, first release date and original publication date. The new revision has no approval, rights declaration or package signature. Rich text and illustration manifests remain intact; an illustrated correction requires a new image rights declaration at resubmission. The original approved submission is historical and is not rewritten as a new decision.

Correction validation: 84 related backend tests and 38 frontend tests passed across the focused runs, covering private text/image corrections, exact source and history eligibility, concurrent replay, preservation of immutable content, fresh rights at resubmission, corrupt/stale/foreign sources, audit rollback and navigation into the correct editor. Lint, translation/icon checks and production build passed.

Concurrent identical requests return the same fresh revision. Creating the revision also writes the parent story version so a concurrent freeze cannot commit unnoticed. Audit failure rolls back the revision and chapter/parent updates. A source that is still published, stale, corrupt, frozen or owned by another Author cannot create this correction. The UI validates the returned chapter/story before navigating and opens blocks-v2/v3 in the rich editor. A correction or resubmission never makes the chapter public: a new review and explicit publication are still required.

The broader use case remains partial. Moderation/evidence integration, scheduling, early-access configuration and the complete already-published editing lifecycle remain separate work. No backend schema/model changes were made.
