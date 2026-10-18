# UC-AUT-07–16 implementation acceptance

Updated 18 October 2026. IDs follow the progress workbook, whose numbering differs from `docs/source/use-case-list.md`. Completion here means implemented UI/API and passing automated integration/component checks in the agreed text-content scope. Media and AI are deferred by user decision and do not reduce completion. This does not certify live banking, production SMTP delivery or new browser visual acceptance.

| Workbook ID | Accepted behavior | Result |
| --- | --- | --- |
| UC-AUT-07 | Immutable rights assertions/source notes, inherited chapter rights, validation at submission and publication, historical declarations retained | Actual/Pass |
| UC-AUT-08 | Policy-bounded early access, fixed first-release price/window, scheduled release rollback/retry, atomic paid unlock/allocation, free reading at expiry | Actual/Pass |
| UC-AUT-09 | Immutable submitted package, ownership/format/rights checks, manual Moderator admission/claim/decision with exact versions and reasons | Actual/Pass |
| UC-AUT-10 | Actual decision history/notifications, actionable release checklist, exact approved free/paid publication, scheduling and visibility transitions | Actual/Pass |
| UC-AUT-11 | Fresh revisions after feedback or approval, continued old public chapter during private edit/review, explicit approved replacement, original packages/history retained | Actual/Pass |
| UC-AUT-12 | Actual view/identity/progress/return/cohort statistics, chapter/story/range filters, verified unlock income and CSV | Actual/Pass |
| UC-AUT-13 | Actual Author earnings wallet, credited chapter sales/distinct buyers, negotiated allocation snapshots and current payout readiness | Actual/Pass |
| UC-AUT-14 | Own earnings ledger with period/direction/cursor filters, real allocation/withdrawal entries, no Reader-wallet leakage | Actual/Pass |
| UC-AUT-15 | Manual withdrawal superseded by system monthly evaluation; no manual request added | Superseded |
| UC-AUT-16 | Monthly evaluation, private bank configuration, sealed payout rows, Admin Failed/Paid, matching paid slips, email outbox, former-Author financial access and deletion settlement | Actual/Pass |

Evidence from actual commands in this task:

- Final early-access/statistics/earnings/sales/transactions/payout/monthly-job/former-Author group: 53 backend tests passed across 8 suites. Final frontend production build passed.

- Latest publication/submission/manual-review group: 69 backend tests passed, including real human review and replacement of a still-live chapter. Submission-review/manager group: 31 frontend tests passed.
- Financial access/bank/payout-history group: 16 backend and 10 frontend tests passed. Subsequent payout-summary consistency group: 16 backend tests passed.
- Monthly job/final settlement/email/history group: 35 backend tests passed; Admin result/history group also passed. Monthly Admin reconciliation received its own backend and frontend checks.
- Verified analytics/chapter-sales integration: 7 backend and 16 frontend tests passed. Readiness/earnings: 4 backend and 6 frontend tests passed.
- Targeted lint/format checks, Vietnamese locale validation and frontend production builds passed for the changed groups. These are targeted groups, not a claim that the entire repository test suite or browser matrix ran.

Detailed behavior and safeguards are documented in `author-live-revisions.md`, `author-paid-publication.md`, `reader-unlocks.md`, `moderator-manual-reviews.md`, `author-analytics-unlock-income.md`, `monthly-author-payouts.md`, `author-bank-details.md`, `author-payout-readiness.md` and `author-payout-consistency.md`.

Explicit limits:

- Available statistics use existing stored events only. Referral/OS/device detail without a source remains unavailable. No fabricated totals or schema changes were introduced.
- Income excludes unlinked legacy credits from verified chapter-sale metrics and explains that coverage; ledger history retains those actual entries. Refund processing is not invented from missing source events.
- The monthly recovery job evaluates the current month, not missed historical months. The bank snapshot is taken when evaluation commits; the existing schema does not store historical bank changes.
- External bank transfer remains an Admin-confirmed action outside this application. SMTP requires real deployment configuration; outbox and delivery behavior were tested with isolated fixtures.
- Desktop checks for earnings, bank configuration, pending payout history and payout details are recorded in [browser acceptance](admin-author-browser-acceptance.md). These checks do not certify every Author flow or the full responsive matrix.
