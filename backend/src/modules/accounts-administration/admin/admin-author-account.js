import { Account, AuditEvent, RoleAssignment, Session } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { runLifecycleHooks } from '../lifecycle.js'

export async function changeAuthorAccount(admin, accountId, input) {
  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        authorizationEpoch: admin.authorizationEpoch,
        credentialVersion: admin.credentialVersion,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    )
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!actor || !allowed)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    if (String(admin._id) === accountId)
      throw new HttpError(409, 'protected_account', 'Không thể tự khóa tài khoản.')
    const target = await Account.findById(accountId).session(session)
    if (!target) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản.')
    if (
      input.action === 'suspend' &&
      (await RoleAssignment.exists({
        accountId,
        role: { $in: ['moderator', 'admin'] },
        status: 'active',
      }).session(session))
    )
      throw new HttpError(409, 'protected_account', 'Không thể thao tác với tài khoản nhân sự.')
    const from = input.action === 'suspend' ? 'active' : 'suspended'
    if (target.version !== input.expectedVersion || target.status !== from)
      throw new HttpError(
        409,
        'account_changed',
        'Tài khoản đã thay đổi. Hãy tải lại trước khi thao tác.',
      )
    const now = new Date()
    target.status = input.action === 'suspend' ? 'suspended' : 'active'
    if (input.action === 'suspend') target.suspendedAt = now
    target.authorizationEpoch++
    await target.save({ session })
    if (input.action === 'suspend')
      await runLifecycleHooks('onAccountSuspended', {
        accountId: target._id,
        actorAccountId: admin._id,
        session,
        now,
        reason: 'account-suspended',
      })
    await Session.updateMany(
      { accountId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now }, $inc: { version: 1 } },
      { session },
    )
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          targetType: 'Account',
          targetId: target._id,
          targetVersion: target.version,
          action: `account.${input.action === 'suspend' ? 'suspended' : 'restored'}`,
          result: 'success',
          reason: input.reason,
          occurredAt: now,
          operationType: 'author-account-status',
        },
      ],
      { session },
    )
    return { account: { id: String(target._id), status: target.status, version: target.version } }
  })
}
