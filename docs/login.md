# Login setup and integration

## Architecture

The frontend is React 19/Vite and the API is Node.js 22/Express 5 with Mongoose.
Login uses an opaque, random session token in an `HttpOnly`, `SameSite=Lax`
cookie. Only its SHA-256 digest is stored in the `sessions` collection. Passwords
created by the development seed use Node's `scrypt`; plaintext passwords and raw
session tokens are never persisted or returned.

The API contract is:

- `POST /api/auth/login` with `{ "email": "...", "password": "..." }`;
- `GET /api/auth/me` to restore the authenticated user after refresh;
- `POST /api/auth/logout` to revoke the current session.

All accounts receive Reader access. Active records in `roleAssignments` add
`author`, `moderator`, or `admin`. Frontend route guards improve navigation, but
backend features must compose `requireAuth(...)` and `requireRole(...)` from
`backend/src/middleware/auth.js` for actual authorization.

## Windows PowerShell setup

Prerequisites: Node.js 22+, npm, and access to a MongoDB 8 replica set.

```powershell
npm install
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` and replace `MONGODB_URI` placeholders with credentials
obtained from the project owner. Keep `CORS_ORIGIN=http://localhost:5173`. The
default cookie name and seven-day lifetime are suitable for local development.

Verify database connectivity:

```powershell
npm run dev:backend
Invoke-RestMethod http://localhost:4000/api/ready
```

The response must contain `status: ready` and `database: connected`. In a second
PowerShell window, start the frontend:

```powershell
npm run dev:frontend
```

Open `http://localhost:5173/login`.

## Create a development account

Only run this against a development database. The command refuses to run when
`NODE_ENV=production`, requires a password of at least ten characters, hashes it,
and does nothing if the normalized email already exists.

```powershell
$env:DEV_SEED_EMAIL = 'reader@example.test'
$env:DEV_SEED_PASSWORD = 'choose-a-long-local-password'
$env:DEV_SEED_NAME = 'Development Reader'
npm run db:seed-dev-account --workspace backend
Remove-Item Env:DEV_SEED_EMAIL, Env:DEV_SEED_PASSWORD, Env:DEV_SEED_NAME
```

Enter those credentials on `/login`. A successful Reader login redirects to
`/reader`; trusted roles redirect to `/author`, `/moderator`, or `/admin`.
Refreshing the page calls `/api/auth/me` and preserves a valid session. Use the
profile menu's logout action, then verify `/api/auth/me` returns HTTP 401.

## Validation

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

Backend tests use a disposable in-memory replica set and never access the shared
database. The first run downloads its MongoDB binary.

## Troubleshooting

- **Missing/incorrect `MONGODB_URI`:** startup fails with a named configuration
  error or server-selection error. Confirm URL encoding, `authSource`, database,
  firewall access, and `directConnection=true` for the shared single-node set.
- **Transactions unavailable:** NovelHub requires a replica set. A standalone
  MongoDB instance is rejected at startup.
- **No test user:** rerun the idempotent seed command with all three environment
  variables and confirm it prints either `Created` or `already exists`.
- **Invalid credentials:** email comparison is normalized; passwords are exact.
  Pending-verification, suspended, and anonymized accounts cannot log in.
- **Port conflict:** change `PORT` in `backend/.env`; if the frontend proxy target
  changes, update `frontend/vite.config.js` or set an appropriate API base URL.
- **CORS/cookie failure:** `CORS_ORIGIN` must exactly match the browser origin.
  Cross-origin deployments must use HTTPS; production cookies are `Secure`.
- **Refresh logs out:** inspect the login response for `Set-Cookie`, ensure browser
  cookies are enabled, and call `/api/auth/me` with credentials included.
- **HTTP 429:** wait 15 minutes after repeated failed logins before retrying from
  the same client address.

## Security and team integration notes

Login errors intentionally do not reveal whether an email exists. Session
validity is tied to `credentialVersion` and `authorizationEpoch`, so password or
authorization changes invalidate stale sessions. The frontend consumes only the
safe user shape `{ id, name, email, roles }`; teammates should use `useAuth()` for
`currentUser`, `isAuthenticated`, `roles`, `hasRole`, and `logout` rather than
reading cookies or creating a second auth store.
