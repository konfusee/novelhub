# NovelHub — 12-column grid and owned icon set

Status: Accepted through the user's explicit request on 2026-10-02.

## Problem

The tab still displays the Vite favicon. Interface icons come from Lucide and assorted Unicode symbols. Main page layouts use unrelated fixed sidebar widths.

## Current behavior

The app shares semantic color tokens, role shells and responsive navigation. Main layouts often use one fluid track plus a fixed pixel track; mobile layouts generally stack.

## Proposed change

Keep the existing routes, copy, typography, palette and shell behavior. Use a shared twelve-track CSS grid with explicit responsive spans for main layouts and compatible card collections. Stack main panels across twelve columns on mobile. Create NovelHub-owned 24-unit line icons and a book/N brand mark; replace all active Lucide imports and interface category glyphs. Keep third-party identity marks and story illustration data distinct from interface icons.

## Benefits

Predictable alignment, fluid side panels, mobile defaults, one editable icon source, and recognizable tab/application branding.

## Risks

Wide tables and dense controls still require their own overflow containers. Check all roles, mobile sizes, locales and themes after migration. A twelve-column grid alone does not guarantee a responsive screen.

## Affected areas

Shared CSS/tokens, page layouts, every current Lucide consumer, category cards, logo placements, HTML metadata and public favicon assets.

## Migration

Preserve icon component names/props for callers and move imports to the owned module. Use shared grid utilities instead of duplicating page-specific CSS. Provide an icon gallery and reusable SVG sprite. Run lint, locale parity, build and browser layout/runtime checks.

## Verification — 2026-10-02

- `npm run lint`, `npm run icons:check`, `npm run i18n:check`, `npm run build` and `git diff --check` passed.
- Browser checks covered 39 routes at 320, 375, 414, 768, 1024 and 1440 px in light/dark themes: 468 cases, no detected page overflow, visible content/control overflow, non-twelve-track migrated grids or runtime exceptions.
- Guest header checked separately at every width/theme. Screenshots reviewed for mobile and desktop workspaces and the icon gallery.
- Mobile navigation opens/closes on route selection; theme toggle works; sidebar collapse persists after reload. All 166 SVG paths render, gallery search returns matching icons, and its empty state works.
- Build retains the existing large-bundle warning; route splitting is outside this change. The app currently supplies Vietnamese content only; no English parity check is claimed.
