# Authoring and publishing implementation

This document records the implementation boundary for Field 2 and maps the latest Author use cases to the repository.

| Use case | Frontend screen | Backend boundary |
|---|---|---|
| UC-AUT-02, UC-AUT-02.1–02.3 | `AuthorWorksPage`, `CreateStoryPage`, `StoryManagerPage` | `author-content.routes.js`, `author-story-list.js`, story lifecycle and workspace services |
| UC-AUT-03, UC-AUT-03.1–03.4 | `StoryManagerPage`, `ChapterEditorPage`, `DraftsPage` | chapter lifecycle, order and content routes |
| UC-AUT-05 | `ImportPdfPage` | `author-import.routes.js`, document extraction service |
| UC-AUT-08 | `ChapterEarlyAccessDialog` | `author-early-access.js` and policy lookup |
| UC-AUT-09–11 | `SubmissionReviewPage`, `SubmittedPackagePage`, `AuthorPreviewPage` | `author-submissions.routes.js`, moderation submission contract |
| UC-AUT-12 | `AuthorAnalyticsPage` | `/author/analytics`, `author-analytics.js` |
| UC-AUT-13, UC-AUT-14, UC-AUT-17, UC-AUT-18 | `AuthorEarningsPage` | `/author/earnings`, `modules/coins-payouts/finance/author-earnings.js`, `modules/coins-payouts/finance/author-payouts.js` |

Submitted revisions are frozen. A rejected revision is revised into a new editable draft, while a published revision remains live until an approved replacement is released. Rights declarations and media digests are checked when a package is submitted and retained with the submitted package.

A story package includes its cover and banner. At prepare, `imageRights` lists the digest of the
`story-media-v1` manifest (`mediaId`, `role` cover/banner, checksum, size, type, storage), and the
submission must echo it as `imageManifestDigest`. Submit rechecks each image (owned, scoped to the
story, of its kind, available, matching bytes), pins it and folds the manifest digest into the
rights and package digests; a mismatch returns 409 `media_changed`. Moderators see exactly those
images through the claim-protected `GET /moderator/submissions/:id/images/:mediaId`
(`metadata.cover`/`metadata.banner`), release checks the approved revision's images, and cleanup
keeps every image referenced by a revision or its frozen manifest. Story packages frozen before
this format keep their empty manifest and original digests; their cover is listed without a URL.

The owned story list now returns each story's main category, chapter counts, latest review status,
updated time and the safe-delete flag. Delete is an append-only lifecycle transition:
only a never-published draft with no open submission can be marked as deleted, so the
audit trail remains available while the story disappears from the Author workspace.

The Author workspace uses the shared authenticated shell, navigation metadata and semantic design tokens from `frontend/AGENTS.md`. New screens must reuse those primitives and keep loading, empty, error, permission and mobile states visible. The historical AI writing assistant prototype is not part of the current Author screen flow.
