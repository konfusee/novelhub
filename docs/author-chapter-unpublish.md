# Author chapter unpublication

An active Author can unpublish an owned published chapter through the existing lifecycle endpoint:

`POST /api/author/stories/:storyId/chapters/:chapterId/lifecycle`

The strict request contains `action: "unpublish"`, `expectedVersion` and `expectedStoryVersion`. The parent must be published or unpublished and not frozen. This action does not accept a client status, change ownership, delete content or grant approval. Former Authors and unrelated Admin/Moderator roles cannot use the Author endpoint.

The transaction locks current Author authority and checks both captured versions. It changes only publication state/transition metadata and the chapter/parent versions, then records `chapter.unpublished` with actor, time, target version and a digest binding the published revision. The published/current/draft pointers, revision records, chapter number, first release date and original publication date remain intact. Audit failure rolls the entire transition back. Concurrent identical writes yield one success and one stale-state error; the UI requires a reload after a conflict.

Unpublication does not mutate entitlements, prices, the early-access end, wallets or ledgers. Existing entitlements cannot bypass the unpublished state. Previously released earlier chapters retain their first-release markers, so unpublishing one does not block later first releases or unpublish other chapters. No refund is created.

The manager uses a server `canUnpublish` hint and the existing confirmation dialog. The notice explains preservation of content/history and paid rights. A successful response must identify the actual chapter in the unpublished state before the UI claims completion. The row remains in the manager and is available through the “Đã gỡ xuất bản” filter. The shell, editor, preview and draft lifecycle actions remain in place.

Validation: 39 related backend tests and 21 frontend tests passed, covering retained snapshots/release dates, paid rights/access windows, auth/ownership, frozen parents, stale/concurrent writes, forged status/republish requests, audit rollback, confirmation and row refresh. Browser verification uses isolated MongoDB and fixture human approvals, with desktop/laptop/tablet/mobile and light/dark checks. Production/shared records are not auto-approved or unpublished by verification.

The broader use case remains partial. Fixing/resubmitting unpublished content and its subsequent review/publication still need a dedicated workflow; the Author cannot directly flip it back to published. Scheduling and early-access configuration are separate work. No backend schema/model changes were made.
