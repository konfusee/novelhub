import { forwardOnly, lockFields } from '../shared/guards.js';
import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

// Design lifecycle: pending → accepted | failed. The row is written as `pending`
// before the provider call and resolved once it returns.
export const DELIVERY_ATTEMPT_STATUSES = ['pending', 'accepted', 'failed'];

const schema = new Schema(
  {
    notificationId: { type: ObjectId, ref: 'Notification' },
    outboxId: { type: ObjectId, ref: 'NotificationOutbox', required: true },
    attemptKey: { type: String, required: true },
    channel: { type: String, enum: ['email', 'in-app'], required: true },
    provider: String,
    status: { type: String, enum: DELIVERY_ATTEMPT_STATUSES, default: 'pending', required: true },
    messageReference: { type: String, select: false },
    failureCode: String,
    attemptedAt: { type: Date, required: true },
    resolvedAt: Date,
    nextAttemptAt: Date,
    // Email is retried up to three attempts with backoff, then failed.
    attemptNumber: { type: Number, min: 1, max: 3, required: true, validate: Number.isInteger },
  },
  mutableOptions,
);
lockFields(
  schema,
  ['notificationId', 'outboxId', 'attemptKey', 'channel', 'attemptNumber', 'attemptedAt'],
  {
    mode: 'insert-only',
  },
);
forwardOnly(schema, 'status', { pending: ['accepted', 'failed'] });
schema.index({ attemptKey: 1 }, { unique: true });
schema.index({ outboxId: 1, attemptNumber: 1 }, { unique: true });
export const DeliveryAttempt = defineModel('DeliveryAttempt', schema, 'deliveryAttempts');
