import { HttpError } from '../../../middleware/errors.js'
import { Account, RoleAssignment } from '../../../models/index.js'
import { lockAuthor } from '../../authoring-publishing/author/author-ownership.js'

const forbidden = () =>
  new HttpError(403, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.')

// Rechecks the Moderator's authority inside a moderation write (SDS ModeratorAccess.lockModerator):
// the account version CAS serializes the write with role or epoch changes on the same account.
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
  if (!locked) throw forbidden()
  const allowed = await RoleAssignment.exists({
    accountId: account._id,
    role: 'moderator',
    status: 'active',
  }).session(session)
  if (!allowed) throw forbidden()
  return locked
}

// Locks the submitting author with the author flows' own lock. For a moderator, an inactive
// author means the submission is no longer eligible (UC-MOD-02 EX2, UC-MOD-04 EX3).
export async function lockSubmissionAuthor(authorAccountId, session) {
  const author = await Account.findById(authorAccountId)
    .select('status authorizationEpoch credentialVersion')
    .session(session)
    .lean()
  try {
    if (!author) throw forbidden()
    await lockAuthor(author, session)
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) throw submissionChanged()
    throw error
  }
  return author
}

export const submissionChanged = () =>
  new HttpError(
    409,
    'submission_changed',
    'Hồ sơ đã thay đổi hoặc không còn đủ điều kiện. Hãy tải lại trước khi quyết định.',
  )
