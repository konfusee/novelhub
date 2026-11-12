import { Account, AuthorApplication, RoleAssignment, UnlockRequest } from '../../../models/index.js'
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
export async function adminAuthorStatistics(period, options = {}) {
  const normalized = options instanceof Date ? { now: options } : options
  const { accountStatus = 'all', now = new Date() } = normalized
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
    const registrations = await Account.countDocuments({
      createdAt: range,
      ...(accountStatus === 'all' ? {} : { status: accountStatus }),
    }).session(session)
    const unlockCounts = await UnlockRequest.aggregate([
      { $match: { createdAt: range } },
      {
        $lookup: {
          from: Account.collection.name,
          localField: 'accountId',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $unwind: '$account' },
      ...(accountStatus === 'all' ? [] : [{ $match: { 'account.status': accountStatus } }]),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).session(session)
    const unlocksByStatus = new Map(unlockCounts.map(row => [row._id, row.count]))
    const unlocks = unlocksByStatus.get('committed') ?? 0
    const summary = {
      registrations,
      unlocks,
      requestedUnlocks: unlocksByStatus.get('requested') ?? 0,
      rejectedUnlocks: unlocksByStatus.get('rejected') ?? 0,
      committedUnlocks: unlocksByStatus.get('committed') ?? 0,
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
