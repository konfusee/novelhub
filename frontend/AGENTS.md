# NovelHub Frontend Engineering & UX Guidelines

## 1. Purpose

This file is the frontend development constitution for NovelHub. It applies to every human or automated contributor working under this directory.

NovelHub's direction is **Magazine / Editorial × Minimalist × Premium & Elegant**. Preserve the existing product rather than redesigning it from scratch. Work in this order:

> Analyze existing code → understand the system → search for reusable patterns → make the smallest consistent change → verify it.

Use these terms consistently:

- **MUST**: required unless a confirmed business requirement explicitly overrides it.
- **SHOULD**: expected; document a concrete reason when deviating.
- **MAY**: optional and context-dependent.

## 2. Product Context

NovelHub supports public story discovery, text reading, audiobook listening, personal libraries, social/content interactions, authoring, chapter management, publishing, moderation, and platform administration.

Roles are Guest, Reader, Author, Moderator, and Admin. An Author is also a Reader in the current account model. Moderator and Admin demo accounts also include Reader access. Workspace navigation must reflect permissions without replacing global application behavior.

## 3. Source of Truth

When sources conflict, use this priority:

1. Confirmed business requirements
2. This `AGENTS.md`
3. Existing design tokens in `src/styles.css`
4. Shared components and shared shell
5. Existing architecture
6. Existing page patterns
7. Official documentation and established best practice
8. Individual preference

Existing code is evidence, not automatically the correct standard. Record recurring inconsistencies under **Existing Technical/UI Debt**; do not silently normalize the whole application during a local task.

## 4. Project Stack

