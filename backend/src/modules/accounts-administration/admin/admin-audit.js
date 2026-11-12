import { z } from 'zod'
import { Account, AuditEvent } from '../../../models/index.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
export const auditQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    action: z.string().trim().min(1).max(120).optional(),
    targetType: z.string().trim().min(1).max(100).optional(),
    targetId: id.optional(),
    actorId: id.optional(),
    result: z.string().trim().min(1).max(100).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(q => !q.from || !q.to || new Date(q.from) <= new Date(q.to))

export async function adminAudit(query) {
  const { page, pageSize, from, to, ...fields } = query
  const match = {
    ...fields,
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { $gte: new Date(from) } : {}),
            ...(to ? { $lte: new Date(to) } : {}),
          },
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    AuditEvent.find(match)
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .maxTimeMS(5000)
      .select(
        'actorType actorId action targetType targetId targetVersion result reason operationType occurredAt',
      )
      .lean(),
    AuditEvent.countDocuments(match).maxTimeMS(5000),
  ])
  const actorIds = items
    .filter(event => event.actorType === 'account' && event.actorId)
    .map(event => event.actorId)
  const accounts = await Account.find({ _id: { $in: actorIds } })
    .select('displayName')
    .lean()
  const actorNames = new Map(accounts.map(account => [String(account._id), account.displayName]))
  return {
    items: items.map(({ _id, ...event }) => ({
      ...event,
      id: String(_id),
      actorId: event.actorId ? String(event.actorId) : null,
      actorName: actorNames.get(String(event.actorId)) ?? null,
      targetId: String(event.targetId),
    })),
    total,
    page,
    pageSize,
  }
}
