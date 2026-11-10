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
| UC-AUT-13, UC-AUT-14, UC-AUT-17, UC-AUT-18 | `AuthorEarningsPage` | `/author/earnings`, `controllers/author/finance.controller.js`, `services/author/finance.service.js` |

Submitted revisions are frozen. A rejected revision is revised into a new editable draft, while a published revision remains live until an approved replacement is released. Rights declarations and media digests are checked when a package is submitted and retained with the submitted package.

The owned story list now returns category labels, chapter counts, latest review status,
updated time and the safe-delete flag. Delete is an append-only lifecycle transition:
only a never-published draft with no open submission can be marked as deleted, so the
audit trail remains available while the story disappears from the Author workspace.

The Author workspace uses the shared authenticated shell, navigation metadata and semantic design tokens from `frontend/AGENTS.md`. New screens must reuse those primitives and keep loading, empty, error, permission and mobile states visible. The historical AI writing assistant prototype is not part of the current Author screen flow.