- React 19 with JavaScript and JSX; the repository currently has no TypeScript configuration.
- Vite 8 with `@vitejs/plugin-react`.
- React Router 7 using `BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, and route guards.
- Tailwind CSS 4 through `@tailwindcss/vite`, plus CSS custom properties and a small amount of global CSS.
- Context-based state: auth, theme, locale, and mock data.
- Fetch-based API client in `src/api/client.js` (`apiGet`), proxied to the backend through `/api` in development.
- NovelHub Folio in `src/components/icons/` is the single owned interface icon set (accepted user request, 2026-10-02). Its original SVG paths also supply the public sprite and brand favicon.
- ESLint flat configuration; Prettier uses the repository-root `.prettierrc.json` (single quotes, semicolons, trailing commas, 100 columns) and CI runs `npm run format:check` from the root.
- npm and `package-lock.json` are authoritative for dependencies.
- Google Be Vietnam Pro is imported by `src/styles.css` (full Vietnamese diacritic coverage); the product is sans-serif only.

MUST NOT describe or introduce TypeScript, Redux, CSS Modules, Sass, another router, another icon set, or another UI library as if it already exists.

## 5. Repository Architecture

- `src/App.jsx`: provider composition and current route declarations.
- `src/app/RouteGuards.jsx`: authentication and role authorization.
- `src/app/routes.js`: shared route helpers; prefer extending these instead of scattering newly repeated route strings.
- `src/layouts/index.jsx`: public, workspace, and immersive layout entry points.
- `src/components/shell/AppShell.jsx`: the shared authenticated shell.
- `src/navigation/workspaceNavigation.jsx`: workspace metadata and role-specific navigation.
- `src/components/shared/`: shared header navigation, language switcher, and footer.
- `src/components/ui/index.jsx`: current UI primitives.
- `src/components/public/`, `src/components/reader/`, `src/components/story/`: domain-level reusable components.
- `src/pages/{guest,auth,reader,author,moderator,admin,system}/`: route-level screens.
- `src/context/`: cross-application state and persistence.
- `src/data/mock/`: domain mock datasets; keep these replaceable by API data.
- `src/api/client.js`: fetch-based API transport; `src/components/ApiStatus.jsx` renders backend readiness (shown in the dev panel).
- `src/locales/vi.json`: translation source of truth (the app currently ships Vietnamese only; `npm run i18n:check` validates it).
- `src/styles.css`: Tailwind theme mapping, semantic tokens, global geometry, decoration, focus, responsive, and reader-focus rules.
- `src/data/pageRegistry.js` and `/ui-preview`: visual screen inventory and manual preview surface.

Prefer named exports, relative imports, function components, and existing folder boundaries. Do not add a path alias unless a reviewed system-level proposal approves it.

## 6. Search First — Create Second

Before creating or styling a Button, IconButton, Input, Select, Card, Badge, Modal, Drawer, Tabs, Avatar, page container, section header, story card, cover, header, sidebar, footer, reader control, or navigation item, MUST search its existing implementation and usages.

Primary reuse locations:

- UI primitives: `src/components/ui/index.jsx`
- Application shell: `src/components/shell/AppShell.jsx`
- Global workspace header/account behavior: `src/components/shared/RoleNavigation.jsx`
- Public header: `src/components/public/PublicHeader.jsx`
- Landing footer/back-to-top: `src/components/shared/SiteFooter.jsx` (rendered by `App.jsx` on public landing, authentication, author application and legal routes)
- Story cover: `src/components/story/StoryCover.jsx`
- Public story/content cards: `src/components/public/`
- Reader library cards and settings: `src/components/reader/`

If a component is close but insufficient, SHOULD extend it with a clear variant or prop. MUST NOT create names such as `Button2`, `NewButton`, `CustomButton`, `BetterCard`, or a role-specific duplicate of a shared shell component.

Before modifying a shared component, MUST search every usage with `rg` and verify affected screens.

## 7. Design System

### Tokens

The semantic token source is `src/styles.css`:

- Background: `--page-bg` / Tailwind `bg-page`
- Card/surface: `--card-surface` / `bg-surface`
- Elevated surface: `--elevated-surface` / `bg-elevated`
- Reader surface: `--reader-surface` / `bg-reader`
- Primary text: `--text-primary` / `text-ink`
- Secondary text: `--text-secondary` / `text-muted`
- Border: `--border` / `border-line`
- Brand: `--primary` / `bg-brand`, `text-brand`, `border-brand`
- Accents: orange, purple, and rose through the mapped semantic utilities

MUST use semantic utilities/tokens for product UI. Hard-coded colors are allowed only for intrinsically fixed media/illustration data, reader highlight swatches, or a deliberate canvas preview; add a token before repeating a new product color.

Light and dark values are defined in `:root` and `:root.dark`. In dark mode, page background, surface, and elevated/card surface MUST remain visually distinguishable.

### Typography and shape

- Be Vietnam Pro/sans-serif is the only global type direction. MUST NOT introduce serif fonts.
- Existing primitives commonly use 16–24px (`rounded-2xl`/`rounded-3xl`) radii. Reuse the nearest primitive instead of inventing a page-local shape system.
- Keep headings compact, content-first, and consistent with adjacent pages.
- Do not overuse gradients, glassmorphism, shadows, blur, motion, or decorative motifs.
- The dotted/editorial background and motifs in `src/styles.css` are intentionally quiet and theme-aware. Decorations MUST remain behind content, ignore pointer events, and not reduce form readability.

### Buttons

`Button` supports `primary`, `secondary`, `ghost`, `outline`, `accent` (orange), `tertiary` (purple) and `danger` (soft rose), sizes `sm`/`md`/`lg` and an optional `trailingIcon` circle; `ButtonLink` gives router links the same look. `IconButton` is the icon-only primitive (`tone`, `shape`, `size`). A region SHOULD have one dominant primary action. Use `danger` only for confirmed destructive actions. The full primitive contract (tokens, radius rule, type scale, motion) lives in the 2026-10-12 decision below.

## 8. Shared Application Shell

Authenticated Reader, Author, Moderator, and Admin pages MUST use the layouts in `src/layouts/index.jsx`, which delegate to `src/components/shell/AppShell.jsx`.

The shared shell owns:

- fixed workspace header;
- collapsible/responsive sidebar;
- workspace switcher;
- content offset and minimum page height;
- no footer: workspace screens end with their content (user decision, 2026-10-12).

Pages MUST NOT render another authenticated Header, Sidebar, or Footer. Workspace changes should replace only navigation, workspace label, tabs, and central content.

The public surface uses `src/components/public/PublicHeader.jsx`. `SiteFooter` appears on guest landing (`/`, `/discover`), authentication (`/login`, `/register`, `/join`), author application (`/author/apply`), and public legal pages, coordinated in `src/App.jsx`. Workspace pages do not render it.

## 9. Header Rules

- The workspace header implementation is `SharedWorkspaceHeader` in `src/components/shared/RoleNavigation.jsx`.
- MUST preserve the 64px (`h-16`) workspace header geometry, logo/account placement, search, theme, language, notification, and profile/logout actions across roles.
- MUST keep language switching and theme switching in the same global positions.
- Header labels MUST flex, truncate, hide at established breakpoints, or wrap intentionally; MUST NOT create language-specific widths.
- Reader-specific typography, notes, bookmarks, and chapter controls do not belong in the global header.

## 10. Sidebar, Workspace, and Role Rules

- Workspace metadata and menu configuration belong in `src/navigation/workspaceNavigation.jsx`.
- Authorization belongs in `src/context/AuthContext.jsx` and `src/app/RouteGuards.jsx`; hiding a menu is not authorization.
- Sidebar collapse persistence uses `novelhub.sidebar.collapsed`; changes MUST preserve this state across route, locale, theme, and workspace changes.
- Common Profile, Settings, Account, and Help/Support entries MUST remain structurally stable. Profile is defined once in the shared sidebar for every workspace; the header avatar targets that workspace's profile route.
- Workspace switching MUST show only roles held by the current account and use `ROLE_HOME`.
- Author retains Reader capabilities, including reader purchases/wallet behavior, without duplicating the Reader shell.
- Each distinct navigation item SHOULD resolve to a meaningful route. Do not point unrelated tabs to one route merely to make them clickable.

## 11. Page and Layout Consistency

### Page and tab semantic consistency

- Every page, route, tab, sidebar item, navigation label, and CTA MUST accurately describe the content and primary action it contains.
- Route, page title, active navigation state, breadcrumb (when present), and rendered content MUST represent the same information hierarchy.
- A user who sees only a label SHOULD be able to predict the destination and its primary content.
- Profile is for identity/public-person information; Account is for account-level data; Security is for authentication/session safeguards; Privacy is for visibility/data preferences; Settings is for application or workspace preferences.
- Global Settings MUST remain consistent across workspaces. Workspace-specific preferences MUST not be mixed with unrelated global account settings.
- Global Appearance and Reader appearance are different scopes: global Appearance controls application chrome/theme; Reading Preferences controls the long-form reader canvas and typography.
- User Profile and Author Profile are different concepts. Shared identity data SHOULD be reused; pen name, author biography, storefront, and publishing identity belong to Author Profile.
- New settings MUST be placed in the most semantically appropriate existing category before creating a new tab. Do not over-split one small control or overload a generic tab with unrelated controls.
- Developers MUST search the existing Settings/Profile/Account architecture, route mappings, and translation terminology before adding a section.
- When content is correct and its label is wrong, prefer renaming. When the label is correct and content is misplaced, move the content. Use the smallest information-architecture change that resolves the mismatch.
- VI and EN MUST use one stable terminology mapping; do not alternate between synonyms for the same navigation concept without a product reason.

- Shared page geometry is defined by `.page-public`, `.page-reader`, `.page-author`, `.page-moderator`, and `.page-admin` in `src/styles.css`.
- `PageContainer` in `src/components/ui/index.jsx` is the default standalone content container.
- Related screens MUST align max-width, responsive padding, section gap, heading hierarchy, card treatment, filter placement, table behavior, and state presentation.
- Use flexible `min-width`, `max-width`, grid/flex, `gap`, wrap, and truncation. MUST NOT tune fixed widths for only English or Vietnamese.
- Page shells should be `min-h-screen`/flex-column where appropriate so the footer follows short content and never overlays it.
- Save/discard action bars belong after page content and before the footer, and are shown only while editable values differ from their saved baseline. Saving, discarding or restoring the original values hides the account action bar. Fixed/sticky actions MUST reserve content space and MUST NOT cover the footer.
- Specialized immersive reader/editor pages MAY opt out of standard content width when their task requires it, but not out of theme, accessibility, or i18n requirements.

## 12. Responsive Design

Every change MUST be checked at mobile, tablet, laptop, and desktop widths using the existing Tailwind breakpoints (`sm`, `md`, `lg`, `xl`). Do not introduce arbitrary breakpoints when an existing breakpoint works.

MUST prevent horizontal page overflow, clipped actions, sidebar/content overlap, header wrapping, off-screen dropdowns, viewport-breaking modals, and cropped cards. Wide tables currently use an overflow container plus explicit `min-w-*`; preserve that pattern until a shared responsive table abstraction is adopted.

Mobile sidebar behavior is owned by `AppShell`; pages MUST NOT implement their own competing mobile navigation.

## 13. Light and Dark Theme

Theme state is owned by `src/context/ThemeContext.jsx`, persisted as `novelhub.theme`, and supports `light`, `dark`, and `system`. Components MUST use semantic theme tokens and work in both resolved themes.

Do not reset theme on navigation, workspace change, form submission, or locale change. Do not hard-code white/black for general UI when a semantic token exists. Focus, hover, selected, disabled, borders, and muted text require checks in both themes.

## 14. Internationalization

Locale state is owned by `src/context/LocaleContext.jsx`, persisted as `novelhub.locale`. The shared switcher is `src/components/shared/LanguageSwitcher.jsx`.

- All fixed UI text MUST use `t('namespace.key')`.
- The dictionary is `src/locales/vi.json`. When an English dictionary is added, both files MUST contain the same recursive key set.
- Run `npm run i18n:check` after any locale change.
- Prefer namespaces already established (`common`, `navigation`, `reader`, `auth`, `wallet`, `footer`, `errors`) and add domain namespaces rather than role-specific locale files.
- Use interpolation for variable UI messages; do not concatenate translated fragments when grammar can change.
- Dynamic story titles, author names, usernames, chapter prose, comments, and user-entered content MUST NOT be translated unless demo data explicitly provides localized variants.
- Locale switching MUST not reload the app, change route/workspace, reset theme/sidebar state, or discard form state.
- Buttons, tabs, headers, sidebars, tables, dropdowns, modal titles, tooltips, toast messages, validation, empty/error states, and mobile navigation MUST be checked in both VI and EN.

## 15. Reader Experience

The full reading surface is `src/pages/reader/FullChapterReaderPage.jsx`. Reader controls belong in its Reader Toolbar/drawers, not the global header.

MUST preserve readable width, adjustable font size, line height, paragraph spacing, alignment, focus mode, bookmark, highlight, note, chapter list, and previous/next navigation. Focus mode is coordinated through `data-reader-focus` rules in `src/styles.css`.

Text selection controls must remain keyboard/accessibility-aware and must not obscure selected content on small screens. Reader settings SHOULD persist when the existing implementation already persists them. Long-form prose is dynamic content and is not translated by UI i18n.

`src/components/reader/ReaderSettings.jsx` is the reader settings drawer panel used by `FullChapterReaderPage`; its option sets live in `src/components/reader/readerOptions.js` and it exports the token-styled `ReaderRange` slider. Extend it instead of creating another reader-settings implementation.

## 16. Audio Experience

The current full player is `src/pages/reader/FullAudioPlayerPage.jsx`; compact audio affordances also exist in reader/public cards. New audiobook screens MUST reuse a consistent play/pause meaning, progress representation, speed, volume, chapter navigation, queue behavior, and accessible labels.

Do not create another full audio player. A future global/minimized player is a system-level change and requires a proposal covering state ownership, persistence, route transitions, background playback, and mobile layout.

## 17. Forms and Actions

- Forms MUST have visible labels (a placeholder is not a label), appropriate autocomplete/input types, validation, disabled/submitting states, and success/error feedback.
- Reuse `Input`, `Select`, `Button`, `Modal`, and `Drawer` where suitable.
- Destructive or irreversible actions MUST request confirmation and clearly name the affected object.
- Modal content MUST remain within the viewport and support keyboard operation and focus management. The shared Modal/Drawer close on Escape, move focus into the panel on open and restore it on close; they do not implement a full focus trap; do not claim they do.
- Preserve entered data during locale/theme/workspace UI changes where possible.
- Do not implement only the success path; consider loading, empty, validation error, API error, retry, unavailable, and permission-denied states.

## 18. Accessibility

- Use semantic elements: `<button>` for actions, `<a>`/`Link` for navigation, headings in order, labels for controls, and real table semantics for tabular data.
- Icon-only controls MUST have an accessible name. Decorative icons SHOULD be `aria-hidden`.
- Preserve the global `:focus-visible` treatment in `src/styles.css`; never remove focus without an equivalent.
- Keyboard operation, tab order, escape/close behavior, contrast, alternative text, reduced motion, and touch target size MUST be considered.
- Active tabs/navigation MUST expose state (`aria-selected`, `aria-current`, or equivalent) when the shared primitive supports it.
- Do not use clickable `<div>` elements when a native interactive element is available.

## 19. State, Data, and API

- Auth: `src/context/AuthContext.jsx`; local demo session and users.
- Theme: `src/context/ThemeContext.jsx`.
- Locale: `src/context/LocaleContext.jsx`.
- Mutable demo administration state: `src/context/MockDataContext.jsx`.
- Static domain demos: `src/data/mock/`.
- API transport: `src/api/client.js`, configured by `VITE_API_BASE_URL` (defaults to `/api`).

Keep mock data structured and separate from JSX when it represents backend entities. UI-only option lists MAY remain near the component. Do not add another global state system for local state. Avoid duplicate requests, duplicate derived state, and effects that merely mirror props.

## 20. JavaScript and Code Style

- This is a JavaScript/JSX project. Do not add TypeScript piecemeal without a system-level migration proposal.
- Use function components and hooks; hooks must follow React hook rules.
- Use PascalCase component files and components, camelCase functions/variables, and UPPER_SNAKE_CASE for stable storage keys/constants when appropriate.
- Keep route pages in `src/pages/<domain>` and reusable UI outside `pages`.
- Prefer named exports for components, matching current conventions.
- Use named exports from `src/components/icons/`; add missing meanings to the shared Folio source and SVG sprite. MUST NOT add another icon dependency for a few icons.
- Avoid broad formatting or unrelated refactors in a scoped task.
- Use `rg`/`rg --files` to search before editing.

## 21. Performance

- Do not prematurely optimize, but avoid unnecessary effects, rerenders, duplicated state, oversized images, and importing entire libraries.
- Images SHOULD use the existing lazy/eager pattern in `src/components/story/StoryCover.jsx`, with dimensions/aspect ratios that avoid layout shifts.
- The production bundle currently triggers Vite's >500 kB chunk warning. New large dependencies require evidence and a bundle-impact review.
- Route-level lazy loading/code splitting is a recommended future improvement, not permission to restructure routes during an unrelated task.

## 22. Scope Control and Change Proposals

Local fixes such as spacing, overflow, aria labels, token reuse, translation keys, and small contrast corrections MAY be implemented directly after searching usages.

Before changing the design system, palette, typography, global header/sidebar/footer, breakpoints, component library, routing model, role model, state system, or workspace architecture, write a short proposal:

1. **Problem**
2. **Current Behavior**
3. **Proposed Change**
4. **Benefits**
5. **Risks**
6. **Affected Areas**
7. **Migration**

Do not implement the system-level change until it is reviewed/confirmed. A local task does not authorize a repository-wide redesign.

## 23. Team Feedback and Continuous Improvement

Every contributor MAY propose a better UX, component abstraction, token, accessibility improvement, responsive pattern, or architecture. A suggestion does not become a rule by personal preference or seniority.

Evaluate proposals using:

1. user experience;
2. consistency with the current system;
3. reusability;
4. maintainability;
5. accessibility;
6. responsive behavior;
7. VI/EN behavior;
8. light/dark behavior;
9. benefit versus complexity;
10. compatibility with current architecture.

Prefer evidence from confirmed requirements, the design system, existing reusable patterns, accessibility standards, official documentation, comparative implementations, and team review. “It looks better” is not sufficient evidence.

Update this file when architecture or an accepted shared standard changes. Never edit the guideline only to legitimize an inconsistent implementation.

## 24. Frontend Decision Log

Record only accepted decisions that affect several frontend areas:

```md
### YYYY-MM-DD — Decision title

