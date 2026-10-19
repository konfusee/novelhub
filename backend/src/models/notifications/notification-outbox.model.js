import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

export const NOTIFICATION_OUTBOX_STATUSES = ['pending', 'claimed', 'delivered', 'failed'];
const schema = new Schema(
  {
    sourceEventKey: { type: String, required: true },
    notificationId: { type: ObjectId, ref: 'Notification' },
    channel: { type: String, enum: ['email', 'in-app'], required: true },
    status: {
      type: String,
      enum: NOTIFICATION_OUTBOX_STATUSES,
      default: 'pending',
      required: true,
    },
    claimId: String,
    leaseExpiresAt: Date,
    attemptCount: { type: Number, min: 0, validate: Number.isInteger },
    nextAttemptAt: Date,
    lastFailureCode: String,
  },
  mutableOptions,
);
schema.index({ sourceEventKey: 1, channel: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1 });
export const NotificationOutbox = defineModel('NotificationOutbox', schema, 'notificationOutbox');
