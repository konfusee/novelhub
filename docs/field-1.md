# Field 1 — Accounts and administration

## Local development

Use the normal `/api/auth/login` flow with development accounts. Set
`DEV_SEED_PASSWORD` (10+ characters) in the backend environment, then run:

```sh
npm run db:seed-field1 -w backend
```

This explicitly writes to the configured `MONGODB_URI`; do not run it against
shared data without coordinating with the team. It is disabled in production.
It creates `dev-reader@novelhub.test`, `dev-author@novelhub.test`,
`dev-moderator@novelhub.test`, `dev-admin@novelhub.test`, their Reader wallets,
and an initial policy if absent. Reruns preserve existing accounts/passwords.

Google OAuth needs the configured Google client and callback URL. SMTP needs the
existing `SMTP_*` environment variables; `npm run email:verify -w backend`
checks that connection. Development falls back to console emails; this does
not prove external delivery. Authentication email uses at most three send
attempts. Do not put credentials in source control.

## Public service contract

Other fields import from `backend/src/modules/accounts-administration/service.js`:

```js
import { policy, notify, requireAuth, requireRole, recordAudit,
  registerLifecycleHook } from '../accounts-administration/service.js'

const effective = await policy.getEffective({ now, session })
await notify({ recipientAccountId, eventType, sourceEventKey, payload }, { session })
```

`getEffective` returns the latest effective policy whose date has arrived; it
throws `policy_required` if missing. Pass `required: false` for a nullable result.
`notify` creates one in-app notification per recipient/event key and queues an
email for Google linking, publication decisions, Author applications, monthly
withdrawal creation/missing-bank notices, and Paid/Failed results. Chapter
release notices are in-app only. Reusing a key preserves the original notice.
Always pass the business transaction's session. Without a session, `notify`
opens its own transaction. Never send provider email inside a business transaction.

Lifecycle events are `onAccountSuspended`, `onAuthorRoleRevoked`,
`onAccountDeleted`, and `onStaffRoleRevoked`. Register one hook per field/event
at module initialization. Handlers receive `{ accountId, actorAccountId, session,
now, reason }`; deletion also receives the account document. Use that session,
propagate failures, and perform no external I/O. A failed hook rolls back the
entire account action. Registration returns an unregister function.

Built-in adapters cancel unpublished Author work, release staff claims, forfeit
Reader coins through a ledger entry, and retain final payout contact privately.
Published content stays live and frozen on Author-role removal; deletion
unpublishes it. Suspension hides content through existing account visibility
checks and leaves pending withdrawals payable. Public comments use the account's
anonymized display name; historical community/finance/audit records remain.

## Administration

- `GET /api/admin/roles`: actual account/role counts (Reader includes all accounts).
- `POST /api/admin/accounts/:id/role`: `{ role, expectedVersion, reason }`, with
  role `reader`, `moderator`, or `admin`. Author grants use the application flow;
  Author removal uses the existing revocation flow. A former Author can never
  become Moderator. Changes invalidate sessions and release live staff claims.
- `POST /api/admin/accounts/:id/status`: `{ action, expectedVersion, reason }`,
  action `suspend`, `restore`, or `close`. Closing anonymizes; it does not hard-delete
  financial or content history. An Admin cannot change their own role/status.
- `POST /api/admin/policy`: existing versioned bounds/scheduling contract plus
  `withdrawalThresholdCoins` and `authorSharePercent`; platform percentage is
  derived as `100 - authorSharePercent`. Existing per-Author negotiated rates
  still override the default. Existing order/claim deadlines do not change.

Role and policy screens use these APIs, with no editable fake permission matrix
or simulated integration settings. Fixed V1 roles are intentional; custom roles,
AI/provider-key administration, and maintenance controls are not V1 policy.

## Delivery and deletion worker

The API process starts a notification worker and stops it before disconnecting
MongoDB. It claims outbox rows with a five-minute lease, sends after claim commit,
and records each attempt before calling the provider. Failures back off (one,
then two minutes), with a maximum of three attempts. Expired claims recover;
uncertain attempts stay in history. SMTP is at-least-once: a process crash after
provider acceptance can cause a duplicate email. Delivery failure never reverses
a committed business outcome. Failed rows remain for operator diagnosis.

On the first day of a Vietnam month, the worker evaluates accounts deleted before
that month's midnight cutoff. Final unpaid earnings create one forced payout row
regardless of threshold, using the retained bank snapshot or a missing-bank marker.
No transfer is initiated. Existing Admin payout result handling queues Paid/Failed
emails. Contact is removed only after final evaluation, no remaining earnings,
all withdrawals Paid, and queued emails delivered. An account with no earnings
and no pending withdrawal closes immediately. Failed email delivery retains the
private contact for investigation rather than silently dropping a payout notice.

The regular monthly payout process, bank corrections and transfer operations
remain owned by Field 5. This adapter only covers the account-deletion boundary.
