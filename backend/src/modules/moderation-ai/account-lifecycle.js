import { ContentReport, PublicationSubmission } from '../../models/index.js'
import { endClaim } from './moderation/claim-lease.js'

/** Release live claims while preserving the original actor/history. */
export async function releaseAccountClaims({
  accountId,
  actorAccountId,
  session,
  now = new Date(),
  reason,
}) {
  for (const [Model, status, reopened] of [
    [PublicationSubmission, 'decision-pending', 'pending-review'],
    [ContentReport, 'under-review', 'open'],
  ]) {
    const rows = await Model.find({ claimOwnerAccountId: accountId }).session(session)
    for (const row of rows) {
      endClaim(row, reason, actorAccountId, now)
      if (row.status === status) row.status = reopened
      await row.save({ session })
    }
  }
}
