# Coins & Payouts — current workflows

This document incorporates the owner's confirmed automatic simulation requirement
of 2026-11-11. It supersedes older descriptions of manual payout generation,
Admin-entered payment results and real payout-provider integration for this scope.

## Reader wallet and transaction history

`GET /api/reader/wallet?page=1&type=all` returns the signed-in reader's wallet only.
Types are `all`, `added`, `unlock` and `other`. Each page contains up to 50 rows,
ordered by occurrence time and ID descending. Pagination and filtering run on the
server. Wallet balance and historical rows are read in one snapshot transaction.

Each row contains a signed coin amount, committed ledger status, description and
balance after the entry. Top-ups resolve the original package amount/payment code;
unlocks resolve the purchased chapter revision's title rather than a later draft.
Historical balances include every newer entry, including types hidden by filters.
Ledger-only history contains committed movements; pending orders are separate.
CSV export explicitly exports the displayed page and escapes spreadsheet formulas.

The same wallet-history service handles Author earnings using a server-selected
`author-earnings` wallet. Authors can filter type and dates and paginate; callers
cannot select another owner or a different wallet purpose.

## Top-up and reconciliation

1. Reader selects an active package. The backend creates or reuses the existing
   pending package order, preserving its amount, policy and payment code.
2. Reader can reopen the order from the paginated order list after closing the
   modal or refreshing the page. The authenticated order GET restores payment/QR
   data while the order is pending and no payment receipt has been recorded.
3. SePay sends authenticated bank evidence. The webhook matches the expected bank,
   account, code, amount and expiry, then credits the wallet exactly once.
4. An order with recorded unmatched/mismatched/expired receipts shows a review
   state and warns the reader not to pay again. QR data is suppressed for that
   order. GET and reused POST follow the same rule.
5. Admin reconciliation either credits the actual received amount once through an
   adjustment or closes the receipt without credit. The Reader sees the resolution
   state. The original mismatched order is never falsely marked paid.

Order reads are owner-scoped. Bank API keys, raw audit notes and other accounts'
receipts are not serialized to the Reader. Current bank configuration supplies the
payment instructions; no banking password/PIN is required.

## Chapter purchase and revenue

Quote → confirm expected revision and price → transactional wallet debit →
Author/platform allocation → entitlement and immutable ledger/audit records.
Insufficient balance creates no successful purchase. Idempotency protects retries.
A valid, unexpired chapter entitlement survives a change of published revision;
the original purchased revision remains immutable receipt evidence.

## Platform reports

The Admin payout page includes a dedicated platform finance report. Endpoints:

- `GET /api/admin/transactions/report-options`
- `GET /api/admin/transactions/report?from=...&to=...&groupBy=...&page=1`
- Add `export=csv` to retrieve all matching unlock groups for CSV, not just one page.

The interval is start-inclusive/end-exclusive, converted from inclusive calendar
days in Vietnam. Maximum interval: 366 days. Grouping supports day, Monday-based
week, month, story, chapter and Author. Optional policy/Author/story/chapter filters
apply to committed unlocks and their actual allocation ledger legs.

The report includes registrations by current account status and time bucket,
confirmed top-up credits, Author and platform allocation totals, bank receipt
states, live wallet balances by purpose and payout outcomes split by simulation/
external/legacy mode. Registration, top-up, bank and payout summaries use the date
range independently of unlock-specific filters. Wallet balances are current
snapshots, not historical balances at the end of the selected range. UI hints make
these distinctions explicit; top-up receipts are not counted as Author revenue.

## Automatic monthly simulated payout

Only the designated backend opts in with `PAYOUT_WORKER_ENABLED=true` (default false).
Legacy/external pending rows are never selected.

At the first worker tick after 00:00 on the 1st in `Asia/Ho_Chi_Minh`, the system:

1. Opens/reuses the unique processing-period run and its cutoff.
2. Evaluates eligible accumulated earnings using the policy at the cutoff,
   including former Authors. The normal default threshold is 100,000 coins.
3. Reserves eligible coins once and creates the immutable withdrawal/bank snapshot,
   payout sheet, withdrawal ledger, system audit and notification.
4. Automatically simulates the pending payout. Valid snapshot details produce Paid;
   invalid/missing details produce Failed and retain a pending obligation.
5. Records `executionMode=simulation`, deterministic result key, SIM-AUTO reference
   when successful, audit and notification, without another wallet debit.
6. Updates persisted run counts and completion/pending state.

Startup/daily recovery handles downtime; post-cutoff credits stay for the next
period. Deleted-account final earnings bypass the normal threshold through the
retained final-payout path. The backend must be running for scheduled execution.
No bank-transfer API is called and no actual money is sent to Authors.

Admin views runs, lists, statistics, history and CSV. Admin may auditably correct
failed/invalid simulated payout bank details, with an expected-version check;
`PUT /api/admin/monthly-payouts/:withdrawalId/payment-details` never debits coins
or records a payment result. The next worker tick retries the corrected snapshot.
An active Author bank update also repairs their failed/invalid simulated rows. Manual generate/result
POST endpoints return 405. The read-only result-history endpoints are:

- `GET /api/admin/monthly-payouts/:withdrawalId/history?page=1`
- `GET /api/author/payouts/:withdrawalId/history?page=1` (owner only)

They distinguish simulation from legacy records, without rewriting old results.
Author details do not expose legacy internal Admin notes or bank references.
Pending payouts lacking a valid retained destination remain visible as pending;
the system never invents recipient details to make a simulation succeed.

## Updated diagrams and review

Open [the current draw.io file](diagrams/payouts-automatic-current.drawio). It has
separate automatic-sequence and class pages. Old manual payout diagrams are
historical and should not be used for the current presentation.

[Full.zip reconciliation](full-review-coins-payouts.md) records what the review
originally found. Reader history, order recovery/review states, expanded reporting
and payout history described above have now been added locally. Provider reachability
and real SePay transfers still require operator testing against the configured
public backend; simulated payouts do not prove a real payout integration.

Automated verification uses temporary databases, not seed/settlement writes against
the shared application database. Browser-based visual verification must be reported
separately from component tests, build and lint.
