# Author access validation

Checked on 15 October 2026 using disposable accounts and an isolated temporary
MongoDB replica set. No shared database or private environment values were used.
Local MongoDB was 8.3; CI remains pinned to 8.0.32. Production deployment and
shared-database acceptance are not claimed.

## System scenarios executed in the browser

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Reader applies | Pending application; no immediate Author role | Application shown as pending after submission | Pass |
| Admin opens users page | Real application visible in review section | Demo Reader and submitted date loaded from API | Pass |
| Admin rejects with reason | Rejection stored; applicant can read reason | Applicant saw the exact entered reason | Pass |
| Rejected Reader reapplies | New pending application | New application appeared in Admin pending list | Pass |
| Admin approves | Author grant and decision committed together | Decision saved; pending list updated | Pass |
| Approved account signs in again | Reader plus Author access | Profile destination switched to Author and application page showed activated Author access | Pass |
| Pending applicant checks status | Loading feedback followed by checked timestamp, even if still pending | Latest browser build displayed a server-check timestamp and retained the pending state | Pass |

Admin decisions require a reason. Existing privileged sessions become invalid
after the authorization epoch changes. Applicant status refresh now announces
checking/success timestamps and preserves the previous status with an explicit
error when refresh fails; these unchanged-status/offline cases were covered by
component tests. The flow creates in-app notification records, not email.

## Automated verification

- New backend Author access suite: 12 scenarios, including concurrent submit,
  competing decisions, stale authority/version, invalid input, role conflicts,
  privacy, applicant isolation and transaction rollback on notification failure.
- Existing auth regression: 39 tests passed together with the new suite.
- Full backend suite before session-management changes: 142 tests passed.
- Admin review component: 5 scenarios passed, including stale decision errors,
  filtering, retries and read-only history.
- Applicant component scenarios were executed for rejection/resubmission,
  session expiry, load retry and status refresh before the test file was removed
  separately from this implementation. Do not infer present test coverage from
  this historical execution; run the current repository suite.
- Frontend production build, lint, locale and owned-icon checks passed during
  implementation. Current aggregate results are recorded by the final checks.

Final regression after session-management work: 147 backend tests and 22 tests
in the current frontend suite passed. Production build, lint, locale and icon
checks passed. These counts describe executed tests, not production acceptance.

## Scope still pending

General account management, Author role removal, content lifecycle, policy
administration, audit querying and financial agreements are not finished by
this change. The surrounding legacy users table remains mock; only its Author
application review section uses the new API. The application page no longer
promises the mock 80/20 revenue split.
