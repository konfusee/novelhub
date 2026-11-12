import {
  Account,
  AuditEvent,
  EmailToken,
  RoleAssignment,
  Session,
  ExternalIdentity,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { digest } from '../../authoring-publishing/submissions/submission-digests.js'
import { runLifecycleHooks } from '../lifecycle.js'

// Anonymization and all field hooks commit atomically. Provider calls run later.
export async function closeAuthorAccount(admin, accountId, input) {
  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        authorizationEpoch: admin.authorizationEpoch,
        credentialVersion: admin.credentialVersion,
      },
      { $inc: { version: 1 } },
      { session },
    )
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!actor || !allowed)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    if (String(admin._id) === accountId)
      throw new HttpError(409, 'protected_account', 'Không thể tự đóng tài khoản.')
    const target = await Account.findById(accountId)
      .select('+password +bankDetails +retainedPayoutEmail +finalPayoutBankDetailsSnapshot')
      .session(session)
    if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản.')
    if (
      await RoleAssignment.exists({
        accountId,
        role: { $in: ['moderator', 'admin'] },
        status: 'active',
      }).session(session)
    )
      throw new HttpError(409, 'protected_account', 'Không thể thao tác với tài khoản nhân sự.')
    if (
      target.version !== input.expectedVersion ||
      !['active', 'suspended', 'pending-verification'].includes(target.status)
    )
      throw new HttpError(409, 'account_changed', 'Tài khoản đã thay đổi. Hãy tải lại.')
    const now = new Date()
    const results = await runLifecycleHooks('onAccountDeleted', {
      account: target,
      accountId: target._id,
      actorAccountId: admin._id,
      session,
      now,
      reason: 'account-deleted',
    })
    await ExternalIdentity.deleteMany({ accountId }, { session })
    target.status = 'anonymized'
    target.closedAt = now
    target.anonymizedAt = now
    target.displayName = 'Deleted user'
    target.profile = undefined
    target.preferences = undefined
    target.email = undefined
    target.password = undefined
    target.twoFactorEnabled = false
    target.credentialVersion++
    target.authorizationEpoch++
    await target.save({ session })
    await RoleAssignment.updateMany(
      { accountId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await Session.updateMany(
      { accountId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await EmailToken.updateMany(
      { accountId, usedAt: null, revokedAt: null },
      { $set: { revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'account.anonymized',
          targetType: 'Account',
          targetId: target._id,
          targetVersion: target.version,
          result: 'success',
          reason: input.reason,
          occurredAt: now,
          dataDigest: digest({
            stories: results['authoring-publishing'].frozenStories,
            cancelledSubmissions: results['authoring-publishing'].cancelledSubmissions,
          }),
        },
      ],
      { session },
    )
    return {
      account: {
        id: String(target._id),
        status: target.status,
        version: target.version,
      },
    }
  })
}