Context: ...

Decision: ...

Reason: ...

Affected: ...

Status: Accepted / Deprecated / Replaced
```

### 2026-10-01 — Shared workspace application shell

Context: Role pages previously risked diverging headers, sidebars, and footers.

Decision: Reader, Author, Moderator, and Admin use `AppShell` with configuration from `workspaceNavigation.jsx`.

Reason: Preserve global navigation, theme, locale, account actions, footer, collapse behavior, and responsive geometry while changing role-specific navigation/content only.

Affected: `src/layouts/index.jsx`, `src/components/shell/AppShell.jsx`, `src/components/shared/RoleNavigation.jsx`, `src/navigation/workspaceNavigation.jsx`.

Status: Accepted

### 2026-10-01 — Keyed VI/EN locale dictionaries

Context: DOM text mutation and phrase replacement were fragile and did not provide key parity.

Decision: Fixed UI text uses `LocaleContext.t()` with synchronized `en.json` and `vi.json` dictionaries.

Reason: Predictable React rendering, persisted instant switching, interpolation, and automated parity checks.

Affected: `src/context/LocaleContext.jsx`, `src/locales/`, `scripts/check-i18n.mjs`.

Status: Accepted

### 2026-10-02 — Responsive twelve-column grid and owned Folio icons

Context: The user requested twelve-column layouts with mobile adaptation, a replacement favicon and a custom icon set across the system.

Decision: Main layouts and compatible content collections use `.nh-grid-12` with responsive spans; main panels fill twelve columns on mobile. All active Lucide imports now use NovelHub Folio, and brand placements share the book/N mark. Table rows, calendars and immersive controls may keep intrinsic inner layouts.

Reason: Consistent fluid geometry and an editable, original icon family without a new dependency. Existing routes, palette, typography and workspace behavior are preserved.

Affected: `src/styles.css`, `tokens.css`, page layouts, all icon consumers, category cards, `src/components/icons/`, `/ui-preview#icons`, `index.html`, public favicon/brand/sprite assets. See `UI_SYSTEM_CHANGE.md` and `ICON_SYSTEM.md`.

