# MongoDB data migration

## Current checkpoint

Broad frontend rewrites were restored at the user's explicit request on 2026-10-15. Preserve the original UI/UX. Categories, search, story metadata/chapter lists, guest preview, full reader, personal library, reading history, notifications and the workspace header balance/unread indicator now use database APIs, retaining their existing page structure and controls. Other frontend screens still use their original mock sources; the whole migration is **not complete**. Existing pre-migration PublicHeader edits and the user's deleted AuthorApplyPage test were left untouched.

The next checkpoint connects SearchResultsPage, StoryDetailPage metadata/chapter lists and GuestReaderPreviewPage prose to the public catalogue API, retaining their original page structure and reader controls. Search filter counts derive from the returned records; story ratings, followers, author statistics and publication dates come from MongoDB. Legacy story slugs and `chapter-N` routes resolve to persisted IDs; unknown chapters return 404 rather than showing chapter one. The importer safely adds missing aliases on rerun without overwriting content.

Validation: 27 frontend tests pass, including real API-response rendering and chapter ID navigation, and the importer integration test verifies legacy URLs against disposable MongoDB. Production build, lint and 789 Vietnamese translation keys pass. Actual database counts remain unchanged after alias migration. Browser checks cover search → story → preview using the configured database. StoryCommunity, follow/bookmark mutations, the full authenticated reader and other screens remain migration work; this checkpoint does not mark them complete. Search currently requests up to 100 records and paginates those locally; server-side facets/pagination are required before larger catalogues.

The user clarified that old mock records should be reference input for MongoDB, using the existing backend schemas. No backend model/schema files were changed. Category descriptions, icon/tone choices and editorial curation are persisted separately in `catalogPresentation`; this cannot change domain ownership, publication or balances.

The importer was run against the configured `novelhub` database and independently verified: 9 categories, 29 stories, 38 chapters, 67 content revisions, 6 publication submissions, 5 notifications and 2 wallets; 22 stories are published. Existing accounts and documents were preserved. The old display-only figures such as `14.2K` remain reference metadata; public category counts are calculated from actual published story revisions. Do not create thousands of fake records merely to reproduce those labels.

`npm run db:seed-reference -w backend` imports once atomically. Stable IDs and an append-only audit marker make reruns insert-only/idempotent. It is restricted to development/test. Missing optional DEV_SEED_PASSWORD uses an undisclosed random password for new reference accounts; existing users' credentials are untouched. `node backend/scripts/verify-reference-data.js` independently checks the configured database without printing connection credentials.

Source samples using USD, bonus coins or tips are not copied into incompatible financial transactions: packages follow the existing 1 VND = 1 coin model, and reference opening balances are explicitly labeled ledger adjustments. Bank transactions, processing outputs and real media/audio files are not fabricated. Importing content is not a claim that all frontend features have been integrated.

Requested 2026-10-15: replace frontend business fixtures with authenticated API reads and durable MongoDB writes. UI constants (labels, icons, supported formats) remain code; business records and metrics must come from the database. Do not seed production with the old demo records.

## Contract

- Reuse the existing cookie API client and Mongoose models. No second database or browser business-data store.
- Public discovery reads only published revisions. Draft metadata must never replace a published snapshot.
- Empty collections render empty states. Network/server failures render retryable errors. Neither case falls back to fixtures.
- Owner routes scope every query to the authenticated account; staff routes require the relevant server-side role.
- Money, moderation decisions and publishing require their domain transitions; a successful browser timer is never evidence of completion.
- Migrate and verify domain by domain. This document does not claim that unmigrated screens are complete.

## Work packages

1. Public categories, catalogue, search and story/chapter reading.
2. Author stories, revisions and chapter drafts; category administration.
3. Library, follows, history, notifications, profile/preferences and community.
4. Wallet/ledger, revenue and payouts.
5. Moderation, staff dashboards, configuration and audit.
6. Remove fixture imports, simulation provider, fake mutations and demo navigation; verify all routes and a clean database.

Completion requires no production dependency on `src/data/mock`, no fabricated business counters or fake successful mutations, and passing DB-backed access/isolation tests. Test fixtures belong only in tests.

## Full reader checkpoint

