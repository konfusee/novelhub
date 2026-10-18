# Actual data on the Admin overview

The existing Admin dashboard layout now reads Admin-only GET `/admin/dashboard`. KPI cards display current active accounts, active Authors, published stories with a published binding, pending applications, pending reviews and pending withdrawals. The latest four audit events come from immutable AuditEvent records, with private reasons/payloads excluded. Responses are private/no-store and counts/audit rows are read within a snapshot transaction.

The page no longer imports Admin mock datasets or the mock-resource hook. Refresh fetches the endpoint; KPI export creates a CSV containing the currently loaded numeric values. API failures show errors and disable export, without sample fallback.

Unsupported growth, uptime, latency and storage measurements remain unavailable, including removal of the sample TB totals, fake quarterly goals and percentage progress. The original cards, grid, skeletons and empty/error states remain. Maintenance/read-only switches are disabled because no server-control API backs them; they no longer simulate a successful platform change.

This change is scoped to the overview. Detailed Author statistics, finance, monthly payouts and payout operations have their separate real-data routes. No backend schemas changed, no media/AI implementation and no deployment controls were added. Desktop browser checks against disposable MongoDB are recorded in [browser acceptance](admin-author-browser-acceptance.md); unsupported CDN purge is also disabled.
