# Account session management

The shared account page uses real database sessions for all workspaces. The
registered email is read-only and has no local-only save action.

- `GET /api/auth/sessions`: authenticated account's active, unexpired sessions
  matching current credential version and authorization epoch. Current session
  is first. DTO contains ID, current flag, client labels and timestamps only.
- `POST /api/auth/sessions/revoke-others`: revokes other currently valid sessions
  for the signed-in account; preserves the requesting session and returns the
  number changed. Same-origin CSRF protection applies. Repeating returns zero
  after prior sessions have been revoked. No caller-supplied account ID is used.

Login, Google callback and security/2FA session creation capture coarse browser,
OS and device-type labels from User-Agent. Labels are advisory; raw User-Agent
and IP are not persisted. Sessions created before this change may show unknown
device information until the user signs in again. Activity is refreshed at most
once per five minutes and can lag actual requests by that interval.

The UI loads real data, exposes retry/refresh, requests confirmation before
revocation, waits for server success, then reloads the list. Errors do not remove
devices locally or claim success. Different browsers and browser profiles create
different sessions; one device can therefore appear more than once.

Tests cover isolation, no token leakage, current-session preservation, other-user
preservation, actual 401 for revoked tokens, repeated revocation, CSRF, client
labels from real login and activity/legacy-session behavior. UI tests cover
confirmation, server success and failures without fake devices.

Browser check on 15 October 2026 with a disposable database: signed in as the
demo Reader, confirmed read-only email, saw current Windows/Chrome and another
seeded iPhone/Safari session, confirmed revocation, then saw only the current
session and a server-confirmed count of one. Account remained authenticated.
Widths 390, 768, 1280 and 1440 had no document horizontal overflow; the account
surface was inspected in dark and light modes. User-Agent labels remain
advisory, including in the seeded test data.
