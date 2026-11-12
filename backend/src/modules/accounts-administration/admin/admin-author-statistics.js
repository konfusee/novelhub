import {
  Account,
  AuthorApplication,
  RoleAssignment,
  UnlockEntitlement,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
function statisticsPeriod(period) {
  if (period === 'all') return null
  const [year, month] = period.split('-').map(Number)
  return {
    $gte: new Date(Date.UTC(year, month - 1, 1) - 7 * 3600000),
    $lt: new Date(Date.UTC(year, month, 1) - 7 * 3600000),
  }
}
import { HttpError } from '../../../middleware/errors.js'
export async function adminAuthorStatistics(period, now = new Date()) {
  const range = {
    ...(statisticsPeriod(period) ?? {}),
    $lte: now,
  }
  return withTransaction(async session => {
    const applications = await AuthorApplication.countDocuments({
      submittedAt: range,
    }).session(session)
    const approvedApplications = await AuthorApplication.countDocuments({
      status: 'approved',
      decidedAt: range,
    }).session(session)
    const rejectedApplications = await AuthorApplication.countDocuments({
      status: 'rejected',
      decidedAt: range,
    }).session(session)
    const pendingApplications = await AuthorApplication.countDocuments({
      status: 'submitted',
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
    const registrations = await Account.countDocuments({ createdAt: range }).session(session)
    const unlocks = await UnlockEntitlement.countDocuments({
      purchasedAt: range,
    }).session(session)
    const summary = {
      registrations,
      unlocks,
      applications,
      approvedApplications,
      rejectedApplications,
      pendingApplications,
      activeAuthors: authors?.count ?? 0,
    }
    if (Object.values(summary).some(value => !Number.isSafeInteger(value) || value < 0))
      throw new HttpError(409, 'invalid_statistics', 'Số liệu thống kê không hợp lệ.')
    return {
      summary,
      period,
      asOf: now,
    }
  })
}
