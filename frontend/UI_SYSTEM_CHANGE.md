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

## Follow-up — control clipping, navigation and footer spacing

The screenshot defects were caused by shared hover translation inside clipped filter rails, an unlayered font reset overriding button/input typography, fixed-width search tabs, and short workspace content. The hero arrows only opened mock alerts; search pagination changed its selected number without changing results.

The fixes keep the existing visual system and routes:

- Put form font inheritance in the base layer; use press brightness without global button translation and reserve space around filter rails for borders/focus.
- Reuse intrinsic, wrapping shared tabs with exposed selection state. Let result titles/authors wrap, keep bookmark controls from shrinking, shorten cover badges and wrap duration/action rows when necessary.
- Give workspace content a minimum height of `100svh` and standard page containers 64–96 px of bottom padding before the footer.
- Replace hero alerts with a three-position carousel supporting arrows, direct indicators, wrapping and accessible labels. Preserve the welcome artwork and use existing covers for the featured stories; give the mobile art panel enough height to separate cover and caption.
- Paginate the current four-item search mock in two-item pages, reset pagination when query/tab changes, derive displayed counts from results, and honor initial `q` / `format=audio` links. Author actions switch back to story results.

Verification: 39 routes × six widths (320, 375, 414, 768, 1024, 1440) × light/dark passed all 468 layout/runtime checks. Focused checks covered hero arrows/indicators and wrapping, changed pagination content, tab resets, empty search, audio/query links, hover border containment, internal button/card overflow and empty-notification footer spacing at every width/theme. Mobile and desktop screenshots were reviewed. Lint, icon checks, Vietnamese content checks, build and whitespace checks passed. Existing API/mock limitations and the large-bundle warning remain.

## Follow-up — sidebar labels, active navigation and save actions

- Add Profile to the shared sidebar for all four workspaces and target the matching profile from the header avatar.
- Show a single immediate hover/focus tooltip outside the sidebar scroller. Keep vertical scrolling and focus clearance without a horizontal scrollbar; dismiss the tooltip on Escape, pointer leave, blur, navigation, scroll or resize.
- Mark the current header destination with a brand underline, stronger weight and `aria-current`, including public, library, search and author-wallet aliases.
- Show account save/discard actions only when email differs from the local saved form baseline; hide them after saving, discarding or returning to the saved value.
- Keep author status tabs on one horizontal row through the shared `Tabs.singleRow` variant. Narrow screens scroll within that row; story rows wrap their action when necessary so the title retains readable width.

Verification: 48 role/width/theme sidebar and account edit/revert/discard/save flows passed at six widths in light/dark themes. All 60 active-header route checks and 12 final single-row/title checks passed. Expanded-sidebar header geometry was also checked at 1280, 1440 and 1920 px. All 110 collapsed-icon hover checks passed, along with keyboard focus/Escape, horizontal containment, navigation cleanup, tablet scroll dismissal and mobile navigation. Mobile/desktop screenshots were reviewed. Lint, locale/icon integrity, production build and whitespace checks passed. Account persistence remains the existing local mock behavior.