Status: Accepted through the user's explicit system-wide request.

### 2026-10-02 — Control clipping and short-page geometry

Context: User screenshots showed missing pill borders, overlapping search labels, a mock-only hero carousel and a footer too close to empty notification content.

Decision: Keep form font inheritance in Tailwind's base layer so component size/weight utilities apply. Shared button hover/press feedback must not move controls outside clipped rails. Tabs wrap whole labels at intrinsic widths. Workspace content fills at least one small viewport, and standard page containers reserve 64–96 px before the footer. Hero controls and search pagination update real local content, with counts derived from the current mock dataset.

Reason: Fix the reported behavior while preserving routes, twelve-column content layouts, palette and existing component ownership.

Affected: Shared CSS/UI primitives, public home/categories/search, search result cards and notification filter rails. Verification is recorded in `UI_SYSTEM_CHANGE.md`.

Status: Accepted through the user's explicit request to fix buttons, navigation, page length and text overflow.

### 2026-10-02 — Profile navigation, current-page state and conditional actions

Context: The user reported a missing sidebar Profile entry, horizontal overflow on collapsed-icon hover, header links with no current-page indication, an always-visible account save bar, and a wrapping author status filter.

Decision: Add Profile once to the shared common sidebar navigation for all workspaces. Collapsed links show immediate hover/focus tooltips portaled outside the vertical scroller, with horizontal overflow disabled and focus clearance retained. Tooltips dismiss on Escape, blur, pointer leave, navigation, scroll or resize. Header navigation shows the current route with a brand underline, stronger weight and `aria-current`, including route aliases. Account actions render only when email differs from its saved baseline and offer discard/save. Shared Tabs supports an opt-in `singleRow` mode; author status filters use it and scroll horizontally on narrow screens.

