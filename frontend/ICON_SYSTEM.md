# NovelHub Folio

Original SVG interface drawings for NovelHub. The book spine and folded page inform the visual language: open shapes, clean diagonals, rounded ends. The brand mark combines an open book and N; it is also the favicon.

- Source: `src/components/icons/iconPaths.js`.
- React components: `src/components/icons/index.jsx`.
- Preview/search: `/ui-preview#icons`.
- Reusable sprite: `public/novelhub-icons.svg`.
- Brand asset: `public/novelhub-mark.svg`.
- Favicon: SVG plus PNG-backed ICO at 16, 32 and 48 px; mobile touch icon at 180 px.
- Grid: 24 × 24 units; default 1.75-unit stroke; round joins/caps; `currentColor`.
- Live area: every stroke centre line, including curve and arc extremes, stays inside 2–22 on both axes. The `<svg>` clips at its viewBox, so this keeps strokes up to 3 units at least 0.5 unit clear of the edge. `npm run icons:check` measures each drawing and fails outside the live area.
- Composed drawings (`book + …`, `ring + …`) start their extra strokes with an absolute `M`; a relative `m` after a closed base shape moves from that shape's start point.
- Sprite: after changing a drawing, update the same `<symbol>` in `public/novelhub-icons.svg`; `icons:check` fails when they differ.
- Sizes: 16–20 px for compact actions, 24 px for navigation, 32–48 px for categories/states.
- Related names such as Clock/Clock3 and Ellipsis/MoreHorizontal intentionally share geometry.
- Product category glyphs now use the set. Google identity and story/media illustrations retain their distinct meanings.

```jsx
import { BookOpen, Search, NovelHubMark } from './components/icons'

<button aria-label={t('common.search')}><Search size={18} /></button>
<BookOpen title={t('navigation.library')} size={24} />
<NovelHubMark size={24} />
```

Icons are decorative by default (`aria-hidden`). Give icon-only controls an accessible name. Standalone informative icons accept `title`, `aria-label` or `aria-labelledby`. All normal SVG props, refs, `size`, `color`, `strokeWidth` and `absoluteStrokeWidth` are supported. Do not add per-page SVGs for an existing meaning.

## Layout

`nh-grid-12` is always twelve `minmax(0, 1fr)` tracks. Its direct children fill twelve columns by default. `nh-cols-2/3/4/6` select 6/4/3/2-column spans. `nh-sm-cols-*`, `nh-md-cols-*`, `nh-lg-cols-*`, `nh-xl-cols-*`, `nh-2xl-cols-*` use existing Tailwind breakpoint widths.

Main/aside layouts use utilities such as `nh-layout-xl-8-4`, `nh-layout-xl-7-5` and `nh-layout-xl-3-6-3`; they stack below their named breakpoint. Use existing gap tokens/utilities. Weekly calendars, ranking/table rows, intrinsic search/action headers and immersive reading controls may retain task-specific inner layouts.

```jsx
<div className="nh-grid-12 nh-layout-xl-8-4 gap-6">
  <section>...</section>
  <aside>...</aside>
</div>
```

Keep responsive visibility and content ordering in the existing component; preserve scroll wrappers for wide tables. A grid does not automatically fix long labels, fixed inputs or overflowing controls.
