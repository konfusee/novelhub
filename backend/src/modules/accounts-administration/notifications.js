import { Notification, NotificationOutbox } from '../../models/index.js'
import { withTransaction } from '../../db/connection.js'

export const EMAIL_EVENTS = new Set([
  'google.linked',
  'publication.decided',
  'author-application.decided',
  'monthly-payout.created',
  'monthly-payout.bank-details-missing',
  'monthly-payout.Paid',
  'monthly-payout.Failed',
])

export async function notifyMany(events, options = {}) {
  const results = []
  for (const event of events) results.push(await notify(event, options))
  return results
}

/** Idempotent by recipient + sourceEventKey. Pass the business transaction's session. */
export async function notify(event, { session } = {}) {
  if (!session) return withTransaction(tx => notify(event, { session: tx }))
  if (!session.inTransaction()) throw new Error('Notifications require a transaction')
  const { recipientAccountId, sourceEventKey, eventType, payload = {} } = event
  const notification = await Notification.findOneAndUpdate(
    { recipientAccountId, sourceEventKey },
    {
      $setOnInsert: {
        recipientAccountId,
        sourceEventKey,
        eventType,
        payload,
        deliveryState: 'available',
      },
    },
    { upsert: true, returnDocument: 'after', session },
  )
  if (EMAIL_EVENTS.has(eventType)) {
    // Include recipient identity: one business event can have multiple recipients.
    const key = `${recipientAccountId}:${sourceEventKey}`
    await NotificationOutbox.updateOne(
      { sourceEventKey: key, channel: 'email' },
      {
        $setOnInsert: {
          sourceEventKey: key,
          notificationId: notification._id,
          channel: 'email',
          status: 'pending',
          attemptCount: 0,
          nextAttemptAt: new Date(),
        },
      },
      { upsert: true, session },
    )
  }
  return notification
}
