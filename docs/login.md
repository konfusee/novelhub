# Login setup and integration

## Architecture

The frontend is React 19/Vite and the API is Node.js 22/Express 5 with Mongoose.
Login uses an opaque, random session token in an `HttpOnly`, `SameSite=Lax`
cookie. Only its SHA-256 digest is stored in the `sessions` collection. Passwords
created by the development seed use Node's `scrypt`; plaintext passwords and raw
session tokens are never persisted or returned.

The API contract is:

- `POST /api/auth/register` creates a pending local Reader account and sends verification;
- `POST /api/auth/verify-email` consumes a single-use verification token;
- `POST /api/auth/resend-verification` revokes older verification tokens;
- `POST /api/auth/login` with `{ "email": "...", "password": "..." }`;
- `GET /api/auth/me` to restore the authenticated user after refresh;
- `POST /api/auth/logout` to revoke the current session;
- `POST /api/auth/forgot-password` returns the same response for known and unknown emails;
- `POST /api/auth/reset-password` consumes a token, changes the hash and revokes sessions;
- `GET /api/auth/google/start` begins Google Authorization Code + PKCE;
- `GET /api/auth/google/callback` validates state and Google OIDC identity;
- `POST /api/auth/author-application` submits an application without granting a role.

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

Development verification and reset links are written to the backend console.
This fallback is disabled in production. Authentication email delivery uses a
shared adapter with at most three attempts; a production Gmail/SMTP adapter and
credentials must be supplied by deployment infrastructure.

## Google OAuth configuration

Create a Google Cloud OAuth 2.0 Web application after configuring the consent
screen. For local development use:

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`

Then set only in the ignored `backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=your-web-client-id
GOOGLE_CLIENT_SECRET=your-web-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
```

Google authentication uses Authorization Code flow, PKCE, a ten-minute
HttpOnly state cookie, issuer/audience/expiration/signature checks, and requires
`email_verified=true`. A new identity creates an active passwordless Reader. A
verified matching email links to the existing account while preserving all
NovelHub roles. Google never assigns roles.

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

Registration is available at `/register`. After submitting, copy the
development verification URL from the backend console into the browser. Password
recovery starts at `/forgot-password`; its reset URL is delivered the same way.

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
- **Google unavailable:** configure all three Google variables and make the
  callback URI exactly match Google Cloud Console. Live OAuth cannot be tested
  without an external client credential.
- **CSRF rejected:** authenticated POST requests must originate from a value in
  `CORS_ORIGIN`. Browser fetches already include this header; scripts must set it.

## Security and team integration notes

Login errors intentionally do not reveal whether an email exists. Session
validity is tied to `credentialVersion` and `authorizationEpoch`, so password or
authorization changes invalidate stale sessions. The frontend consumes only the
safe user shape `{ id, name, email, roles }`; teammates should use `useAuth()` for
`currentUser`, `isAuthenticated`, `roles`, `hasRole`, and `logout` rather than
reading cookies or creating a second auth store.

Other backend fields must protect routes with `requireAuth({ cookieName })` and
then `requireRole('author' | 'moderator' | 'admin')` where appropriate. Both
`req.auth.account` and the compatible `req.account` alias contain the trusted
database account. Admin does not inherit Moderator. Client-side route guards are
navigation aids only and never replace backend authorization.
