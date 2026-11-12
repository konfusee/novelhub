# Coins & Payouts: review fixes

## Chapter ownership

An active, unexpired entitlement grants access to its chapter even if the published
revision changes. The original revision and purchase price remain immutable evidence.
Revoked or expired entitlements do not grant access. Catalogue lists resolve ownership
for the signed-in reader and return private, non-cacheable responses.

## Bank details

Both `PUT /author/bank-details` and the legacy
`PUT /author/earnings/payment-details` call the same transactional, authorization-fenced
update and create `author.bank-details.updated` audit events.

## Admin financial transactions

Open `/admin/transactions`. The ledger and SePay views use stored transactions, with
search, bank status, Vietnam date boundaries and pagination. Statistics count registered
accounts and committed chapter purchases within the selected date interval.

For unmatched, amount-mismatch, expired and already-paid receipts, an admin can:

- Select an active reader wallet and credit exactly the received amount (1 VND = 1 coin).
- Close the receipt without credit, recording the reason (for example, an externally handled refund).

Both actions require a reason and create an audit record. A credited receipt creates
an append-only adjustment linked to the original bank evidence. The original top-up
order is not falsely marked paid. Repeating the same resolution returns its previous
result; changing its recipient or reason returns a conflict. Matched receipts cannot
be manually credited again. These actions do not initiate a bank transfer or refund.

## Monthly payout operation

The backend starts a payout worker automatically. Its first tick after 00:00 on the
1st (Asia/Ho_Chi_Minh) processes the new payout period; polling resolution is 30 seconds.
Startup and daily recovery handle downtime. Keep one backend running for timely execution.
Admin views are read-only. Manual generation and result endpoints return 405; the worker owns recovery.

The period identifies the month of processing: November 1 opens `2026-11` using
the balance at the November 1 cutoff. Credits at or after that cutoff remain for
the next period. In delayed recovery, subsequent debits consume the prior balance
first. The effective/superseded policy in effect at the cutoff supplies the threshold.
An account-period unique index prevents a second reservation in the same period.

Candidates come from earnings wallets, including active accounts whose author role
was revoked. Deleted accounts use the retained final-payout path, without a minimum
threshold, after their next cutoff. Missing beneficiary details require a verified
support correction with a reason; original snapshots remain intact.

The confirmed user requirement on 2026-11-11 supersedes the external-result workflow
in Full.zip T08/A-UC-13.1: the worker automatically simulates payment after reserving
coins. Valid beneficiary details produce a Paid result with an explicit SIM-AUTO
reference; invalid details produce Failed and the obligation stays pending. There
is no bank transfer API. Admin cannot generate runs, enter results or edit payout
bank details. The admin page lists runs, outcomes, summaries, filters and CSV export.

Automatic results have executionMode=simulation and system-actor audit records.
Historical entries without that field are labelled legacy, never presumed to be
real transfers. Author and admin views identify new simulated outcomes explicitly.
The per-withdrawal result key, unique Paid constraint and transactional row lock
prevent duplicate settlement. A crash after reservation can recover settlement
without a second wallet debit. The worker does not retry a terminal simulated
failure endlessly or invent beneficiary details for deleted accounts.

Deploy the monthlyPayoutRuns unique period index and the existing finance indexes
when production automatic index creation is disabled. Preserve historical records.

## Local verification

Run backend tests with a temporary MongoDB replica set using the existing Vitest setup,
then run frontend tests, lint, i18n validation and the frontend production build.
Do not test manual credit or payout outcome writes against shared financial data.
SePay delivery still requires a reachable backend URL and a matching webhook API key.
Secrets belong in the backend environment, never in source or screenshots.
