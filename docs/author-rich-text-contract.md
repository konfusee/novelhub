# AUT-04 — Versioned chapter text contract

## Scope

This increment adds the backend contract for structured text, without changing any
Mongoose models or automatically migrating existing MongoDB records. The current
frontend remains the plain paragraph editor; rich toolbar activation, editing,
preview and conflict merging are the next increment. AUT-04 remains partial.

## API

- Existing chapter GET without a query retains its plain response and refuses to
  flatten rich or unknown source revisions.
- GET `/api/author/stories/:storyId/chapters/:chapterId?format=rich` returns
  `chapter.document` and `formatVersion: blocks-v2`. A valid blocks-v1 draft is
  adapted in memory only; reading creates no revision and changes no versions.
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

The existing submission validator deliberately still refuses blocks-v2 until
review/reader rendering and editor integration are ready. No automatic approval,
publication, frontend mock data or database migration is introduced. Media is
reserved for AUT-06 and its ownership/rights checks.
