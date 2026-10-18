import {
  Account,
  AuthorApplication,
  LedgerEntry,
  RoleAssignment,
  UnlockRequest,
  Wallet,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { financePeriod } from './admin-finance-report.js';
import { HttpError } from '../middleware/errors.js';

export async function adminAuthorStatistics(period, now = new Date()) {
  const range = { ...(financePeriod(period) ?? {}), $lte: now };
  return withTransaction(async (session) => {
    const applications = await AuthorApplication.countDocuments({ submittedAt: range }).session(
      session,
    );
    const approvedApplications = await AuthorApplication.countDocuments({
      status: 'approved',
      decidedAt: range,
    }).session(session);
    const rejectedApplications = await AuthorApplication.countDocuments({
      status: 'rejected',
      decidedAt: range,
    }).session(session);
    const pendingApplications = await AuthorApplication.countDocuments({
      status: 'submitted',
    }).session(session);
    const [authors] = await RoleAssignment.aggregate([
      { $match: { role: 'author', status: 'active' } },
      { $group: { _id: '$accountId' } },
      {
        $lookup: {
          from: Account.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $match: { 'account.status': 'active' } },
      { $count: 'count' },
    ]).session(session);
    const [unlocks] = await LedgerEntry.aggregate([
      {
        $match: {
          ledgerType: 'unlock-debit',
          direction: 'debit',
          sourceType: 'UnlockRequest',
          occurredAt: range,
        },
      },
      {
        $lookup: {
          from: UnlockRequest.collection.name,
          localField: 'sourceId',
          foreignField: '_id',
          as: 'unlock',
        },
      },
      { $unwind: '$unlock' },
      { $match: { 'unlock.status': 'committed', amount: { $gt: 0 } } },
      {
        $lookup: {
          from: Wallet.collection.name,
          localField: 'walletId',
          foreignField: '_id',
          as: 'wallet',
        },
      },
      { $unwind: '$wallet' },
      {
        $match: {
          'wallet.ownerType': 'account',
          'wallet.purpose': 'reader-coins',
          $expr: {
            $and: [
              { $eq: ['$wallet.ownerId', '$unlock.accountId'] },
              { $eq: ['$amount', '$unlock.effectivePriceCoins'] },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$sourceId',
          amount: { $first: '$amount' },
          buyer: { $first: '$unlock.accountId' },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          coins: { $sum: '$amount' },
          buyers: { $addToSet: '$buyer' },
        },
      },
    ]).session(session);
    const summary = {
      applications,
      approvedApplications,
      rejectedApplications,
      pendingApplications,
      activeAuthors: authors?.count ?? 0,
      unlocks: unlocks?.count ?? 0,
      unlockCoins: unlocks?.coins ?? 0,
      buyers: unlocks?.buyers.length ?? 0,
    };
    if (Object.values(summary).some((value) => !Number.isSafeInteger(value) || value < 0))
      throw new HttpError(409, 'invalid_statistics', 'Số liệu thống kê không hợp lệ.');
    return { summary, period, asOf: now };
  });
}
