import { PolicyVersion } from '../models/index.js';

// Match the policy selection used by Author configuration; never fabricate defaults.
export async function adminPolicy(now = new Date()) {
  const policy = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
    .sort({ effectiveAt: -1, _id: -1 })
    .select(
      'version effectiveAt priceMinCoins priceMaxCoins durationMinDays durationMaxDays authorSharePercent platformSharePercent',
    )
    .lean();
  return {
    policy: policy
      ? {
          id: String(policy._id),
          version: policy.version,
          effectiveAt: policy.effectiveAt,
          priceMinCoins: policy.priceMinCoins,
          priceMaxCoins: policy.priceMaxCoins,
          durationMinDays: policy.durationMinDays,
          durationMaxDays: policy.durationMaxDays,
          authorSharePercent: policy.authorSharePercent,
          platformSharePercent: policy.platformSharePercent,
        }
      : null,
  };
}
