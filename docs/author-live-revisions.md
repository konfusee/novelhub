# Revise a chapter while its approved version stays published

UC-AUT-11 (progress workbook numbering) now supports creating a private revision from an approved, published chapter without first unpublishing it. The Author manager and submission history expose the existing revision action for this source.

- The clone, subsequent saves and resubmission keep chapter publication status and `publishedRevisionId` unchanged. Submitted revisions remain immutable and cannot be edited directly.
- Draft titles/content are returned only to the owner editor/workspace. The public chapter record retains the released title until replacement publication; public readers continue following the old published binding.
- Manual Moderator approval, rejection and revision requests update the new review cycle without hiding the existing published chapter. The target version is pinned even when publication status remains unchanged.
- A replacement still needs exact package, rights, parent, order, evidence and version checks. Approval alone does not swap the public revision. Explicit Author release updates the binding and title together.
- Original revisions, review history, first-release time and early-access terms remain intact. Replayed clone requests do not create competing drafts; stale/foreign/frozen inputs retain their existing guards.

Integration tests cover owner edits, private title/content, immutable old revision, continued public reads during submission/approval, real human review with a live claim, explicit replacement release, and prior unpublished revision behavior. No model/schema changes or AI/media implementation.
