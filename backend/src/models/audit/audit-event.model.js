import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js';

const schema = new Schema(
  {
    actorType: { type: String, enum: ['account', 'system'], required: true },
    actorId: ObjectId,
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: ObjectId, required: true },
    targetVersion: Number,
    result: { type: String, required: true },
    reason: String,
    correlationId: String,
    operationType: String,
    idempotencyScope: {
      operation: String,
      ownerId: ObjectId,
      key: String,
    },
    occurredAt: { type: Date, required: true },
    dataDigest: String,
    retentionClass: String,
  },
  appendOnlyOptions,
);
schema.plugin(appendOnly);
schema.index({ targetType: 1, targetId: 1, occurredAt: -1 });
export const AuditEvent = defineModel('AuditEvent', schema, 'auditEvents');
