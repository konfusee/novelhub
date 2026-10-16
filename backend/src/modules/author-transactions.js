import mongoose from 'mongoose';
import { z } from 'zod';
import { LedgerEntry, Wallet } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';
import { authorEarningsPeriod } from './author-earnings-period.js';

export const authorTransactionQuery = z
  .object({
    period: z.enum(['day', 'week', 'month']).default('month'),
    direction: z.enum(['all', 'credit', 'debit']).default('all'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();
const cursorSchema = z
  .object({
    date: z.iso.datetime(),
    id: z.string().regex(/^[a-f\d]{24}$/i),
    period: z.enum(['day', 'week', 'month']),
    direction: z.enum(['all', 'credit', 'debit']),
  })
  .strict();
function readCursor(input) {
  if (!input.cursor) return null;
  try {
    if (Buffer.from(input.cursor, 'base64url').toString('base64url') !== input.cursor)
      throw new Error('encoding');
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
    );
    if (parsed.period !== input.period || parsed.direction !== input.direction)
      throw new Error('filters');
    return parsed;
  } catch {
    throw new HttpError(400, 'invalid_cursor', 'Mốc phân trang không hợp lệ với bộ lọc hiện tại.');
  }
}

export async function authorTransactions(accountId, input, now = new Date()) {
  const cursor = readCursor(input);
  const wallet = await Wallet.findOne({
    ownerType: 'account',
    ownerId: accountId,
    purpose: 'author-earnings',
  })
    .select('_id')
    .lean();
  if (!wallet) return { items: [], nextCursor: null };
  const { start } = authorEarningsPeriod(input.period, now);
  const match = { walletId: wallet._id, occurredAt: { $gte: start, $lte: now } };
  if (input.direction !== 'all') match.direction = input.direction;
  if (cursor)
    match.$or = [
      { occurredAt: { $lt: new Date(cursor.date) } },
      { occurredAt: new Date(cursor.date), _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
    ];
  const entries = await LedgerEntry.find(match)
    .sort({ occurredAt: -1, _id: -1 })
    .limit(input.limit + 1)
    .select('ledgerType direction amount unit occurredAt')
    .lean();
  const page = entries.slice(0, input.limit);
  const last = page.at(-1);
  return {
    items: page.map((entry) => ({
      id: String(entry._id),
      type: entry.ledgerType,
      direction: entry.direction,
      amount: entry.amount,
      unit: entry.unit,
      occurredAt: entry.occurredAt,
    })),
    nextCursor:
      entries.length > input.limit
        ? Buffer.from(
            JSON.stringify({
              date: last.occurredAt.toISOString(),
              id: String(last._id),
              period: input.period,
              direction: input.direction,
            }),
          ).toString('base64url')
        : null,
  };
}
