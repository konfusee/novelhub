# Published chapter illustrations

An approved free `blocks-v3` chapter can now be published through the same confirmation as text chapters. Preparation and the final transaction inspect actual WebP bytes and compare the manifest with the immutable submission. Publication pins media versions inside the transaction; an audit error rolls back publication, rights/approval pins and media attachments. No schema or storage model changes were required.

The public reader API preserves the ordered AST, inline formatting, alt text and captions. Existing v1 text responses retain their previous shape. The existing reading canvas renders illustrations with the same figure treatment as private previews and retains prose when an image cannot load. The private preview and submitted-package URLs remain unchanged.

`GET /api/catalog/stories/:storyId/chapters/:chapterId/revisions/:revisionId/media/:mediaId` serves only an image in the currently published revision and an approved submission with active asserted rights. It reuses the exact chapter visibility and early-access checks used for text. A request for another revision or an image outside the package fails; a frozen checksum mismatch fails even if library bytes and metadata were replaced together. The endpoint returns `image/webp`, `nosniff` and `private, no-store`, so unpublishing a chapter/story stops new requests. This cannot retract bytes a reader already downloaded.

Library assets stay private; their ordinary owner URLs still require authentication. Only the package-bound published endpoint exposes approved illustrations. Catalog behavior for suspended authors is preserved: the current catalog anonymizes the author label while retaining published content until its publication state changes. This increment does not invent an account-wide content removal policy.

The access guard also rejects missing, expired, revoked or wrong-revision early-access entitlements. This is defensive support for existing paid records; this release operation still cannot publish an early-access chapter or change its price.

Validation: 12 focused backend tests cover illustrated publication, exact image/revision binding, private-library access, unpublication, catalog visibility, entitlement checks, checksum replacement, corrupt bytes, inactive rights and transaction rollback. The related 57 chapter/catalog/media tests passed; four new reader/image component tests passed alongside editor/package/reader regressions. A browser run on isolated MongoDB confirmed publication, actual image decoding, bold text and captions in the existing reader at desktop/laptop/tablet/mobile sizes in light/dark themes. Human approval and evidence completion are explicit isolated test fixtures; shared data is never auto-approved.

Still separate: cover/banner snapshots, scheduled publication, configuring early access, moderation decisions and evidence workers. The broad media and publishing use cases remain partially complete.
