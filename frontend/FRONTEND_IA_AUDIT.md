# NovelHub Frontend Information Architecture Audit

Date: 2026-10-01

Scope: route, page, tab/sub-tab, global and workspace navigation, settings/profile/account semantics, active state, and primary CTA naming. This audit is based on rendered component content, not filenames alone.

## A. Page and Tab Inventory

### Public and authentication

| Route | Visible purpose | Important tabs/sections |
|---|---|---|
| `/`, `/discover` | Discover/Home | hero, categories, featured, continue reading/listening |
| `/browse`, `/categories` | Browse Categories | category filters and collections |
| `/search` | Search Results | All Results, Stories, Audiobooks, Authors |
| `/rankings` | Editorial Rankings | ranking type and time period |
| `/stories/:storyId`, `/story/:storyId` | Story Detail | synopsis, chapters, author, preview/listen actions |
| `/stories/:storyId/preview/:chapterId` | Guest Reader Preview | chapter preview and account CTA |
| `/login`, `/register`, `/join` | Authentication | sign-in/register mode and account type |
| `/terms`, `/privacy` | Legal content | Terms or Privacy document |

### Reader

| Route | Visible purpose | Important tabs/sections |
|---|---|---|
| `/reader` | Reader Home | continue, recommendations, updates, collections |
| `/reader/explore` | Explore/search | embedded Search Results |
| `/reader/library` | My Library | format/status filters and library cards |
| `/reader/following` | My List & Following | saved/followed stories and authors |
| `/reader/history` | Reading History | Reading, Listening, Completed |
| `/reader/notifications` | Notifications Center | notification feed/filter actions |
| `/reader/profile` | Reader Profile | identity, avatar, handle, bio, favorite genres |
| `/reader/settings/*` | Reader Settings | Reading, Listening, Appearance, Privacy, Security |
| `/reader/account` | Account | placeholder utility page; account semantics intended |
| `/reader/wallet` | Wallet & Coins | balance, recharge, transactions, FAQ |
| `/read/:storyId/:chapterId` | Full Chapter Reader | reader toolbar, chapter navigation, highlights, notes |
| `/listen/:storyId/:chapterId` | Full Audio Player | playback, chapters, queue/cast |

### Author

| Route | Visible purpose | Important tabs/sections |
|---|---|---|
| `/author` | Author Dashboard | All, Published, In Review, Drafts |
| `/author/stories/:storyId` | Story Manager | Chapters, Details, Media, Reviews, Analytics |
| `/author/stories/new` | Create Story | story metadata and creation workflow |
| `/author/stories/:storyId/chapters/:chapterId/edit` | Chapter Editor | Outline, Notes, AI Assistant, Checklist |
| `/author/drafts` | Drafts | draft search/filter/edit/create |
| `/author/import` | Import PDF | upload, extraction, destination |
| `/author/media` | Media Library | covers, art, maps, narration assets |
| `/author/ai` | AI Writing Assistant | suggestions, lore, editorial tools |
| `/author/submissions` | Submission Review | preflight, notes, pipeline, history |
| `/author/analytics` | Author Analytics | readership, retention, demographics |
| `/author/earnings` | Earnings & Payouts | placeholder utility page |
| `/author/profile` | Author Profile | placeholder utility page; pen-name/storefront semantics intended |
| `/author/settings` | Author Settings | placeholder utility page |
| `/author/wallet` | Reader Wallet for Author | placeholder utility page |

### Moderator

| Route | Visible purpose | Important tabs/sections |
|---|---|---|
| `/moderator` | Operations Dashboard | workload, actions, audit stream |
| `/moderator/submissions` | Editorial Submission Queue | status/genre/risk filters, assignment |
| `/moderator/submissions/:submissionId` | Content Review Detail | chapters, specs, decision workflow |
| `/moderator/reports` | Reports Queue | Open, In Review, Resolved, Escalated |
| `/moderator/similarity-review/:reviewId` | Similarity Risk Review | comparison and resolution |
| review/history/settings/profile/account/support routes | Named utility destinations | currently generic utility content |

### Admin

