# AUT-04 — Structured text editor integration

## Behavior

Use **Soạn thảo có định dạng** in the existing chapter editor header (or its
unsupported-format recovery state). The route keeps the existing editor shell
and adds `?mode=rich`; the API read uses `?format=rich`. Reading legacy paragraphs
adapts them in memory; only an explicit save creates a blocks-v2 revision.

Supported tools: bold, italic, underline, heading 2/3, quote, scene break,
dialogue and mention text. Repeating a heading/quote tool returns the selected
blocks to paragraphs. Image insertion remains disabled. Pasted content is plain
text, never trusted HTML. Dragged assets are rejected with an import hint.

The editing DOM is converted to an allowlisted AST; no HTML/CSS, arbitrary nodes,
links or image references are sent to MongoDB. Text is rendered using text nodes
and React elements. Block changes preserve inline children and exclude adjacent
paragraphs that only touch the selection boundary. Undo/redo retains up to 50
structured snapshots; external conflict adoption resets that local history.
Existing server limits still apply (20,000 UTF-16 units per block, 1,000 blocks
and spans per block). A rejected save leaves the typed manuscript available.

## Persistence and review

- Rich save uses the existing ownership, editable/frozen-source, version and
  transaction guards. Plain mode cannot flatten a rich or unknown revision.
- Conflict dialog fetches the complete structured server document. The local
  structured copy remains editable, or the author explicitly adopts the server
  copy as the merge starting point. Checkbox confirmation applies a reviewed
  document/version to the editor; a separate Save writes it. No automatic merge
  or silent overwrite is performed.
- Duplicating a rich draft reads its full document and creates the copy in one
  POST transaction, preserving all headings/inline marks.
- The submission validator (`publishing-text-v2`) accepts text-only blocks-v2,
  requires nonempty text and the existing parent/categories/media/rights checks,
  and freezes the exact revision in the existing submission flow. Evidence still
  remains pending; this change does not auto-approve or publish content.
- Published chapter reads retain headings/quotes/scene breaks/marks and only
  return the published approved/immutable revision. Guest and Reader canvases
  render these structures. Reader highlights split formatted inline intervals
  without changing paragraph offsets or dropping source marks.

## Verification

- Backend integration suites: structured create/save/read, legacy protection,
  rich submission/frozen AST, published catalogue reads and locked chapter
  behavior, all on a disposable MongoDB replica set.
- Frontend suites: DOM/AST round-trip, Unicode and literal markup, selected block
  boundaries, undo/redo, editor save/preview, structured conflict confirmation,
  duplicate preservation and highlights spanning multiple source inline runs.
- Browser on disposable MongoDB: selected bold and headings, save/reload, quote
  scoped to one paragraph, undo, two-tab stale save/compare/apply/save/reload,
  and preview. Responsive checks at 390/768/1024 px, light/dark, keep the existing
  shell and horizontally scrolling toolbar without page overflow.
- Evidence screenshots outside Git:
  `outputs/author-progress-01a13e25/rich-editor/preview-light.png` and
  `preview-dark.png` (relative to the parent WDP301 workspace).

Document import still extracts plain text; preserving Word/PDF layout/images is
not part of this increment. Media ownership and packaging remain AUT-06 work, so
the broader use case is not marked fully complete.
