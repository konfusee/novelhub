# Admin Author and unlock statistics

A-UC-09: `/admin/author-statistics` is linked from the finance report and uses Admin-only GET `/admin/author-statistics?period=all|YYYY-MM`. Responses are private/no-store and contain aggregate counts only.

New applications use submittedAt; approval/rejection counts use decidedAt. Vietnam month boundaries and the current observation time apply. Current pending applications and active Authors are explicitly all-time/current counts. Active Authors require both an active Author role and active account, deduplicated by account.

Paid unlocks require a committed UnlockRequest, matching debit amount/effective price and the purchaser's reader-coins wallet. A request counts once; buyers are distinct accounts. Free access, rejected requests, future entries and unrelated wallet entries do not become paid unlocks. The report writes no financial data and exposes no buyer/application profiles.

Validation: two backend integration tests covering month boundaries, status distinctions, current role eligibility, privacy and read-only behavior; two new UI tests plus two finance-page regressions. Targeted lint, locale validation and production build passed. Desktop browser data checks are recorded in [browser acceptance](admin-author-browser-acceptance.md); exhaustive responsive acceptance remains separate.