| Route | Visible purpose | Important tabs/sections |
|---|---|---|
| `/admin` | Platform Operations Dashboard | Signups, Story Ingestion, Coin Royalty |
| `/admin/users` | Users & Accounts | All, Readers, Authors, Moderators |
| `/admin/users/:userId` | Author Revenue Agreement | revenue split and agreement state |
| `/admin/roles` | Roles & Permissions | permission modules and policy matrix |
| `/admin/categories` | Content Configuration | Categories, Tags, Ratings, Lifecycle |
| `/admin/settings` | Platform Settings | services, global configuration, audit |
| `/admin/preferences` | Admin Settings | personal workspace preferences placeholder |
| services/audit/moderation/transactions routes | Operational destinations | currently generic utility content |

## B. Correct Mappings

- **Home/Discover**, **Categories**, **Search Results**, **Rankings**, and **Story Detail** labels match their primary content and actions.
- **My Library** contains owned/saved/continued text and audio items with format and progress filtering; it is not a discovery page.
- **Reading History** tabs correctly distinguish reading, listening, and completed records.
- **Wallet & Coins** contains balance, top-up packages, transactions, allocation information, and FAQ.
- **Full Chapter Reader** keeps reading controls inside a reader toolbar/drawers rather than the global header.
- **Author Dashboard**, **Drafts**, **Create Story**, **Chapter Editor**, **Import PDF**, **Media Library**, **Submission Review**, and **Author Analytics** have names that closely match rendered content.
- **Submission Queue**, **Reports Queue**, **Content Review Detail**, and **Similarity Risk Review** describe their actual moderator workflows.
- **Users & Accounts**, **Roles & Permissions**, **Categories & Content Configuration**, and **Platform Settings** match the admin content rendered by their dedicated pages.

## C. Naming Mismatches

| Severity | Previous label/page | Actual content | Resolution/status |
|---|---|---|---|
| Major | Reader Profile & Preferences under `/reader/profile/*` | public profile mixed with reading, audio, theme, privacy, and 2FA | Fixed: Profile is identity-only; preferences now live under `/reader/settings/*`. |
| Major | `Privacy & Security` tab | one visibility control plus 2FA | Fixed: split into Privacy and Security tabs/routes. |
| Major | Admin common `Settings` → `/admin/settings` | platform-wide service/config/audit controls | Fixed: common Settings now uses `/admin/preferences`; Platform Settings is explicitly in Platform navigation. |
| Moderate | Author sidebar `My Stories` → `/author/stories/demo` | manager for one specific demo story | Fixed label to `Story Manager`; a real My Stories index remains recommended. |
| Moderate | Reader Notifications page existed without Reader sidebar destination | notifications feed | Fixed: added Notifications to Reader Activity navigation. |
| Major | Profile/Settings/Account/Support and several operational `RoleUtilityPage` routes | generic metrics and story activity rows unrelated to most titles | Not safely fixable as a naming-only change; replace with domain-specific pages/components. |
| Minor | `Explore` and `Search Results` are two labels for substantially the same search experience | same embedded search component | Keep `Explore` as navigation intent and `Search Results` as result-page title; document consistently in VI/EN. |

## D. Content Placement Issues

- Reading canvas, typography, listening defaults, application appearance, privacy, and security were placed under Reader Profile. They now belong to Reader Settings.
- Two-factor authentication was grouped with privacy. It now belongs to Security.
- Admin system configuration was presented as a shared personal Settings destination. System settings and personal workspace settings are now separated at the route/navigation level.
- Author Profile correctly intends pen name, biography, verification, and storefront, but its current generic activity implementation does not yet render those fields.
- Account routes intend sign-in methods, contact information, devices, and security but currently render generic workspace records.

## E. Duplicate and Overlapping Sections

- Reader appearance existed both as reading canvas choices and global app theme. The new structure distinguishes **Reading Preferences** (canvas/typography) from **Appearance** (Light/Dark/System).
- Reader settings controls exist in both `ReaderProfilePage.jsx` and the older `components/reader/ReaderSettings.jsx`; converge implementations before extending either.
- Search is exposed through public `/search` and authenticated `/reader/explore`; this is acceptable only while labels communicate context and both use the same search behavior.
- Generic `RoleUtilityPage` is reused beyond its semantic capacity. Reuse of a visually shared frame is appropriate; reuse of unrelated metrics/content is not.
- Profile is accessible through the header account avatar, while workspace-specific Author/Moderator/Admin profile routes also exist. Establish a shared User Profile plus a distinct Author Profile instead of duplicating identity data.

## F. Global vs Workspace Issues

Recommended ownership:

