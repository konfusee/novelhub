import { Account, AuditEvent, PolicyVersion, RoleAssignment } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { digest } from './submission-digests.js';

// Reserved identity of the first real policy. MongoDB's _id uniqueness serializes
// concurrent initialization across different Admins without a schema or lock collection.
const INITIAL_POLICY_ID = '000000000000000000000001';
const policyFields =
  'version status effectiveAt priceMinCoins priceMaxCoins durationMinDays durationMaxDays authorSharePercent platformSharePercent withdrawalThresholdCoins orderExpiryHours claimExpiryHours';
const inheritedFields = [
  'withdrawalThresholdCoins',
  'authorSharePercent',
  'platformSharePercent',
  'orderExpiryHours',
  'claimExpiryHours',
];

export async function cancelFuturePolicy(admin, policyId, input) {
  return withTransaction(async (session) => {
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
    const policy = await PolicyVersion.findById(policyId).session(session);
    if (!policy) throw new HttpError(404, 'not_found', 'Không tìm thấy chính sách.');
    const now = new Date();
    if (
      policy.version !== input.expectedVersion ||
      policy.status !== 'effective' ||
      !policy.effectiveAt ||
      policy.effectiveAt <= now
    )
      throw new HttpError(
        409,
        'policy_changed',
        'Chính sách đã thay đổi hoặc đã đến ngày hiệu lực. Hãy tải lại.',
      );
    const updated = await PolicyVersion.findOneAndUpdate(
      {
        _id: policy._id,
        version: input.expectedVersion,
        status: 'effective',
        effectiveAt: { $gt: now },
      },
      { $set: { status: 'superseded' }, $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!updated)
      throw new HttpError(409, 'policy_changed', 'Chính sách đã thay đổi. Hãy tải lại.');
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'policy.cancelled',
          targetType: 'policy',
          targetId: policy._id,
          targetVersion: updated.version,
          result: 'accepted',
          reason: input.reason,
          occurredAt: now,
          dataDigest: digest({
            policyId,
            previousVersion: policy.version,
            effectiveAt: policy.effectiveAt,
            cancelledVersion: updated.version,
          }),
        },
      ],
      { session },
    );
    return { policyId: String(updated._id), version: updated.version };
  });
}

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
    .select(policyFields)
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

export async function adminPolicyHistory({ page, pageSize }, now = new Date()) {
  // Read a consistent page/count/current identity while activation may run concurrently.
  return withTransaction(async (session) => {
    const current = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
      .sort({ effectiveAt: -1, _id: -1 })
      .select('_id')
      .session(session)
      .lean();
    const total = await PolicyVersion.countDocuments().session(session);
    const rows = await PolicyVersion.find()
      .sort({ effectiveAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .select(policyFields)
      .session(session)
      .lean();
    const audits = await AuditEvent.find({
      targetType: 'policy',
      targetId: { $in: rows.map((row) => row._id) },
      action: { $in: ['policy.activated', 'policy.cancelled'] },
      result: 'accepted',
    })
      .sort({ occurredAt: -1, _id: -1 })
      .select('targetId action reason')
      .session(session)
      .lean();
    const reasons = new Map();
    for (const audit of audits)
      if (!reasons.has(`${audit.targetId}:${audit.action}`))
        reasons.set(
          `${audit.targetId}:${audit.action}`,
          typeof audit.reason === 'string' ? audit.reason.slice(0, 1000) : null,
        );
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        version: row.version,
        status: row.status,
        current: String(row._id) === String(current?._id),
        future: row.status === 'effective' && row.effectiveAt > now,
        effectiveAt: row.effectiveAt ?? null,
        priceMinCoins: row.priceMinCoins,
        priceMaxCoins: row.priceMaxCoins,
        durationMinDays: row.durationMinDays,
        durationMaxDays: row.durationMaxDays,
        authorSharePercent: row.authorSharePercent,
        platformSharePercent: row.platformSharePercent,
        withdrawalThresholdCoins: row.withdrawalThresholdCoins,
        orderExpiryHours: row.orderExpiryHours,
        claimExpiryHours: row.claimExpiryHours,
        reason: reasons.get(`${row._id}:policy.activated`) ?? null,
        cancelled: row.status === 'superseded' && reasons.has(`${row._id}:policy.cancelled`),
        cancellationReason: reasons.get(`${row._id}:policy.cancelled`) ?? null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  });
}
