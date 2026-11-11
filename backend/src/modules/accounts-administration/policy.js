import { PolicyVersion } from '../../models/index.js'
import { HttpError } from '../../middleware/errors.js'

/** Read the policy effective at `now`, optionally in the caller's transaction. */
export async function getEffective({ now = new Date(), session = null, required = true } = {}) {
  const policy = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
    .sort({ effectiveAt: -1, _id: -1 })
    .session(session)
    .lean()
  if (!policy && required)
    throw new HttpError(409, 'policy_required', 'Chưa có chính sách có hiệu lực.')
  return policy
}
export const policy = { getEffective }
