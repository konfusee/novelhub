import { withTransaction } from '../../db/connection.js'
import { HttpError } from '../../middleware/errors.js'
import { Account } from '../../models/index.js'

/**
 * Reader-owned write: runs `work(session, account)` in one transaction after a CAS on
 * the signed-in account (still active, same credential and authorization epochs).
 */
export async function ownerWrite(req, work) {
  return withTransaction(async session => {
    const account = await Account.findOneAndUpdate(
      {
        _id: req.account._id,
        status: 'active',
        credentialVersion: req.account.credentialVersion,
        authorizationEpoch: req.account.authorizationEpoch,
      },
      { $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    )
    if (!account) throw new HttpError(403, 'forbidden', 'Tài khoản không còn hoạt động.')
    return work(session, account)
  })
}
