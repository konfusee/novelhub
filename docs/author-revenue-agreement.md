# Author revenue agreement read model

`GET /api/admin/authors/:accountId/agreement` requires Admin authorization, validates the account ID and returns private/no-store data. Only an actual account with `everAuthor: true` can be inspected, including former Authors. Missing, non-Author and anonymized accounts return 404 without substituting a demo account.

The current percentage is the latest personal AuthorRevenueRate whose effectiveAt is no later than the server time. Otherwise it uses the latest effective PolicyVersion whose effectiveAt has arrived; without either record, the confirmed product default is 70/30. Future rates and policies do not override today's percentage. The response includes at most 20 newest personal rate records, explicitly marking future effective dates. No actor email, private account fields or monetary balances are exposed.

The existing Admin agreement route now uses this API, showing the actual identity, split and bounded history with loading, missing, error and retry states. Its two-column split geometry, progress bar, Card primitives and shared Admin shell remain. The directory inspector links active Authors to this page. LocalStorage mock saving and the 80% sample fallback are removed from this page. Other remaining consumers of MockDataContext are unchanged.

This increment is read-only. Negotiating and appending a new agreement still requires a separate transactional command with concurrency checks and audit evidence; the UI explicitly says editing is unsupported and does not simulate success. Existing allocations, payouts, rates and policy records are untouched. No backend schemas changed; tests use disposable MongoDB fixtures and do not seed the shared database.

Validation: three MongoDB API/read-model tests and two frontend tests cover authorization, account isolation, missing identity, effective-time precedence, future rates, default 70/30, actual API display and absence of fake save actions.
