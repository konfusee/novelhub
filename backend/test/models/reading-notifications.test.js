import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../db.js'
import { DeliveryAttempt } from '../../src/models/notifications/delivery-attempt.model.js'
import { NotificationOutbox } from '../../src/models/notifications/notification-outbox.model.js'
import { StatisticsEvent } from '../../src/models/reading/statistics-event.model.js'

useTestDatabase()
const id = () => new mongoose.Types.ObjectId()

describe('reading and notification models', () => {
  it('deduplicates view events but permits other events', async () => {
    const key = {
      sourceEventKey: 'view-1',
      occurredAt: new Date(),
      chapterId: id(),
      day: '2026-01-01',
      viewerType: 'account',
      viewerKey: 'a',
    }
    await StatisticsEvent.create({ ...key, eventType: 'view' })
    await expect(StatisticsEvent.create({ ...key, eventType: 'view' })).rejects.toMatchObject({
      code: 11000,
    })
    await expect(
      StatisticsEvent.create({ ...key, sourceEventKey: 'follow-1', eventType: 'follow' }),
    ).resolves.toBeDefined()
  })

  it('enforces outbox source idempotency per channel', async () => {
    await NotificationOutbox.create({ sourceEventKey: 'source-1', channel: 'email' })
    await NotificationOutbox.create({ sourceEventKey: 'source-1', channel: 'in-app' })
    await expect(
      NotificationOutbox.create({ sourceEventKey: 'source-1', channel: 'email' }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it('limits email delivery to three attempts and resolves each attempt forward only', async () => {
    const outboxId = id()
    const attempt = attemptNumber => ({
      outboxId,
      attemptKey: `attempt-${attemptNumber}`,
      channel: 'email',
      attemptNumber,
      attemptedAt: new Date(),
    })
    await expect(DeliveryAttempt.create(attempt(4))).rejects.toThrow(/attemptNumber/)

    const first = await DeliveryAttempt.create(attempt(1))
    expect(first.status).toBe('pending')
    const resolved = await DeliveryAttempt.updateOne(
      { _id: first._id, status: 'pending' },
      { $set: { status: 'failed', resolvedAt: new Date() } },
    )
    expect(resolved.modifiedCount).toBe(1)
    await expect(
      DeliveryAttempt.updateOne(
        { _id: first._id, status: 'failed' },
        { $set: { status: 'accepted' } },
      ),
    ).rejects.toThrow(/compare-and-set/)
    await expect(
      DeliveryAttempt.create({ ...attempt(1), attemptKey: 'retry-same-number' }),
    ).rejects.toMatchObject({ code: 11000 })
  })
})
