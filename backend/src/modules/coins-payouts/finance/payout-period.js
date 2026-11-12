import { LedgerEntry } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'

export function currentPayoutPeriod(now = new Date()) {
  return new Date(+now + 7 * 3600_000).toISOString().slice(0, 7)
}

export function payoutCutoff(periodId) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodId))
    throw new HttpError(400, 'invalid_payout_period', 'Kỳ chi trả không hợp lệ.')
  return new Date(`${periodId}-01T00:00:00+07:00`)
}

// Earnings received after the cutoff stay in the wallet for the next period.
// Subsequent debits consume the old balance first. This also makes late recovery safe.
export async function availableAtCutoff(wallet, periodId, session) {
  if (!wallet) return 0
  const credits = await LedgerEntry.aggregate([
    {
      $match: {
        walletId: wallet._id,
        direction: 'credit',
        occurredAt: { $gte: payoutCutoff(periodId) },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).session(session)
  const amount = Math.max(0, wallet.availableBalance - (credits[0]?.total ?? 0))
  if (!Number.isSafeInteger(amount))
    throw new HttpError(409, 'invalid_payout_amount', 'Số dư chi trả không hợp lệ.')
  return amount
}
