# Verified unlock income in Author analytics

UC-AUT-12 now displays `verifiedUnlockIncome` from actual Author allocation credits linked to committed unlock requests and matching entitlements, revisions and story ownership. The existing chapter-sales query is reused, with optional story/chapter scope applied before aggregation.

The selected Vietnam calendar range and owner-validated story/chapter filters apply to the income card and CSV. Zero verified income is displayed as zero; missing, malformed or negative response values remain unknown. The explanatory text explicitly excludes adjustments and legacy/unlinked credits. This is earned unlock income, not current wallet balance or paid bank withdrawals.

No backend model/schema changes, fabricated statistics or media/AI work. Existing income and chapter-sales report behavior is retained when no additional scope is passed. Detailed referral/device data remains unavailable in the existing event schema.
