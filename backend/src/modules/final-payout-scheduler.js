import { Account } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';
import { evaluateFinalPayout, monthlyCutoff } from './admin-final-payout.js';

export async function evaluateDueFinalPayouts({ now = new Date(), logger } = {}) {
  const cutoff = monthlyCutoff(now);
  const cursor = Account.find({
    status: 'anonymized',
    everAuthor: true,
    financiallyClosedAt: null,
    finalPayoutEvaluatedAt: null,
    closedAt: { $lt: cutoff.at },
  })
    .select('_id version')
    .sort({ closedAt: 1, _id: 1 })
    .cursor({ batchSize: 25 });
  const results = { evaluated: 0, changed: 0, failed: 0 };
  try {
    for await (const account of cursor) {
      try {
        await evaluateFinalPayout(
          null,
          String(account._id),
          { expectedVersion: account.version, reason: `Đánh giá cuối tự động kỳ ${cutoff.period}` },
          now,
        );
        results.evaluated++;
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) results.changed++;
        else {
          results.failed++;
          logger?.error(
            { err: error, accountId: String(account._id) },
            'Final payout evaluation failed',
          );
        }
      }
    }
  } finally {
    await cursor.close();
  }
  return results;
}

// The cutoff predicate enforces the monthly boundary. Startup also catches up after downtime.
export function startFinalPayoutScheduler(logger, { intervalMs = 60000 } = {}) {
  let stopped = false,
    running;
  const tick = () => {
    if (stopped || running) return;
    running = evaluateDueFinalPayouts({ logger })
      .catch((error) => logger?.error({ err: error }, 'Final payout scheduler failed'))
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
