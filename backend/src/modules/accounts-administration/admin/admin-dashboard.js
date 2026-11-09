import {
  Account,
  AuditEvent,
  AuthorApplication,
  PublicationSubmission,
  RoleAssignment,
  Story,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
export async function adminDashboard(now = new Date()) {
  return withTransaction(async session => {
    const activeAccounts = await Account.countDocuments({
      status: 'active',
    }).session(session)
    const [authors] = await RoleAssignment.aggregate([
      {
        $match: {
          role: 'author',
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$accountId',
        },
      },
      {
        $lookup: {
          from: Account.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'account',
        },
      },
      {
        $match: {
          'account.status': 'active',
        },
      },
      {
        $count: 'count',
      },
    ]).session(session)
    const publishedStories = await Story.countDocuments({
      publicationStatus: 'published',
      publishedRevisionId: {
        $ne: null,
      },
    }).session(session)
    const pendingApplications = await AuthorApplication.countDocuments({
      status: 'submitted',
    }).session(session)
    const reviewQueue = await PublicationSubmission.countDocuments({
      status: 'pending-review',
    }).session(session)
    const audit = await AuditEvent.find({
      occurredAt: {
        $lte: now,
      },
    })
      .sort({
        occurredAt: -1,
        _id: -1,
      })
      .limit(4)
      .select('actorType actorId action result occurredAt')
      .session(session)
      .lean()
    return {
      asOf: now,
      kpis: Object.entries({
        activeAccounts,
        activeAuthors: authors?.count ?? 0,
        publishedStories,
        pendingApplications,
        reviewQueue,
      }),
      actions: audit.map(row => [
        row.occurredAt.toISOString(),
        row.actorId ? String(row.actorId) : row.actorType,
        row.action,
        row.result,
      ]),
    }
  })
}
