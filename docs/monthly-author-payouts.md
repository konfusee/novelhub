# Monthly author payout evaluation

Regular author payouts now run in the existing server payout scheduler, after final account-deletion evaluations. There is no manual withdrawal request or bank transfer initiated by this job.

- The period changes at 00:00 on the first day in Vietnam. Startup catches up for the current period.
- Active accounts that have ever been Authors remain eligible after Author role removal. Suspended, anonymized and newly created accounts are excluded. Deletion settlement retains its separate rules.
- The cutoff policy supplies the threshold. Balance reconstruction excludes post-cutoff ledger movements; debit never exceeds currently available funds. Earnings after the cutoff remain available for a future period.
- Below-threshold balances carry forward without a notification. Missing bank details keep the funds available and produce one notification/email per period; a later bank update applies at the next evaluation period.
- The bank snapshot uses the account details present when evaluation commits. Historical bank changes are not reconstructed; the existing schema has no historical bank records.
- A per-account transaction locks eligibility, creates the withdrawal and payout row, debits the wallet, appends the ledger entry and enqueues notification/email. An audit marker makes evaluations, including skipped balances, idempotent for the period. Concurrent retries serialize on the account.
- The Author payout history reads the created records through the existing endpoint. Admin handling of ordinary payout results is a separate remaining integration; existing final-account settlement remains unchanged.

The scheduler does not backfill missed historical months. On recovery it evaluates the current month using its cutoff and policy. No backend schema changes.
