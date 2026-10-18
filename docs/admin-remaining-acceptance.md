# Remaining Admin use-case acceptance

18 October 2026. Workbook IDs A-UC-05 and A-UC-08–11 are complete for implemented UI/API and automated tests in the agreed scope outside media/AI. This is acceptance of the listed functions, not a claim about every NovelHub page, new browser visual checks or production service configuration.

| ID | Implemented behavior | Evidence/result |
| --- | --- | --- |
| A-UC-05 | Policy configuration/history/effectivity, negotiated Author rates, persisted top-up snapshots, authenticated receipt settlement, claim expiry and actual monthly payout evaluation | Policy/write/expiry, SePay, agreement, claim and monthly payout suites: Actual/Pass |
| A-UC-08 | Snapshot finance report from actual wallets, ledger, allocations and payouts. Period/type/purpose filters, pagination and restricted Admin access | `admin-finance-report` backend and `FinanceReportPage` frontend: Actual/Pass |
| A-UC-09 | Application submission/decision counts, current active Authors and verified paid unlock transactions/coins/distinct buyers. Vietnam period filter | `admin-author-statistics` and `AuthorStatisticsPage`: Actual/Pass |
| A-UC-10 | Monthly sheet filtering by period/status, account detail and read-only Paid history. Pending bank correction preserves snapshots; external-confirmed Paid/Failed remains audited and idempotent | 26 backend tests across monthly/final/result suites and 8 AccountClosuresPage tests: Actual/Pass |
| A-UC-11 | Committed monthly/final evaluation audit table with pagination, threshold/bank outcomes, current-month unprocessed candidates and financial email queue/expired lease counts | 8 backend monitoring/monthly tests and 4 monitoring/finance frontend tests: Actual/Pass |

Final combined checks: 48 backend tests across 9 selected policy/expiry/receipt/finance/agreement/claim/statistics/operations suites, and 36 frontend tests across 7 policy/agreement/finance/statistics/operations/payout suites passed. These are targeted affected modules, not the entire repository suite. Targeted lint/format, Vietnamese locale validation and frontend production build passed.

Commits: `14a7c2c` (statistics), `f5e0cb6` (operations), `1508c8b` (monthly history); existing finance/policy/payment/payout commits remain recorded in the workbook.

Limits remain explicit in the relevant pages/docs: current eligibility is not reconstructed for historical periods; monitoring does not assert worker liveness; rolled-back failures are in server logs; actual transfers remain externally confirmed Admin actions; SMTP needs deployment configuration. No real transfer or email delivery is claimed by the tests. New browser visual acceptance remains outstanding. Backend model/schema files were not changed.
