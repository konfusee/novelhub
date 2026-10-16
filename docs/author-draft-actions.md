# Author draft actions and reading preview

## User-facing changes

- Editor and story manager expose PDF / Word / TXT / MD import. The existing
  extraction flow supports PDF, DOC, DOCX, TXT and MD and preselects the story
  from `?storyId=`. It creates new draft chapters after review, not an implicit
  overwrite of the chapter currently being edited. Unsaved editor changes use
  the existing leave confirmation.
- Draft cards and chapter rows offer a confirmed delete action. The server
  verifies author ownership, editable private draft conditions and both chapter
  and story versions. Published/scheduled/frozen/reviewing content is protected.
- Deletion is a retained-history tombstone using existing chapter status and
  publicationTransition fields, not a schema change or physical purge. Content
  revisions remain in MongoDB. Deleted chapters are hidden from workspaces,
  chapter lists, draft cards and dashboard counts; direct editor reads return
  404 and restore/write attempts are refused. Their order keys move below zero
  inside the same transaction to free positive chapter positions for ordering
  and new/manual/imported chapters. Audit failure rolls back the transaction.
- Reader-style private preview is available from story manager and draft cards,
  including unpublished content. It loads the full owned revision, not a card
  excerpt or public published fallback. Preview has chapter navigation and font,
  width and line-height controls using the reader's primitives/options and
  typography/surface geometry. It does not record reading events or progress.
- Editor modal preview uses the same canvas with current unsaved text. Preview
  settings stay local. Text/marks are rendered as React text/elements, never HTML.

## Submission checklist repair links

Failed checks now have specific destinations:

| Check | Destination |
| --- | --- |
| Editable/version | Story review/status panel |
| Content | Chapter editor or story details |
| Active categories | Story details |
| Unsupported media | Story media panel with support explanation |
| Approved parent | Story submission package without chapter selection |

Manager tabs use the `tab` query parameter so direct links open the intended
panel and remain meaningful on reload/back. Links do not grant permissions,
approve submissions, remove media or bypass server validation. Media packages
remain unsupported by the submission workflow, and review can still require
waiting for a decision. After edits, use the checklist's refresh action.

## Validation

- 41 backend tests passed across lifecycle, ordering, story lifecycle, document
  import and dashboard suites on a temporary MongoDB replica set.
- 44 frontend tests passed across preview, submissions, drafts, manager, lifecycle
  dialog, import and editor suites. Tests stay under `frontend/test`.
- Backend/frontend lint, production frontend build, locale and icon checks passed.
- Browser on temporary MongoDB: PDF upload/extraction and actual draft save;
  target story preselected; editor modal and full chapter preview; delete dialog
  cancellation; parent-check repair link opened story rights form. Delete
  persistence/ownership/version checks were exercised by integration tests.
- Preview checked at 390, 768 and 1024 px in light/dark, without horizontal page
  overflow. Browser console had no error/warning entries. Screenshots are local
  evidence outside the repository under `outputs/author-progress-01a13e25/draft-actions`.

Rich editor editing/merging, media ownership/storage, moderation evidence workers
and publication are separate remaining work. This increment does not mark the
broader authoring use cases complete.