Affected: `AppShell`, `RoleNavigation`, account forms, shared `Tabs`, and the author dashboard. Existing profile routes, collapsed-state persistence, vertical navigation scrolling and wrapping tabs elsewhere are preserved.

Status: Accepted through the user's explicit navigation, save-bar and one-line tab requests.

### 2026-10-12 — UI polish foundation (palette, type scale, primitives, shell)

Context: The user asked for an agency-grade polish that keeps their colors and layout. `tokens.css` declared `--text-lg/xl/2xl/3xl`, which silently overrode Tailwind's scale (`text-xl` rendered 31 px, `text-3xl` 49 px but `text-4xl` 36 px), the workspace header overflowed at 1280–1440 px, and caller `className` overrides such as `p-0` on `Card` never applied because Tailwind orders same-property utilities by value.

Decision: Accent tokens use the user's exact hex values (light/dark). Text on filled jade/orange/purple/rose uses `text-on-*` tokens; tinted text uses `text-*-strong`. Tailwind's own text scale is restored and the workspace scale is exposed as `text-h1/h2/h3/body/caption` (`text-display` for public heroes). Motion uses `ease-spring` (also the default transition curve); shadows are tinted (`shadow-whisper/soft/lift/float`, Tailwind `shadow-sm…2xl` remapped). Radius rule: buttons, inputs, selects, tags and tabs are pills; cards `rounded-3xl`; bezel shells 32 px. Primitives add `ButtonLink`, `Reveal`, `ProgressBar`, `EmptyState`, `Card bezel/interactive/as`, `IconButton tone/shape/size`, `Input trailing`, `Tabs item.icon`, and honour caller padding/radius/size overrides. Workspace header hides the duplicate Explore/Wallet links and the workspace chip below 2xl. The public header becomes a floating island. The unused `RoleLayout`, `PublicLayout`, `ReaderImmersiveLayout` and `SharedSidebarCommon` were removed.

