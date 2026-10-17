import { Account, AuditEvent, PolicyVersion, RoleAssignment } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { digest } from './submission-digests.js';

// Reserved identity of the first real policy. MongoDB's _id uniqueness serializes
// concurrent initialization across different Admins without a schema or lock collection.
const INITIAL_POLICY_ID = '000000000000000000000001';
const inheritedFields = [
  'withdrawalThresholdCoins',
  'authorSharePercent',
  'platformSharePercent',
  'orderExpiryHours',
  'claimExpiryHours',
];

export async function activatePolicy(admin, input) {
  try {
    return await withTransaction(async (session) => {
      const actor = await Account.findOneAndUpdate(
        {
          _id: admin._id,
          status: 'active',
          authorizationEpoch: admin.authorizationEpoch,
          credentialVersion: admin.credentialVersion,
        },
        { $inc: { version: 1 } },
        { session },
      );
      const role = await RoleAssignment.exists({
        accountId: admin._id,
        role: 'admin',
        status: 'active',
      }).session(session);
      if (!actor || !role)
        throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.');
      const now = new Date();
      const future = await PolicyVersion.exists({
        status: 'effective',
        effectiveAt: { $gt: now },
      }).session(session);
      if (future)
        throw new HttpError(
          409,
          'future_policy',
          'Đã có chính sách hiệu lực trong tương lai. Cần xử lý chính sách đó trước.',
        );
      const previous = await PolicyVersion.findOne({
        status: 'effective',
        effectiveAt: { $lte: now },
      })
        .sort({ effectiveAt: -1, _id: -1 })
        .session(session);
      if (
        (previous ? String(previous._id) : null) !== input.expectedPolicyId ||
        (previous?.version ?? null) !== input.expectedPolicyVersion
      )
        throw new HttpError(409, 'policy_changed', 'Chính sách đã thay đổi. Hãy tải lại.');
      if (previous) {
        if (previous.effectiveAt >= now)
          throw new HttpError(
            409,
            'policy_changed',
            'Hãy tải lại trước khi tạo phiên bản tiếp theo.',
          );
        const pinned = await PolicyVersion.findOneAndUpdate(
          { _id: previous._id, version: previous.version, status: 'effective' },
          { $set: { status: 'superseded' }, $inc: { version: 1 } },
          { session },
        );
        if (!pinned)
          throw new HttpError(409, 'policy_changed', 'Chính sách đã thay đổi. Hãy tải lại.');
      }
      const inherited = previous
        ? Object.fromEntries(inheritedFields.map((field) => [field, previous[field]]))
        : {};
      const [policy] = await PolicyVersion.create(
        [
          {
            ...(!previous ? { _id: INITIAL_POLICY_ID } : {}),
            ...inherited,
            ...(input.authorSharePercent !== undefined
              ? {
                  authorSharePercent: input.authorSharePercent,
                  platformSharePercent: 100 - input.authorSharePercent,
                }
              : {}),
            ...(input.withdrawalThresholdCoins !== undefined
              ? {
                  withdrawalThresholdCoins: input.withdrawalThresholdCoins,
                }
              : {}),
            status: 'effective',
            effectiveAt: now,
            actorAccountId: admin._id,
            priceMinCoins: input.priceMinCoins,
            priceMaxCoins: input.priceMaxCoins,
            durationMinDays: input.durationMinDays,
            durationMaxDays: input.durationMaxDays,
          },
        ],
        { session },
      );
      await AuditEvent.create(
        [
          {
            actorType: 'account',
            actorId: admin._id,
            action: 'policy.activated',
            targetType: 'policy',
            targetId: policy._id,
            targetVersion: policy.version,
            result: 'accepted',
            reason: input.reason,
            occurredAt: now,
            dataDigest: digest({
              previousPolicyId: input.expectedPolicyId,
              policy: policy.toObject(),
            }),
          },
        ],
        { session },
      );
      return { policyId: String(policy._id), version: policy.version };
    });
  } catch (error) {
    if (error.code === 11000)
      throw new HttpError(409, 'policy_changed', 'Chính sách đã được khởi tạo. Hãy tải lại.');
    throw error;
  }
}

// Match the policy selection used by Author configuration; never fabricate defaults.
export async function adminPolicy(now = new Date()) {
  const policy = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
    .sort({ effectiveAt: -1, _id: -1 })
    .select(
      'version effectiveAt priceMinCoins priceMaxCoins durationMinDays durationMaxDays authorSharePercent platformSharePercent withdrawalThresholdCoins orderExpiryHours claimExpiryHours',
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
          withdrawalThresholdCoins: policy.withdrawalThresholdCoins,
          orderExpiryHours: policy.orderExpiryHours,
          claimExpiryHours: policy.claimExpiryHours,
        }
      : null,
  };
}
