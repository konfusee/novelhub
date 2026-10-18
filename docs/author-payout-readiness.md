# Current payout readiness

The earnings page replaces the unimplemented end-of-month amount placeholder with current payout readiness. The API reads the real author earnings balance, current effective policy and completeness of the account's private bank fields. It returns only state, threshold, shortfall and the next first-of-month evaluation time in Vietnam; bank details are never included in this summary.

States: below-threshold (including empty wallets), bank-required, eligible or unavailable. Missing/future policies and invalid amounts remain unavailable. A zero policy threshold does not turn a zero balance into a payout.

This read-only assessment does not create a withdrawal, reserve funds, or promise a transfer. The UI says that account eligibility, bank details and policy must be checked again at the actual cutoff, and offers a direct link to complete missing bank details. Monthly evaluation and payout history remain the authoritative committed records.
