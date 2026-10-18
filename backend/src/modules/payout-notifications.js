import { Notification, NotificationOutbox } from '../models/index.js';

export async function enqueuePayoutNotification(account, event, session, now) {
  const email = account.retainedPayoutEmail ?? account.email;
  // The recipient is transient delivery data. The worker removes it on delivery/final failure.
  if (email)
    await Notification.updateMany(
      {
        recipientAccountId: account._id,
        deliveryState: 'pending',
        eventType: { $in: ['withdrawal.created', 'withdrawal.paid', 'withdrawal.failed'] },
        'payload.emailRecipient': { $exists: false },
      },
      { $set: { 'payload.emailRecipient': email }, $inc: { version: 1 } },
      { session },
    );
  const [notification] = await Notification.create(
    [
      {
        recipientAccountId: account._id,
        eventType: event.type,
        sourceEventKey: event.key,
        payload: {
          title: event.title,
          body: event.body,
          ...(event.withdrawalId ? { withdrawalRequestId: String(event.withdrawalId) } : {}),
          ...(email ? { emailRecipient: email } : {}),
        },
        deliveryState: 'pending',
      },
    ],
    { session },
  );
  await NotificationOutbox.create(
    [
      {
        sourceEventKey: event.key,
        notificationId: notification._id,
        channel: 'email',
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: now,
      },
    ],
    { session },
  );
}
