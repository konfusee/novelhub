import { HttpError } from '../../middleware/errors.js'
import { Account, RoleAssignment } from '../../models/index.js'
import { lockAuthor } from '../author-ownership.js'

// Serializes a moderator write with role or epoch changes on the same account.
// Same CAS as the private lockAccount in author-access/service.js.
export async function lockModerator(account, session) {
  const locked = await Account.findOneAndUpdate(
    {
      _id: account._id,
      status: 'active',
      authorizationEpoch: account.authorizationEpoch,
      credentialVersion: account.credentialVersion,
    },
    { $inc: { version: 1 } },
    { session, returnDocument: 'after' },
  )
  if (!locked)
    throw new HttpError(409, 'account_changed', 'Quyền tài khoản vừa thay đổi. Hãy tải lại.')
  const allowed = await RoleAssignment.exists({
    accountId: account._id,
    role: 'moderator',
    status: 'active',
  }).session(session)
  if (!allowed) throw new HttpError(403, 'forbidden', 'Quyền kiểm duyệt không còn hiệu lực.')
  return locked
}

// Locks the submitting author with the author flows' own lock.
// For a moderator, an inactive author is a conflict, not a permission error.
export async function lockSubmissionAuthor(authorAccountId, session) {
  const author = await Account.findById(authorAccountId)
    .select('status authorizationEpoch credentialVersion')
    .session(session)
    .lean()
  try {
    if (!author) throw new HttpError(403, 'forbidden', 'Không tìm thấy tác giả.')
    await lockAuthor(author, session)
  } catch (error) {
    if (error instanceof HttpError && error.status === 403)
      throw new HttpError(409, 'author_unavailable', 'Tài khoản tác giả không còn hoạt động.')
    throw error
  }
  return author
}