FullChapterReaderPage and ChapterSegment now read published story/chapter records through the catalogue API. The old readerChapters helper that rotated one mock body across 148 generated chapters was removed. Continuous scroll, swipe, buttons, the chapter drawer, focus mode and reader settings retain their existing components and layout. Navigation uses persisted chapter IDs and handles gaps in orderKey; unknown chapters never fall back to the first chapter.

Reader progress uses the existing ReadingProgress schema, scoped to the authenticated account and exact published revision. Position is a fraction from 0 to 1. Writes reject forged owners, mismatched revisions, unpublished chapters and locked chapters without entitlement. Resume restores only matching revisions; a failed progress read cannot overwrite saved progress. The end-of-story follow button now writes to the existing Follow API. Device typography settings, existing local bookmarks and annotations remain unchanged; the latter two still need a supported persistence contract before the overall migration is complete.

Browser validation used an isolated disposable MongoDB replica set and existing login flow, without changing shared accounts: real chapter navigation, continuous/button settings, mobile layout without horizontal overflow, dark/light controls, and a persisted 63% position read back through the API and restored on reload. Frontend tests additionally cover gaps in chapter numbering, unknown chapters and saving the returned revision ID. Shared database schemas remain untouched.

## Library, history and header balance checkpoint

PersonalLibraryPage uses `/reader/library`: active owner Follow records, approved published snapshots, matching published chapter revisions and account ReadingProgress. The card resume link uses its actual chapter ID; progress is calculated across published chapters. Removing a card persists Follow removal before refreshing, and a failed write leaves the card visible. Grid/list views, filters, covers and original page structure are retained. Offline-download and manual-completion menu entries no longer report fake success; they explain the current limitation.

ReadingHistoryPage uses `/reader/history` and `/auth/sessions`, keeping the original statistics, chart, history cards and sidebar. It shows the latest saved record per chapter/mode, not invented session events. Clearing history atomically removes lastReadAt from this account's progress records while preserving position/revision and follows, so the library can still resume. Other accounts are unaffected. Genre percentages derive from actual visible history records and sum to 100. Missing elapsed-time, daily-streak and user-goal data are shown as unavailable, not replaced with the old fixed figures; existing schemas do not store the telemetry/configuration required to infer them reliably.

SharedWorkspaceHeader reads `/reader/balance` for the owner's reader-coins or author-earnings wallet. Missing data is displayed as unknown while loading or on error, and zero only after a successful database response. The fixed 450 balance is removed. No wallet amounts are mutated by this work.

Validation includes the complete 32-test frontend suite before an additional removal-failure case, the updated 3-case collection component suite, and the 4-case MongoDB reader integration suite with owner isolation, balance, history-clear and progress-preservation assertions. Build, lint and 789 translation keys pass. Browser checks used disposable MongoDB: six reference follows, actual progress/links, 1,420 reader coins, real session device, grid/list, mobile without overflow and light/dark. Shared database records and model/schema files were not changed.

## Notification checkpoint

NotificationsPage now fetches owner-scoped, paginated Notification records. Read/unread, read-all, soft deletion and undo call the API, then reload persisted state; failed writes retain existing cards and show an error. Older notifications load real pages; the footer no longer invents a 30-day limit. Existing cards, icons, filters, skeletons and responsive layout are preserved.

The API only projects approved presentation fields, gives author-application decisions readable titles and `/author/apply` links, and builds internal destinations from validated story IDs or known workspace routes. Arbitrary payload links/private fields are not serialized. Imported reference notifications are labeled as reference, including legacy reward/audio claims; importing those messages does not create a financial reward or audio file. Email/push preference claims are removed because no such preference contract exists in the unchanged schemas.

The workspace bell reads the real unread count and refreshes after successful notification mutations. Backend integration tests verify ownership, read state on undo, pagination, cross-account restore rejection, counts and link validation. All 36 frontend tests pass, including 3 notification component tests for persistence, undo, failure and pagination. The full-reader async test now allows 3 seconds for its two-stage API load under concurrent test workers, keeping the same assertions. Build, lint and Vietnamese translation checks pass; schema/model files are unchanged.

Browser checks used disposable MongoDB and the normal login flow: five imported notifications, unread count 2 → 0 after read-all, persisted read state on revisiting the page, filter selection, header indicator refresh, and mobile light/dark layout without horizontal overflow. Console warnings/errors were empty. The temporary server/database are stopped after validation; shared account notifications are not modified by browser testing.