Affected: `tokens.css`, `src/styles.css`, `src/components/ui/index.jsx`, `AppShell`, `RoleNavigation`, `PublicHeader`, `SiteFooter`, `StoryCover`, `SectionTitle`, `src/layouts/index.jsx`, `DevPanel`.

Status: Accepted through the user's explicit redesign-polish request.

### 2026-10-12 — UI moved to `main`; page polish and shared cascade fixes

Context: The 36-screen UI lived on branch `HuyNHHE190724`; `main` held only a static shell. The user asked to port it to `main` and polish every page without changing colors or layout.

Decision: The UI now lives in the `main` workspace (`react-router` v8, Tailwind via `@tailwindcss/vite`, root Prettier config, `src/api/client.js` instead of the unused Axios client). Element-level base rules (`main/section` width reset, heading weight/tracking/`text-wrap`, `p/li` wrapping, link/button `nowrap`, `.min-h-screen.bg-page > *`) live in `@layer base` so Tailwind utilities override them. The legacy ≤480 px first-section `h1`/`p` overrides are removed. `Button`, `IconButton` and `Badge` accept a caller display utility (`hidden sm:inline-flex`). `Tabs` keeps the active single-row tab scrolled into view and accepts `className`. Programmatically focused containers (`tabindex="-1"`) get no focus ring. Pages inside `AppShell` render a `div` root; `AppShell` owns the single `<main>` landmark, and public pages switch to `div` when `embedded`.

