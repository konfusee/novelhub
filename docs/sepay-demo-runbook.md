# SePay and monthly payout demonstration

## Safe local rehearsal

Use a separate local MongoDB replica set/database for a rehearsal. Keep
`PAYOUT_WORKER_ENABLED=false` on ordinary teammate backends. Do not send fake
webhooks to a backend connected to shared or production data: an authenticated
webhook is financial evidence and can credit actual app balances.

The automated rehearsal uses MongoMemoryServer, dummy bank data and an in-process
HTTP app; it does not load `.env`, call SePay or send money:

```powershell
npm test --workspace backend -- test/sepay-webhook.test.js test/reader-top-up-orders.test.js
```

It checks HTTP 201 order creation and QR instructions, then two deliveries of the
same transaction ID with exactly one top-up ledger credit. QR generation encodes
payment instructions; a QR alone does not prove that a webhook connection works.

## Configure the demo backend

In `backend/.env`, fill your actual receiving bank configuration privately:

```dotenv
TOPUP_BANK_BIN=970423
TOPUP_BANK_NAME=TPBank
TOPUP_BANK_ACCOUNT_NUMBER=<your receiving account, digits only>
TOPUP_BANK_ACCOUNT_NAME=<account holder>
SEPAY_WEBHOOK_API_KEY=<random secret of at least 32 characters>
PAYOUT_WORKER_ENABLED=false
```

The bank BIN must be supported by the QR provider. Bank name must match SePay's
incoming `gateway`; account number must match the bank account linked to SePay.
Neither a bank password nor a PIN is needed. Never commit `.env` or paste keys.

1. Start backend and frontend, sign in as a Reader, choose a package and create a
   fresh order. Check bank, amount and `NHxxxxxxxx` transfer code in its QR.
2. For real incoming transfers, expose the backend through your deployed HTTPS
   URL or `ngrok http 4000`. Configure SePay to POST to
   `https://<public-host>/api/webhooks/sepay`, API Key authentication, using the
   same key. Enable incoming transactions for the correct account. Disable the
   "only when payment code exists" restriction unless SePay recognizes `NH`.
3. Keep backend and tunnel running during the transfer. Check SePay's webhook
   delivery log for HTTP 200, then reopen/check the order: Paid, updated wallet,
   one credit in history. An HTTP 200 on unmatched evidence does not mean Paid.
4. A tunnel is unnecessary for local replay below; it is required for SePay to
   reach localhost over the Internet. Stop sending demo transfers when offline.

## Local HTTP replay (isolated rehearsal DB only)

Create an order first. Use its exact code and amount. In PowerShell at repo root,
load the key without displaying it, then send a payload twice:

```powershell
$keyLine = Get-Content -LiteralPath '.\backend\.env' |
  Where-Object { $_ -match '^\s*SEPAY_WEBHOOK_API_KEY\s*=' } |
  Select-Object -First 1
$webhookKey = (($keyLine -split '=', 2)[1]).Trim().Trim('"').Trim("'")
$payload = @{
  id = 123456789 # same unique ID for both deliveries; do not reuse for another transfer
  gateway = 'TPBank'
  transactionDate = '2026-11-12 10:00:00'
  accountNumber = '<configured receiving account>'
  subAccount = $null
  code = 'NH12345678' # replace with your fresh order's code
  content = 'NH12345678'
  transferType = 'in'
  transferAmount = 50000 # replace with the order amount
} | ConvertTo-Json
1..2 | ForEach-Object {
  Invoke-RestMethod -Uri 'http://localhost:4000/api/webhooks/sepay' `
    -Method Post -Headers @{ Authorization = "Apikey $webhookKey" } `
    -ContentType 'application/json' -Body $payload
}
Remove-Variable webhookKey, keyLine
```

Expected: two successful acknowledgements, one receipt ID, one `topup-credit`,
wallet increased only once. Wrong amount, expired code or duplicate payment for
an already-paid order creates review evidence instead of another automatic credit.
Admin opens Transactions → Bank → Details, verifies payer/order, then resolves
with a mandatory reason. Concurrent/stale submissions return 409; exact retries
of an already completed identical resolution are idempotent.

## Automatic simulated payouts

Only the designated demo backend sets `PAYOUT_WORKER_ENABLED=true`. At the first
tick on the 1st, Vietnam time, it evaluates the preceding cutoff balance and
creates one simulated obligation per eligible account/period. A late start can
catch up the current period. New earnings after cutoff stay for the next period.

Admin opens Payouts to view the run and statistics; there is no Generate or Pay
button. A successful result explicitly says simulation and has `SIM-AUTO-…`
evidence. No bank transfer is made. Legacy/external obligations are left alone.

For a simulated obligation with missing/invalid destination or Failed result,
open Details and correct bank information with a verified support reason. A
deleted account follows the same Admin support path. An active Author can update
their bank profile to repair their own failed/invalid obligations. Original
snapshots remain immutable; the next worker tick (up to 30 seconds when running)
simulates the corrected destination without a second wallet debit. Invalid bank
details on a normal account prevent reservation in the first place.

At demo end, turn the designated worker off before restarting against any shared
database. Manual real-transfer recording (A-UC-13.1) is excluded from this demo.
