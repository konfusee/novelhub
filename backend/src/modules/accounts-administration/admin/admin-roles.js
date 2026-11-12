import { notify } from '../notifications.js'
import { Account, AuditEvent, RoleAssignment, Session } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { runLifecycleHooks } from '../lifecycle.js'

export async function adminRoles() {
  const [counts, total] = await Promise.all([
    RoleAssignment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Account.countDocuments({ status: { $ne: 'anonymized' } }),
  ])
  return {
    roles: ['reader', 'author', 'moderator', 'admin'].map(role => ({
      role,
      count: role === 'reader' ? total : (counts.find(row => row._id === role)?.count ?? 0),
    })),
  }
}

export async function changeStaffRole(admin, accountId, input) {
  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        credentialVersion: admin.credentialVersion,
        authorizationEpoch: admin.authorizationEpoch,
      },
      { $inc: { version: 1 } },
      { session },
    )
    const authorized = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!actor || !authorized)
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    if (String(admin._id) === String(accountId))
      throw new HttpError(409, 'protected_account', 'Không thể tự thay đổi vai trò.')
    const target = await Account.findOneAndUpdate(
      {
        _id: accountId,
        version: input.expectedVersion,
        status: 'active',
        emailVerifiedAt: { $ne: null },
      },
      { $inc: { version: 1, authorizationEpoch: 1 } },
      { session, returnDocument: 'after' },
    )
    if (!target)
      throw new HttpError(
        409,
        'account_changed',
        'Tài khoản đã thay đổi hoặc chưa được xác minh. Hãy tải lại.',
      )
    const previous = await RoleAssignment.findOne({ accountId, status: 'active' }).session(session)
    if (['author', 'admin'].includes(previous?.role))
      throw new HttpError(409, 'SYS-MSG-NEW-S08', 'Vai trò hiện tại xung đột với thay đổi này.')
    if (previous?.role === input.role || (!previous && input.role === 'reader'))
      throw new HttpError(409, 'role_unchanged', 'Vai trò không thay đổi.')
    if (input.role === 'moderator' && target.everAuthor)
      throw new HttpError(
        409,
        'former_author',
        'Tài khoản từng là tác giả không thể làm kiểm duyệt viên.',
      )
    const now = new Date()
    if (previous) {
      previous.status = 'revoked'
      previous.revokedAt = now
      await previous.save({ session })
      await runLifecycleHooks('onStaffRoleRevoked', {
        accountId: target._id,
        actorAccountId: admin._id,
        session,
        now,
        reason: 'staff-role-revoked',
      })
    }
    if (input.role !== 'reader')
      await RoleAssignment.create(
        [{ accountId, role: input.role, grantedBy: admin._id, grantedAt: now }],
        { session },
      )
    await Session.updateMany(
      { accountId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now } },
      { session },
    )
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'account.role-changed',
          targetType: 'Account',
          targetId: target._id,
          targetVersion: target.version,
          result: 'accepted',
          reason: input.reason,
          occurredAt: now,
        },
      ],
      { session },
    )
    await notify(
      {
        recipientAccountId: target._id,
        eventType: 'system.role-changed',
        sourceEventKey: `account-role:${target.version}`,
        payload: { role: input.role },
      },
      { session },
    )
    return { account: { id: String(target._id), version: target.version, role: input.role } }
  })
}
