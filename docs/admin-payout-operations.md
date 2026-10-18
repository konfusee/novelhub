# Payout operations monitoring

A-UC-11: Admin-only `/admin/payout-operations` provides a read-only view of committed monthly/final evaluation audit records, selected-period pending/paid withdrawals, and current financial email queues. It is linked from the finance report.

Monthly audits use their stored correlation period; final-deletion audits use their actual evaluation time in the selected Vietnam calendar month. The table supports pages of 20. Bank-required/below-threshold counts come from committed outcomes, not inferred wallet values. No bank account, email recipient or private payload is returned.

The current month's candidate count uses active ever-Author accounts created before cutoff, excluding accounts with an evaluation audit or existing withdrawal in that period. Historical candidate counts are unavailable because eligibility history is not stored. Email counts are current and restricted to payout source-event prefixes, with expired claimed leases shown separately.

This view does not run jobs or initiate transfers. Audit activity does not establish worker liveness. Rolled-back evaluation failures remain in server logs and are not mislabeled as committed successes. Existing scheduler, idempotency, threshold and deletion settlement behavior remains unchanged.

Validation: eight backend tests across monitoring/monthly evaluation, four frontend tests across monitoring/finance report, targeted lint, locale check and production build passed. New browser visual verification remains outstanding.
