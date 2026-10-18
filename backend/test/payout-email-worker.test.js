import { expect, it, vi } from 'vitest';
import { Account, DeliveryAttempt, Notification, NotificationOutbox } from '../src/models/index.js';
import { enqueuePayoutNotification } from '../src/modules/payout-notifications.js';
import { deliverPayoutEmails } from '../src/modules/payout-email-worker.js';
import { withTransaction } from '../src/db/connection.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
async function fixture() {
  const account = await Account.create({
    status: 'anonymized',
    everAuthor: true,
    displayName: 'Deleted user',
    retainedPayoutEmail: 'temporary@example.test',
  });
  await withTransaction((session) =>
    enqueuePayoutNotification(
      account,
      {
        key: `withdrawal-result:${account._id}:test`,
        type: 'withdrawal.paid',
        title: 'Khoản chi trả',
        body: 'Đã ghi nhận 137 xu.',
        withdrawalId: account._id,
      },
      session,
      new Date(),
    ),
  );
  // Simulate financial closure removing the account's retained email before SMTP runs.
  await Account.updateOne(
    { _id: account._id },
    { $unset: { retainedPayoutEmail: 1 }, $set: { financiallyClosedAt: new Date() } },
  );
  return {
    account,
    outbox: await NotificationOutbox.findOne({}),
    notification: await Notification.findOne({}),
  };
}
it('delivers a pending financial email once and removes transient recipient data', async () => {
  const f = await fixture();
  const send = vi.fn().mockResolvedValue({ accepted: true });
  expect(await deliverPayoutEmails({ send })).toEqual({ delivered: 1, failed: 0, stale: 0 });
  expect(send).toHaveBeenCalledWith({
    to: 'temporary@example.test',
    subject: 'Khoản chi trả',
    text: 'Đã ghi nhận 137 xu.',
  });
  expect((await Notification.findById(f.notification._id)).payload.emailRecipient).toBeUndefined();
  expect((await NotificationOutbox.findById(f.outbox._id)).status).toBe('delivered');
  expect((await DeliveryAttempt.findOne({ outboxId: f.outbox._id })).status).toBe('accepted');
  await deliverPayoutEmails({ send });
  expect(send).toHaveBeenCalledOnce();
});
it('retries with backoff at most three times, then removes the email address from retained notification history', async () => {
  const f = await fixture();
  const send = vi.fn().mockRejectedValue(new Error('provider down'));
  let now = new Date();
  const clock = () => now;
  await deliverPayoutEmails({ send }, { clock });
  await deliverPayoutEmails({ send }, { clock });
  expect(send).toHaveBeenCalledOnce();
  expect((await Notification.findById(f.notification._id)).payload.emailRecipient).toBe(
    'temporary@example.test',
  );
  now = new Date(now.getTime() + 61000);
  await deliverPayoutEmails({ send }, { clock });
  now = new Date(now.getTime() + 121000);
  await deliverPayoutEmails({ send }, { clock });
  expect(send).toHaveBeenCalledTimes(3);
  expect(await DeliveryAttempt.countDocuments({ outboxId: f.outbox._id })).toBe(3);
  expect((await NotificationOutbox.findById(f.outbox._id)).status).toBe('failed');
  expect((await Notification.findById(f.notification._id)).payload.emailRecipient).toBeUndefined();
  await deliverPayoutEmails({ send }, { clock });
  expect(send).toHaveBeenCalledTimes(3);
});
it('serializes competing workers so only one provider call owns a live claim', async () => {
  await fixture();
  const send = vi.fn().mockResolvedValue({ accepted: true });
  await Promise.all([deliverPayoutEmails({ send }), deliverPayoutEmails({ send })]);
  expect(send).toHaveBeenCalledOnce();
  expect(await DeliveryAttempt.countDocuments({ status: 'accepted' })).toBe(1);
});
it('fences a late provider completion after another worker recovers the expired lease', async () => {
  const f = await fixture();
  let resolveFirst;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const first = deliverPayoutEmails(
    {
      send: () => {
        started();
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      },
    },
    { limit: 1 },
  );
  await ready;
  await NotificationOutbox.updateOne(
    { _id: f.outbox._id },
    { $set: { leaseExpiresAt: new Date(Date.now() - 1000) } },
  );
  expect(
    (
      await deliverPayoutEmails(
        { send: vi.fn().mockResolvedValue({ accepted: true }) },
        { limit: 1 },
      )
    ).delivered,
  ).toBe(1);
  resolveFirst({ accepted: true });
  expect((await first).stale).toBe(1);
  expect((await NotificationOutbox.findById(f.outbox._id)).status).toBe('delivered');
  expect(await DeliveryAttempt.countDocuments({ outboxId: f.outbox._id, status: 'accepted' })).toBe(
    1,
  );
});
it('dead-letters an exhausted crashed claim without sending a fourth email', async () => {
  const f = await fixture();
  await NotificationOutbox.updateOne(
    { _id: f.outbox._id },
    {
      $set: {
        status: 'claimed',
        attemptCount: 3,
        claimId: 'expired',
        leaseExpiresAt: new Date(Date.now() - 1000),
      },
    },
  );
  await DeliveryAttempt.create({
    outboxId: f.outbox._id,
    notificationId: f.notification._id,
    attemptKey: `${f.outbox._id}:3`,
    channel: 'email',
    attemptNumber: 3,
    attemptedAt: new Date(),
    status: 'pending',
  });
  const send = vi.fn();
  await deliverPayoutEmails({ send });
  expect(send).not.toHaveBeenCalled();
  expect((await NotificationOutbox.findById(f.outbox._id)).status).toBe('failed');
  expect((await Notification.findById(f.notification._id)).payload.emailRecipient).toBeUndefined();
});
it('can deliver a legacy notification from its retained contact without copying that address into history', async () => {
  const f = await fixture();
  await Notification.updateOne(
    { _id: f.notification._id },
    { $unset: { 'payload.emailRecipient': 1 } },
  );
  await Account.updateOne(
    { _id: f.account._id },
    { $set: { retainedPayoutEmail: 'legacy@example.test' } },
  );
  const send = vi.fn().mockResolvedValue({ accepted: true });
  expect((await deliverPayoutEmails({ send })).delivered).toBe(1);
  expect(send.mock.calls[0][0].to).toBe('legacy@example.test');
  expect((await Notification.findById(f.notification._id)).payload.emailRecipient).toBeUndefined();
});
it('leaves work pending when SMTP is not configured', async () => {
  const f = await fixture();
  await deliverPayoutEmails(undefined);
  expect((await NotificationOutbox.findById(f.outbox._id)).status).toBe('pending');
  expect(await DeliveryAttempt.countDocuments({})).toBe(0);
});
