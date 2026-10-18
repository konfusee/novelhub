# Payout history consistency

All displayed payout states require a matching payout-sheet row, period, positive safe-integer coin amount and VND slip amount. Missing or conflicting rows now make pending/Failed requests unavailable, just as they already did for Paid requests. A Failed result alone does not establish a valid pending obligation.

Both history and detail use the same check. Unavailable records provide no paid slip, do not change the wallet and remain available for administrative investigation. Existing owner and wallet boundaries, cursor pagination and private-field exclusions are retained. Regression coverage includes missing sheets, conflicting amounts/periods, missing-sheet failures, valid pending pagination and former-Author finance access.
