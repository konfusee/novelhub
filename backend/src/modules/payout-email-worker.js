import { randomUUID } from 'node:crypto';
import { Account, DeliveryAttempt, Notification, NotificationOutbox } from '../models/index.js';
import { withTransaction } from '../db/connection.js';

const source = /^withdrawal-(created|result):/;
async function claim(now) {
  return withTransaction(async (session) => {
    const outbox = await NotificationOutbox.findOne({
      channel: 'email',
      sourceEventKey: source,
      $or: [
        { status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'claimed', leaseExpiresAt: { $lte: now } },
      ],
    })
      .sort({ nextAttemptAt: 1, _id: 1 })
      .session(session);
    if (!outbox) return null;
    if (outbox.status === 'claimed')
      await DeliveryAttempt.updateMany(
        { outboxId: outbox._id, status: 'pending' },
        {
          $set: { status: 'failed', failureCode: 'lease-expired', resolvedAt: now },
          $inc: { version: 1 },
        },
        { session },
      );
    if ((outbox.attemptCount ?? 0) >= 3) {
      outbox.status = 'failed';
      outbox.lastFailureCode = 'attempts-exhausted';
      outbox.claimId = undefined;
      outbox.leaseExpiresAt = undefined;
      await outbox.save({ session });
      await Notification.updateOne(
        { _id: outbox.notificationId },
        {
          $set: { deliveryState: 'failed' },
          $unset: { 'payload.emailRecipient': 1 },
          $inc: { version: 1 },
        },
        { session },
      );
      return { terminal: true };
    }
    outbox.status = 'claimed';
    outbox.claimId = randomUUID();
    outbox.leaseExpiresAt = new Date(now.getTime() + 180000);
    outbox.attemptCount = (outbox.attemptCount ?? 0) + 1;
    await outbox.save({ session });
    const notification = await Notification.findById(outbox.notificationId).session(session).lean();
    const owner =
      !notification?.payload?.emailRecipient && notification
        ? await Account.findById(notification.recipientAccountId)
            .select('email +retainedPayoutEmail')
            .session(session)
        : null;
    const recipient =
      notification?.payload?.emailRecipient ?? owner?.retainedPayoutEmail ?? owner?.email;
    const attemptKey = `${outbox._id}:${outbox.attemptCount}`;
    await DeliveryAttempt.create(
      [
        {
          outboxId: outbox._id,
          notificationId: outbox.notificationId,
          attemptKey,
          channel: 'email',
          provider: 'smtp',
          status: 'pending',
          attemptedAt: now,
          attemptNumber: outbox.attemptCount,
        },
      ],
      { session },
    );
    return {
      id: outbox._id,
      notificationId: outbox.notificationId,
      claimId: outbox.claimId,
      attemptNumber: outbox.attemptCount,
      attemptKey,
      notification,
      recipient,
    };
  });
}
async function complete(job, accepted, now) {
  return withTransaction(async (session) => {
    const terminal = accepted || job.attemptNumber >= 3;
    const nextAttemptAt = new Date(now.getTime() + 60000 * 2 ** (job.attemptNumber - 1));
    const outbox = await NotificationOutbox.findOneAndUpdate(
      { _id: job.id, status: 'claimed', claimId: job.claimId, leaseExpiresAt: { $gt: now } },
      {
        $set: {
          status: accepted ? 'delivered' : terminal ? 'failed' : 'pending',
          ...(accepted ? {} : { lastFailureCode: 'delivery-unavailable' }),
          ...(!terminal ? { nextAttemptAt } : {}),
        },
        $unset: { claimId: 1, leaseExpiresAt: 1 },
        $inc: { version: 1 },
      },
      { session },
    );
    if (!outbox) return false;
    await DeliveryAttempt.updateOne(
      { outboxId: job.id, attemptKey: job.attemptKey, status: 'pending' },
      {
        $set: {
          status: accepted ? 'accepted' : 'failed',
          resolvedAt: now,
          ...(!accepted
            ? { failureCode: 'delivery-unavailable', ...(!terminal ? { nextAttemptAt } : {}) }
            : {}),
        },
        $inc: { version: 1 },
      },
      { session },
    );
    await Notification.updateOne(
      { _id: job.notificationId },
      {
        $set: { deliveryState: accepted ? 'delivered' : terminal ? 'failed' : 'pending' },
        ...(terminal ? { $unset: { 'payload.emailRecipient': 1 } } : {}),
        $inc: { version: 1 },
      },
      { session },
    );
    return true;
  });
}

export async function deliverPayoutEmails(
  delivery,
  { limit = 10, clock = () => new Date(), shouldStop = () => false } = {},
) {
  const results = { delivered: 0, failed: 0, stale: 0 };
  if (!delivery) return results;
  for (let index = 0; index < limit && !shouldStop(); index++) {
    const job = await claim(clock());
    if (!job) break;
    if (job.terminal) {
      results.failed++;
      continue;
    }
    let accepted = false;
    try {
      if (
        typeof job.recipient !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.recipient) ||
        typeof job.notification?.payload?.title !== 'string' ||
        typeof job.notification.payload.body !== 'string'
      )
        throw new Error('recipient-or-message-unavailable');
      const result = await delivery.send({
        to: job.recipient,
        subject: job.notification.payload.title,
        text: job.notification.payload.body,
      });
      accepted = result?.accepted === true;
    } catch {
      /* Provider errors never undo the committed financial result. */
    }
    if (!(await complete(job, accepted, clock()))) results.stale++;
    else if (accepted) results.delivered++;
    else results.failed++;
  }
  return results;
}
export function startPayoutEmailWorker(delivery, logger, { intervalMs = 15000 } = {}) {
  if (!delivery) return async () => {};
  let stopped = false,
    running;
  const tick = () => {
    if (stopped || running) return;
    running = deliverPayoutEmails(delivery, { shouldStop: () => stopped })
      .catch((error) => logger?.error({ err: error }, 'Payout email worker failed'))
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