| Global account area | Workspace-specific area |
|---|---|
| User Profile: avatar, display name, handle, shared bio | Author Profile: pen name, author bio, banner/storefront, verification |
| Account: email, login methods, account status, linked devices | Author publishing defaults and revenue agreement |
| Appearance: app theme | Reader typography/canvas/reading width |
| Language | Reader playback/listening defaults |
| Privacy | Moderator queue/availability preferences |
| Security | Admin personal workspace preferences |
| Notification preferences | Admin Platform Settings |

Current role utility routes describe this distinction in route copy but do not yet implement domain-specific content. A shared settings/account component with workspace extension slots is preferable to four copied pages.

## G. Route and Active-State Issues

- Fixed legacy `/reader/profile/{reading,listening,appearance,privacy}` URLs with redirects to the corresponding `/reader/settings/*` routes.
- Fixed Settings sidebar activation for Reader preference sub-routes through the existing prefix matcher.
- Fixed Admin settings ambiguity by routing common Settings to `/admin/preferences` and placing `/admin/settings` under Platform Settings.
- `workspaceNavigation.jsx` performs prefix matching and chooses the longest match. New routes must preserve this invariant.
- Story Manager tabs currently change local state but do not have distinct URLs. Deep-linkable tabs are recommended if users must bookmark/share a specific manager section.
- Most tab controls do not synchronize with query/path state, and the shared Tabs primitive lacks `aria-selected`/tablist semantics.
- Breadcrumb usage is page-local and inconsistent; where present, it must match route, title, active sidebar, and visible content.

## H. VI / EN Issues

- Shared shell/navigation dictionaries use stable terms such as Profile → Hồ sơ, Settings → Cài đặt, Account → Tài khoản, and Platform Settings → Cài đặt nền tảng.
- Added synchronized EN/VI terminology for Story Manager and Platform Settings.
- Many page-level headings, tabs, placeholders, modal/toast messages, filters, and validation strings are still hard-coded English. This is a cross-domain migration, not a safe naming-only patch.
- Recommended terminology:

| English | Vietnamese |
|---|---|
| Profile | Hồ sơ |
| User Profile | Hồ sơ người dùng |
| Author Profile | Hồ sơ tác giả |
| Settings | Cài đặt |
| Admin Settings | Cài đặt quản trị viên |
| Platform Settings | Cài đặt nền tảng |
| Appearance | Giao diện |
| Theme | Chủ đề giao diện |
| Language | Ngôn ngữ |
| Account | Tài khoản |
| Security | Bảo mật |
| Privacy | Quyền riêng tư |
| Notifications | Thông báo |
| Reading Preferences | Tùy chọn đọc |
| Listening Preferences | Tùy chọn nghe |
| My Library | Thư viện của tôi |
| Story Manager | Quản lý truyện |

Do not alternate `Cài đặt`, `Thiết lập`, and `Tùy chỉnh` for the same Settings concept without a deliberate distinction.

## I. Recommended Information Architecture

```text
Global account
├── User Profile
├── Settings
│   ├── Appearance
│   ├── Language
│   ├── Notifications
│   └── Privacy
├── Account
│   ├── Contact & login
│   ├── Security
│   └── Sessions/devices
└── Help & Support

Reader extension
├── Reading Preferences
└── Listening Preferences

Author extension
├── Author Profile
├── Publishing Defaults
├── Agreement
└── Earnings & Payouts

Moderator extension
└── Queue & availability preferences

Admin extension
├── Personal Admin Settings
└── Platform Settings
```

Do not implement this whole tree by copying pages. First create a shared global account/settings model, then add workspace-specific sections only where business behavior differs.

## J. Files Affected by Safe Fixes

- `src/App.jsx`
- `src/pages/reader/ReaderProfilePage.jsx`
- `src/components/shell/AppShell.jsx`
- `src/navigation/workspaceNavigation.jsx`
- `src/locales/en.json`
- `src/locales/vi.json`
- `AGENTS.md`
- `FRONTEND_IA_AUDIT.md`

## Deferred High-Impact Work

1. Replace generic account/settings/profile/support `RoleUtilityPage` content with shared semantic components.
2. Create a real `/author/stories` index, then restore the `My Stories` navigation label to that route.
3. Complete VI/EN migration for all page-level text.
4. Make important tabs deep-linkable and update the shared Tabs primitive with ARIA tab semantics.
5. Define one breadcrumb component and hierarchy source.
6. Add automated route-title-active-state and locale terminology tests.
