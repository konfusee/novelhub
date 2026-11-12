import { Account, RoleAssignment } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'

// Lock the authorization snapshot together with the financial write.
export async function requireCurrentAdmin(admin, session) {
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
  const role = await RoleAssignment.exists({
    accountId: admin._id,
    role: 'admin',
    status: 'active',
  }).session(session)
  if (!actor || !role) throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
}
