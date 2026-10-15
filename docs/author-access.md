# Author application API

Implementation contract for Excel `UC-AUT-01`, `A-UC-06`, `A-UC-07` and the
Author-grant slice of `A-UC-02`. These Excel IDs differ from the canonical
source catalogue; mapping is by goal. This does not implement general role
management, account suspension or financial agreements.

- Applicant: existing `GET/POST /api/auth/author-application`. Submission is
  idempotent while pending. Only active verified Readers without a staff role
  may submit; rejected applicants may submit a new application. Responses
  expose status, version, submitted/decision dates and decision reason.
- Admin: `GET /api/admin/author-applications?status=submitted&page=1&pageSize=20`;
  `status=all` includes history. Page size is limited to 50.
- Admin: `GET /api/admin/author-applications/:id`.
- Admin: `POST /api/admin/author-applications/:id/decision` with
  `{ decision: 'approve' | 'reject', reason, expectedVersion }`.
  Both decisions require a nonempty reason of at most 1000 characters.

Decision writes application, role grant (approval only), authorization epoch,
audit and in-app notification in one transaction. The applicant's old sessions
become invalid after a grant; sign in again to receive Author access. No role
can be injected by registration or the applicant request.

Transaction guards recheck current Admin and applicant account state and
serialize concurrent applications and decisions on their account records.
Conflicting decisions return 409; no duplicate role, audit or notification is
created. Responses use the existing `{ error: { code, message, details? } }`
format. No account password, bank or provider credentials are exposed.

Author-application decisions create in-app notification records. Email delivery
for these events is not part of this contract; do not claim an email was sent.
No business transition is rolled back because an external provider fails.

Test fixtures use the disposable replica set and create each required role via
`backend/test/fixtures/accounts.js`. They never seed the shared development DB.
Local verification may use an installed MongoDB binary through
`MONGOMS_SYSTEM_BINARY`; CI keeps the pinned test version in global setup.
