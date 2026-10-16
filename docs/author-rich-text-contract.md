# AUT-04 — Versioned chapter text contract

## Scope

The contract supports structured text without changing Mongoose models or
automatically migrating existing MongoDB records. The frontend now offers an
explicit rich editing mode, preview and structured conflict resolution; see
`author-rich-editor.md`. AUT-04 remains partial because media is outside this
text-only contract.

## API

- Existing chapter GET without a query retains its plain response and refuses to
  flatten rich or unknown source revisions.
- GET `/api/author/stories/:storyId/chapters/:chapterId?format=rich` returns
  `chapter.document` and `formatVersion: blocks-v2`. A valid blocks-v1 draft is
  adapted in memory only; reading creates no revision and changes no versions.
- Chapter POST accepts the legacy `{title, paragraphs}` or `{document}` to create
  a structured draft (including duplication) atomically.
- Existing PUT accepts either the legacy `{title, paragraphs, expectedVersion}`
  or `{document, expectedVersion}` exclusively. Rich saves create a new blocks-v2
  ContentRevision using the existing transaction, author ownership lock, source
  freeze checks and chapter version conflict guard. Old revisions are retained.
- A plain save cannot overwrite blocks-v2. A rich save cannot overwrite an
  unknown source format or a source containing media references.

Example document:

```json
{
  "title": "Chương một",
  "blocks": [
    {"type": "heading", "level": 2, "inlines": [{"text": "Mở đầu", "marks": []}]},
    {"type": "paragraph", "inlines": [{"text": "Tiếng Việt", "marks": ["bold", "italic"]}]},
    {"type": "scene-break"},
    {"type": "quote", "inlines": [{"text": "Lời trích dẫn", "marks": []}]}
  ]
}
```

Heading levels 2/3, paragraph, quote and scene-break are supported. Inline marks
are bold/italic/underline, unique and sorted on validation for stable ordering.
Empty blocks use an empty inline array. Span strings must be nonempty, valid
Unicode. Each text block is limited to 20,000 UTF-16 units across its spans,
1,000 spans and the document to 1,000 blocks. Unknown properties, block types,
marks, raw HTML nodes, links and image nodes are rejected. Text is text; clients
must render it as escaped text, never as raw HTML.

Author drafts, dashboard and story workspace derive their text/word counts from
all text blocks and join inline spans before counting. Scene breaks do not count
as prose. This projection is display-only and never used to save a rich revision.

## Validation and remaining work

API integration tests use a temporary MongoDB replica set, not the user's shared
database. They cover persisted rich round-trip, Unicode, legacy adaptation without
writes, immutable original revisions, canonical mark ordering, stale writes,
foreign ownership, frozen sources, lossy-save rejection and malformed AST inputs.
Related draft, dashboard, workspace and submission suites are included in regression.

Submission validation now accepts validated text-only blocks-v2 packages and
freezes the exact AST with the existing package digest and rights checks. Published
chapter APIs and Guest/Reader canvases render the same text structure/marks.
No automatic approval, publication, frontend mock data or database migration is
introduced. Media is reserved for AUT-06 and its ownership/rights checks.

## Private illustrated drafts

Text-only blocks-v2 remains unchanged. Private images use the separate blocks-v3 contract; see author-chapter-images.md for ownership, revision media manifests, editing and submission limits.
