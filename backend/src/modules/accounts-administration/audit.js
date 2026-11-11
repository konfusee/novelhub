import { AuditEvent } from '../../models/index.js'

export async function recordAudit(event, { session } = {}) {
  const [record] = await AuditEvent.create([{ occurredAt: new Date(), ...event }], { session })
  return record
}