Affected: every route page, `src/components/public/*`, `src/components/reader/*` (new `readerOptions.js`), `src/styles.css`, `src/components/ui/index.jsx`.

Status: Accepted through the user's explicit port-and-polish request.

### 2026-10-12 — Loading states, overlays, mobile chrome and reader navigation

Context: User review asked for skeleton loading, chapter transitions with a choice of navigation (button, swipe, continuous scroll), one-screen auth pages, a 12-column landing, custom dropdowns, no footer inside the app, SVG trend arrows, uncropped icons and a mobile pass.

Decision: Route pages are lazy-loaded behind `RouteFallback` with a global `TopProgress`. Data regions read mock data through `useMockResource(key, data)` (`MockDataContext`), which returns `loading | ready | empty | error` with DevPanel-controlled latency/simulation, and render `Skeleton`/`SkeletonText`/`SkeletonCard` placeholders shaped like the final layout and `EmptyState` (`tone="rose"` for errors with retry). `Select` is a custom WAI-ARIA listbox; `Trend` renders ↑/↓ change strings with Folio arrows; Folio drawings must stay inside the 2–22 live area (`icons:check`). `Modal`/`Drawer` are portaled to `<body>`, lock scrolling, and `Drawer` is a bottom sheet below 640 px with its own backdrop. Sticky page chrome uses `--app-header-h`. The reader offers `Cuộn liên tục` (default), `Vuốt ngang` and `Nút bấm` chapter navigation with direction-aware chapter transitions. `SiteFooter` renders only on the guest landing.

Affected: `App.jsx`, `MockDataContext`, `ui/index.jsx`, shell/header components, `components/reader/*`, `components/auth/AuthShowcase.jsx`, every route page.

Status: Accepted through the user's explicit review requests.

### 2026-10-13 — Authentication footer and reading panels

Context: The user requested a four-column footer on sign-in/sign-up, readable author agreements, quiet scrollbars, and settings that do not dim the reading canvas.

Decision: Public authentication, author application and legal routes share the footer through App.jsx. Legal reading modals use approximately two-thirds desktop width; author registration presents a document pane beside its checklist. Drawer supports an opt-in docked variant without backdrop or scroll lock for reader settings. Reader toolbar orientation is persisted with reading preferences. All scrollable surfaces use the shared quiet scrollbar rules.

Reason: Keep documents readable and let readers preview setting changes while continuing to read.

Affected: App.jsx, JoinPage, AuthorApplyPage, SiteFooter, ui/index.jsx, ReaderSettings, FullChapterReaderPage, styles.css.

Status: Accepted through the user's explicit requests.

## 25. Deprecated Patterns

- **DOM-wide translation via `MutationObserver` — DEPRECATED.** Use keyed dictionaries through `useLocale()`.
- **Role-specific duplicated application shells — DEPRECATED.** Use `AppShell` plus workspace navigation configuration.
- **Page-local footers — DEPRECATED.** `App.jsx` owns `SiteFooter` on public landing and authentication routes. Workspace pages have no footer.

## 26. What NOT To Do

