import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

const schema = new Schema(
  {
    recipientAccountId: { type: ObjectId, ref: 'Account', required: true },
    eventType: { type: String, required: true },
    sourceEventKey: { type: String, required: true },
    payload: Schema.Types.Mixed,
    readAt: Date,
    deliveryState: String,
  },
  mutableOptions,
);
schema.index({ recipientAccountId: 1, createdAt: -1 });
schema.index({ recipientAccountId: 1, sourceEventKey: 1 }, { unique: true });
export const Notification = defineModel('Notification', schema, 'notifications');
