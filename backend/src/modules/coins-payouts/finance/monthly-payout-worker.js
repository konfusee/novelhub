import { MonthlyPayoutRun, WithdrawalRequest } from '../../../models/index.js'
import { payoutCutoff } from './payout-period.js'
import { simulatePendingPayouts } from './automatic-payout-results.js'
import { generateMonthlyPayouts } from './admin-monthly-payouts.js'
import { evaluateDeletedAccountPayouts } from '../account-lifecycle.js'

export async function runMonthlyPayouts(now = new Date()) {
  const periodId = new Date(+now + 7 * 3600_000).toISOString().slice(0, 7)
  await MonthlyPayoutRun.updateOne(
    { periodId },
    {
      $setOnInsert: {
        periodId,
        cutoffAt: payoutCutoff(periodId),
        executionMode: 'simulation',
        status: 'processing',
      },
    },
    { upsert: true },
  )
  try {
    await evaluateDeletedAccountPayouts(now)
    const generated = await generateMonthlyPayouts(null, periodId, now)
    const payments = await simulatePendingPayouts(now)
    const periods = await WithdrawalRequest.distinct('periodId')
    for (const period of new Set([periodId, ...periods])) {
      const rows = await WithdrawalRequest.find({ periodId: period })
        .select('status amountCoins')
        .lean()
      const pendingCount = rows.filter(row => row.status === 'pending').length
      await MonthlyPayoutRun.updateOne(
        { periodId: period },
        {
          $set: {
            status: pendingCount ? 'pending' : 'completed',
            lastEvaluatedAt: now,
            totalCount: rows.length,
            pendingCount,
            paidCount: rows.length - pendingCount,
            totalCoins: rows.reduce((total, row) => total + row.amountCoins, 0),
          },
        },
      )
    }
    return { ...generated, payments }
  } catch (error) {
    await MonthlyPayoutRun.updateOne(
      { periodId },
      { $set: { status: 'failed', lastEvaluatedAt: now } },
    )
    throw error
  }
}

// The first tick after 00:00 Vietnam on the 1st opens the new period.
// Startup/daily recovery handles downtime and missing bank details. Database
// uniqueness and transactional wallet writes make retries/multiple servers safe.
export function startMonthlyPayoutWorker(logger) {
  let stopped = false,
    active = null,
    completedDay = null
  const tick = () => {
    const now = new Date()
    const day = new Date(+now + 7 * 3600_000).toISOString().slice(0, 10)
    if (stopped || active || day === completedDay) return
    active = runMonthlyPayouts(now)
      .then(() => {
        completedDay = day
      })
      .catch(error => logger?.error({ err: error }, 'monthly payout worker failed'))
      .finally(() => {
        active = null
      })
  }
  const timer = setInterval(tick, 30_000)
  timer.unref()
  tick()
  return async () => {
    stopped = true
    clearInterval(timer)
    await active
  }
}