- Do not duplicate Header or Footer.
- Do not create a new Sidebar or change collapse behavior per role without an approved proposal.
- Do not copy/paste an entire page or shell only because the role differs.
- Do not hard-code colors when a semantic token exists.
- Do not hard-code fixed UI text that requires VI/EN translation.
- Do not add a font, icon library, UI library, state library, or CSS system casually.
- Do not create duplicate shared components or “new/better/custom” variants by filename.
- Do not redesign the application during a small task.
- Do not optimize only desktop or test only light mode.
- Do not break the shell when switching workspace.
- Do not change shared components without searching usages.
- Do not place reader controls in the global header.
- Do not render action bars over content or footer.
- Do not make decorations sit above forms or intercept pointer events.
- Do not use `window.location.assign` for ordinary internal navigation when React Router can preserve app state.
- Do not add more hard-coded demo route strings when `src/app/routes.js` can express them.
- Do not update the design system based only on personal taste.

## 27. Before Coding Checklist

1. Read this file completely.
2. Understand the confirmed task and avoid expanding its scope.
3. Identify the route, layout, workspace, and permission boundary.
4. Search existing components and all usages of shared code.
5. Search tokens and similar page patterns.
6. Check locale keys and both language lengths.
7. Check light/dark behavior.
8. Check mobile/tablet/desktop behavior.
9. Identify persisted state that must survive the change.
10. For a system-level change, prepare the proposal before editing.

## 28. After Coding Checklist

Run the commands that apply, then manually verify the affected flows:

- lint;
- locale key parity;
- production build;
- browser console/runtime behavior;
- desktop, tablet, and mobile;
- light and dark;
- Vietnamese and English;
- keyboard/focus behavior;
- loading, empty, success, error, and permission states where relevant;
- no duplicate component/CSS/shell;
- no footer/header/sidebar regression;
- no lost route, form, locale, theme, or sidebar state.

There is currently no TypeScript/typecheck. `npm test` runs the Vitest suite (currently `ApiStatus`); do not claim browser, accessibility or E2E automation that does not exist.

## 29. Commands

Run from the repository root (npm workspaces):

```bash
npm run dev:frontend
npm run lint -w frontend
npm test -w frontend
npm run i18n:check -w frontend
npm run icons:check -w frontend
npm run format:check
npm run build -w frontend
```

Use `npm run format` only when intentionally formatting files; avoid repository-wide formatting in a small change.

## 30. Existing Technical/UI Debt

These are observations, not authorization for an unrelated refactor:

- `src/App.jsx` is a large route registry and contains hard-coded `RoleUtilityPage` copy. Routes and translated route metadata should eventually become declarative and reuse `src/app/routes.js`.
- Many page-level labels, placeholders, modal/toast messages, table headings, empty states, and validation messages remain hard-coded after the first i18n foundation pass. Complete migration by domain and keep VI/EN key parity.
- Several literal colors remain in pages and reader settings. Separate fixed media/highlight colors from repeated product colors, then promote repeated product values to semantic tokens.
- `src/components/ui/index.jsx` is a growing single-file primitive module. It lacks a full modal focus trap, tab ARIA semantics, field help/error APIs, Tooltip, Toast, Pagination, and responsive Table abstractions.
- Internal navigation sometimes uses `window.location.assign`, causing avoidable full reloads and state loss.
- Route definitions are largely centralized in `App.jsx`, while `src/app/routes.js` is only partially adopted.
- Large tables rely on horizontal scrolling with page-local minimum widths; a shared responsive table pattern is not yet available.
- Audio UI exists in a full player and multiple compact cards without shared playback state; a minimized/global player would require a reviewed architecture.
- Auth and mock contexts surface hard-coded English error messages that still require i18n.
- Theme resolution reads `matchMedia` during render and does not expose a centralized subscription value; verify behavior before adding system-theme-sensitive components.
- The main JavaScript bundle currently exceeds Vite's 500 kB warning threshold; route-level code splitting is a future performance priority.
- Automated tests cover only `ApiStatus`; there is no component/E2E/accessibility suite for pages and no TypeScript safety. CI (`.github/workflows/ci.yml`) runs format check, lint, tests and build.
- Responsive and theme checks are primarily manual through `/ui-preview`; status values in `pageRegistry.js` do not prove complete accessibility or responsive verification.

## 31. Nested Guidelines

Do not create nested `AGENTS.md` files yet. The current code is organized by page role but still shares one shell, one token system, one UI primitive module, and one locale system. Reader-specific rules are captured above. Add a nested guideline only when a domain becomes an independently maintained feature package with genuinely different constraints.
