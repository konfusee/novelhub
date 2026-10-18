import { Account, PolicyVersion } from '../models/index.js';

export async function authorPayoutReadiness(accountId, balance, now) {
  const [account, policy] = await Promise.all([
    Account.findById(accountId).select('status everAuthor +bankDetails').lean(),
    PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
      .sort({ effectiveAt: -1, _id: -1 })
      .lean(),
  ]);
  const local = new Date(now.getTime() + 7 * 3600000);
  const nextEvaluationAt = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - 7 * 3600000,
  );
  const threshold = policy?.withdrawalThresholdCoins;
  if (
    !account ||
    account.status !== 'active' ||
    !account.everAuthor ||
    !Number.isSafeInteger(threshold) ||
    threshold < 0 ||
    !Number.isSafeInteger(balance) ||
    balance < 0
  )
    return { state: 'unavailable', nextEvaluationAt };
  const bankComplete = ['bankName', 'accountNumber', 'accountHolder'].every(
    (key) => typeof account.bankDetails?.[key] === 'string' && account.bankDetails[key].trim(),
  );
  return {
    state:
      balance <= 0 || balance < threshold
        ? 'below-threshold'
        : bankComplete
          ? 'eligible'
          : 'bank-required',
    thresholdCoins: threshold,
    shortfallCoins: Math.max(0, threshold - balance),
    nextEvaluationAt,
  };
}
