# Author publication of approved free chapters

`GET /api/author/stories/:storyId/chapters/:chapterId/release` prepares eight server checks and the exact chapter, story, submission and revision versions. `POST` accepts only `revisionId`, `submissionId`, `expectedVersion` and `expectedStoryVersion`. Both endpoints require an active Author who owns the story. Preparation is private and not cached.

Publication requires an approved immutable chapter package with matching digests, an asserted rights declaration and a matching terminal evidence batch. A recorded embedding/comparison/LLM failure permits a human-approved package; it is never relabelled as successful evidence. Pending or intermediate evidence cannot be released, even if an inconsistent record says approved.

The parent must already be published with a valid approved immutable package and asserted rights. The story must not be frozen. Every preceding non-deleted chapter must have `firstReleasedAt`; an ordinary archived draft still blocks release, while a previously released and subsequently unpublished chapter does not. Only draft tombstones marked `author-draft-deleted` are skipped.

This increment releases free `blocks-v1` and `blocks-v2` chapters. `earlyAccess.enabled` blocks publication even after a recorded access window expires: this operation never changes pricing or access policy. Illustrated `blocks-v3` packages remain blocked until a public image adapter is implemented. Scheduled, due, unpublished, archived and cancelled chapters do not enter publication through this endpoint.

The transaction locks Author permissions, pins the parent story version and both approvals/rights declarations, binds the public chapter to its approved revision, preserves the set-once `firstReleasedAt`, and records `chapter.published`. Inherited declarations are pinned only once. Audit failure rolls back every write. Concurrent identical requests return one publication and a replay, without changing release dates or writing a second audit. An independently approved replacement preserves the first release time; a UI for revising already published chapters remains separate work.

The existing manager row exposes “Phát hành chương” from a server eligibility hint. The shared release dialog fetches actual checks, links to the immutable submission package, and requires confirmation. Stale/error results stay visible without claiming success. After publication the workspace refreshes from MongoDB and the existing catalog and reader consume the approved snapshot. No backend schema/model changes or frontend domain fallback data were added.

Validation: 21 chapter-publication tests plus 17 metadata-publication and one workspace regression (39 backend tests); 24 frontend tests for both release dialogs and manager. Lint, translation/icon checks and production build passed. Browser verification uses real APIs and an isolated disposable MongoDB replica set; human approval/evidence states are explicit test fixtures, never a bypass of moderation on shared data. Check desktop, 1024px laptop, 768px tablet and 390px mobile in light/dark themes and confirm the public reader renders bold inline text after release.

Remaining: moderation decisions and evidence workers, public images, scheduling, early access, and the lifecycle/revision flow for already published chapters. AUT-03/AUT-10 remain partially complete.
