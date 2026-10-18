import { Account, AuditEvent, NotificationOutbox, WithdrawalRequest } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { monthlyCutoff } from './admin-final-payout.js';
import { financePeriod } from './admin-finance-report.js';

export async function payoutOperations({ period, page = 1 }, now = new Date()) {
  period ??= monthlyCutoff(now).period;
  return withTransaction(async (session) => {
    const match = {
      $or: [
        {
          action: 'author.monthly-payout.evaluated',
          correlationId: period,
          occurredAt: { $lte: now },
        },
        {
          action: 'account.final-payout.evaluated',
          occurredAt: { ...financePeriod(period), $lte: now },
        },
      ],
    };
    const [audit] = await AuditEvent.aggregate([
      { $match: match },
      {
        $facet: {
          results: [{ $group: { _id: '$result', count: { $sum: 1 } } }],
          total: [{ $count: 'count' }],
          items: [
            { $sort: { occurredAt: -1, _id: -1 } },
            { $skip: (page - 1) * 20 },
            { $limit: 20 },
            { $project: { action: 1, result: 1, targetId: 1, occurredAt: 1 } },
          ],
        },
      },
    ]).session(session);
    const periodStart = financePeriod(period).$gte;
    const [remaining] = await Account.aggregate([
      { $match: { status: 'active', everAuthor: true, createdAt: { $lt: periodStart } } },
      {
        $lookup: {
          from: AuditEvent.collection.name,
          localField: '_id',
          foreignField: 'targetId',
          pipeline: [
            { $match: { action: 'author.monthly-payout.evaluated', correlationId: period } },
            { $limit: 1 },
          ],
          as: 'evaluation',
        },
      },
      { $match: { evaluation: { $size: 0 } } },
      {
        $lookup: {
          from: WithdrawalRequest.collection.name,
          localField: '_id',
          foreignField: 'accountId',
          pipeline: [{ $match: { periodId: period } }, { $limit: 1 }],
          as: 'withdrawal',
        },
      },
      { $match: { withdrawal: { $size: 0 } } },
      { $count: 'count' },
    ]).session(session);
    const source = /^withdrawal-(created|result):/;
    const pendingEmails = await NotificationOutbox.countDocuments({
      sourceEventKey: source,
      status: { $in: ['pending', 'claimed'] },
    }).session(session);
    const failedEmails = await NotificationOutbox.countDocuments({
      sourceEventKey: source,
      status: 'failed',
    }).session(session);
    const expiredEmailLeases = await NotificationOutbox.countDocuments({
      sourceEventKey: source,
      status: 'claimed',
      leaseExpiresAt: { $lte: now },
    }).session(session);
    const pendingWithdrawals = await WithdrawalRequest.countDocuments({
      periodId: period,
      status: 'pending',
    }).session(session);
    const paidWithdrawals = await WithdrawalRequest.countDocuments({
      periodId: period,
      status: 'paid',
    }).session(session);
    const results = Object.fromEntries((audit?.results ?? []).map((row) => [row._id, row.count]));
    return {
      period,
      asOf: now,
      page,
      total: audit?.total[0]?.count ?? 0,
      pageSize: 20,
      summary: {
        evaluations: audit?.total[0]?.count ?? 0,
        bankRequired: results['bank-required'] ?? 0,
        belowThreshold: results['below-threshold'] ?? 0,
        remainingCandidates: period === monthlyCutoff(now).period ? (remaining?.count ?? 0) : null,
        pendingWithdrawals,
        paidWithdrawals,
        pendingEmails,
        failedEmails,
        expiredEmailLeases,
      },
      items: (audit?.items ?? []).map((row) => ({
        id: String(row._id),
        accountId: String(row.targetId),
        action: row.action,
        result: row.result,
        occurredAt: row.occurredAt,
      })),
    };
  });
}
