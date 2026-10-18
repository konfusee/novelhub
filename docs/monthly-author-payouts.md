# Monthly author payout evaluation

Regular author payouts now run in the existing server payout scheduler, after final account-deletion evaluations. There is no manual withdrawal request or bank transfer initiated by this job.

- The period changes at 00:00 on the first day in Vietnam. Startup catches up for the current period.
- Active accounts that have ever been Authors remain eligible after Author role removal. Suspended, anonymized and newly created accounts are excluded. Deletion settlement retains its separate rules.
- The cutoff policy supplies the threshold. Balance reconstruction excludes post-cutoff ledger movements; debit never exceeds currently available funds. Earnings after the cutoff remain available for a future period.
- Below-threshold balances carry forward without a notification. Missing bank details keep the funds available and produce one notification/email per period; a later bank update applies at the next evaluation period.
- The bank snapshot uses the account details present when evaluation commits. Historical bank changes are not reconstructed; the existing schema has no historical bank records.
- A per-account transaction locks eligibility, creates the withdrawal and payout row, debits the wallet, appends the ledger entry and enqueues notification/email. An audit marker makes evaluations, including skipped balances, idempotent for the period. Concurrent retries serialize on the account.
- The Author payout history reads the created records through the existing endpoint. Admins can open `/admin/monthly-payouts` from the finance report, inspect the private bank snapshot, correct bank details with a reason, and record Failed or externally confirmed Paid. Suspended accounts retain their pending payment rights. Paid never closes an active/suspended account or debits its wallet again. Final-account settlement remains separate.

The scheduler does not backfill missed historical months. On recovery it evaluates the current month using its cutoff and policy. No backend schema changes.

## Monthly sheet history

Admin queue supports `period=all|YYYY-MM` and `status=pending|paid|all`, defaulting to pending/all periods. Grouped pending counts respect the selected filter. Account detail shows up to 50 ordinary payout records, prioritizing pending records and then recent history. Paid records remain read-only even if their stored evidence needs investigation; mutation endpoints still require a pending withdrawal and reject already-paid evidence. Deletion-final queues retain their existing pending-only behavior.

Validation for history/filtering: 26 backend tests across monthly evaluation, final payout and result recording; eight Admin UI tests; targeted lint/format, locale validation and build passed.
