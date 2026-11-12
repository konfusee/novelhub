# Coins & Payouts — review corrections, 2026-11-12

Scope: `reviews.zip/Part5-Cuong.md`, checked against main `50d7aa9`.
This change follows the owner's two explicit decisions: payouts remain automatic
simulations, Admin may correct failed bank destinations through audited support,
and new chapter purchases use the shared policy revenue rate.

| Review | Implemented correction |
| --- | --- |
| P5-1 | `PAYOUT_WORKER_ENABLED` defaults to false. The server passes explicit opt-in to the worker; disabled mode creates no timers or financial writes. Withdrawals store immutable execution mode at creation. The simulator and run summaries select only explicitly simulated withdrawals, leaving legacy/external data untouched. |
| P5-2 | Manual real-payment result recording (A-UC-13.1) is excluded from the current project/demo contract. Manual generate/result routes remain disabled. The owner-confirmed amendment, requirements baseline and current demo script consistently describe automatic simulated execution. Original source documents are explicitly marked superseded for finance. |
| P5-3 | One shared validator requires a name, holder and 6–34 digit account number, preserving leading zeros. Read APIs mask numbers; the Author re-enters the full number to save. Normal invalid destinations prevent reservation. Failed/final pending simulated obligations accept audited, version-checked Admin support correction; an active Author's profile update also repairs their own failed/invalid obligations. The next enabled tick retries a new bank fingerprint without a second debit. Original snapshots remain immutable; attempt evidence retains the corrected snapshot privately. |
| P5-4 | Added `sepay-demo-runbook.md` with receiving bank configuration, tunnel/webhook setup, isolated-DB PowerShell replay and expected results. Temporary-DB integration tests exercise HTTP 201 order creation, payment instructions and duplicate webhook delivery with one credit. Live SePay delivery was not exercised in this pass. |
| P5-5 | Formatted the six flagged files and all changed/new source files with the repo's effective Prettier configuration. |
| P5-6 | Bank Details dialog shows code, original/current match state, linked order/Reader and credited adjustment. Resolve requires `expectedVersion`, checks it in the write filter, supports reasons up to 1000 characters and creates one Reader notification in the financial transaction. Exact completed retries remain idempotent. |
| P5-7 | Author earnings adds current-month unlock revenue/count, next evaluation date, payout totals by state, an owner-scoped story-name filter, filtered ledger net and per-entry running balances. Author payouts adds year/state filters and masked bank information. Private support holder names and legacy internal notes/references remain hidden from Author payout history. |
| P5-8 | Monthly generation skips an existing account/period before any Account write. Only creating a new eligible obligation changes the Account version; below-threshold/missing-bank evaluation and repeated runs do not. Lifecycle fencing and wallet CAS remain transactional. |
| P5-9 | Finance report adds wallet-purpose, ledger-type, payout-status and bank-state filters, bucketed bank/payout/ledger movements and a dashboard link. Lookup options are searched, scoped by selected Author/story and bounded to 50 results. UI labels distinguish independent filter scopes and current wallet snapshots. |
| P5-10 | Matched receipts produce `settled`, not pending review. Pending list keeps only unexpired pending orders or orders with unresolved received evidence; old never-paid orders disappear. QR is suppressed after received payment evidence. |
| P5-11 | Wallet empty-state top-up button scrolls to packages; checking-payment status is outside the button; resetting transaction filters also resets pagination. |
| P5-12 | Removed obsolete preview route/service, preview-hash confirmation and their obsolete tests, unused manual payout-result service/tests and unused locale actions. Deleted-account closure tests now exercise automatic simulation after support correction. Demo seed results explicitly carry simulation mode/time. |
| P5-13 | Per owner's decision, new purchases use only `PolicyVersion.authorSharePercent`. `AuthorRevenueRate` remains a historical model; existing financial evidence/snapshots are not rewritten. |

## Recovery and data boundaries

- No shared app database was seeded, migrated or financially mutated for testing.
- Existing withdrawals without execution mode remain legacy, even if they were
  previously seeded with `SIM-DEMO` text. A reference string is not authorization
  to automatically simulate historical obligations.
- A new simulated obligation with invalid bank details stays pending after one
  Failed attempt. Repeated ticks do not add duplicate results or bump versions.
  A valid audited correction changes the destination fingerprint and allows the
  next attempt. A unique Paid result and transactional locking prevent double pay.
- The designated backend must be running with the worker enabled. Ordinary team
  backends leave the flag false. Corrected obligations are retried within the
  30-second tick; ordinary balance generation runs at startup/daily catch-up.
- In production, apply the added indexes with the existing index deployment
  workflow; development auto-indexing is unchanged. This is still a simulated
  payout implementation, not a bank-transfer integration.

## Verification

Targeted backend tests cover worker opt-in, legacy isolation, cutoff carryover,
account version stability, bank correction/retry, deleted-account closure,
reconciliation conflicts/notification/rollback, owner-scoped reports and top-up
replay. They use a temporary MongoDB replica set, not app `.env`.

Frontend tests cover the changed Admin screens and masked bank re-entry/support
correction payloads. Workspace lint, Vietnamese content validation, frontend
production build and scoped Prettier validation were run. A Windows Node worker
crash was retried as a separate test file; it is not counted as a passing run.

Direct browser inspection was unavailable because `localhost:5173` was not
running. Real QR scanning and delivery from SePay remain an operator rehearsal;
use the runbook with the designated backend and receiving account.
