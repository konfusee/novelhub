import mongoose from 'mongoose';
import { z } from 'zod';
import { Wallet, WithdrawalRequest, PayoutSheetRow, PayoutResultEntry } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';

const oid = z.string().regex(/^[a-f\d]{24}$/i);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const authorPayoutQuery = z
  .object({
    period: period.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();
export const authorPayoutId = oid;
const cursorSchema = z
  .object({ date: z.iso.datetime(), id: oid, period: z.union([period, z.literal('')]) })
  .strict();
function decode(input) {
  if (!input.cursor) return null;
  try {
    if (Buffer.from(input.cursor, 'base64url').toString('base64url') !== input.cursor)
      throw new Error('encoding');
    const cursor = cursorSchema.parse(
      JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
    );
    if (cursor.period !== (input.period ?? '')) throw new Error('period');
    return cursor;
  } catch {
    throw new HttpError(400, 'invalid_cursor', 'Mốc phân trang không hợp lệ với kỳ thanh toán.');
  }
}
async function ownedWallet(accountId) {
  return Wallet.findOne({ ownerType: 'account', ownerId: accountId, purpose: 'author-earnings' })
    .select('_id')
    .lean();
}
async function summaries(requests, now) {
  if (!requests.length) return [];
  const ids = requests.map((item) => item._id);
  const [rows, paid, failed] = await Promise.all([
    PayoutSheetRow.find({ withdrawalRequestId: { $in: ids } })
      .select('withdrawalRequestId periodId amountCoins')
      .lean(),
    PayoutResultEntry.find({
      withdrawalRequestId: { $in: ids },
      result: 'Paid',
      occurredAt: { $lte: now },
    })
      .select('withdrawalRequestId occurredAt')
      .lean(),
    PayoutResultEntry.aggregate([
      {
        $match: { withdrawalRequestId: { $in: ids }, result: 'Failed', occurredAt: { $lte: now } },
      },
      { $group: { _id: '$withdrawalRequestId', lastAt: { $max: '$occurredAt' } } },
    ]),
  ]);
  return requests.map((request) => {
    const row = rows.find((item) => item.withdrawalRequestId.equals(request._id));
    const result = paid.find((item) => item.withdrawalRequestId.equals(request._id));
    const failure = failed.find((item) => item._id.equals(request._id));
    const consistent =
      row &&
      Number.isSafeInteger(request.amountCoins) &&
      request.amountCoins > 0 &&
      row.periodId === request.periodId &&
      row.amountCoins === request.amountCoins &&
      request.payoutSlipAmountVnd === request.amountCoins;
    const state = !consistent
      ? 'unavailable'
      : request.status === 'paid'
        ? consistent && result
          ? 'paid'
          : 'unavailable'
        : result
          ? 'unavailable'
          : failure
            ? 'failed'
            : 'pending';
    return {
      id: String(request._id),
      period: request.periodId,
      amountCoins: request.amountCoins,
      evaluatedAt: request.evaluatedAt,
      cutoffAt: request.cutoffAt,
      finalPayout: request.forcedByDeletion,
      state,
      paidAt: state === 'paid' ? result.occurredAt : null,
      lastFailedAt: failure?.lastAt ?? null,
    };
  });
}
const fields =
  'periodId amountCoins payoutSlipAmountVnd status evaluatedAt cutoffAt forcedByDeletion';
export async function authorPayouts(accountId, input, now = new Date()) {
  const cursor = decode(input);
  const wallet = await ownedWallet(accountId);
  if (!wallet) return { items: [], nextCursor: null };
  const query = { accountId, earningsWalletId: wallet._id, evaluatedAt: { $lte: now } };
  if (input.period) query.periodId = input.period;
  if (cursor)
    query.$or = [
      { evaluatedAt: { $lt: new Date(cursor.date) } },
      { evaluatedAt: new Date(cursor.date), _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
    ];
  const requests = await WithdrawalRequest.find(query)
    .sort({ evaluatedAt: -1, _id: -1 })
    .limit(input.limit + 1)
    .select(fields)
    .lean();
  const page = requests.slice(0, input.limit);
  const last = page.at(-1);
  return {
    items: await summaries(page, now),
    nextCursor:
      requests.length > input.limit
        ? Buffer.from(
            JSON.stringify({
              date: last.evaluatedAt.toISOString(),
              id: String(last._id),
              period: input.period ?? '',
            }),
          ).toString('base64url')
        : null,
  };
}
export async function authorPayoutDetail(accountId, id, now = new Date()) {
  const wallet = await ownedWallet(accountId);
  const request =
    wallet &&
    (await WithdrawalRequest.findOne({
      _id: id,
      accountId,
      earningsWalletId: wallet._id,
      evaluatedAt: { $lte: now },
    })
      .select(fields)
      .lean());
  if (!request) throw new HttpError(404, 'not_found', 'Không tìm thấy khoản thanh toán.');
  const [item] = await summaries([request], now);
  return {
    item,
    slip:
      item.state === 'paid'
        ? {
            id: item.id,
            period: item.period,
            amountVnd: request.payoutSlipAmountVnd,
            paidAt: item.paidAt,
          }
        : null,
  };
}
