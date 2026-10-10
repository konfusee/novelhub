import { mutableOptions, defineModel, ObjectId, Schema } from '../shared/schema.js';
import { lockFields, forwardOnly } from '../shared/guards.js';
export const PROCESSING_STAGES = ['embedding', 'comparison', 'llm'];
export const PROCESSING_STATUSES = ['claimed', 'started', 'succeeded', 'failed', 'stale'];
const schema = new Schema(
  {
    batchId: { type: ObjectId, ref: 'EvidenceBatch', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    stage: { type: String, enum: PROCESSING_STAGES, required: true },
    attemptKey: { type: String, required: true },
    leaseId: String,
    claimVersion: Number,
    leaseExpiresAt: Date,
    provider: String,
    status: { type: String, enum: PROCESSING_STATUSES, required: true },
    requestFingerprint: String,
    responseMetadata: { type: Schema.Types.Mixed },
    failureCode: String,
    startedAt: Date,
    finishedAt: Date,
    retryOf: { type: ObjectId, ref: 'ProcessingAttempt' },
    staleAt: Date,
  },
  mutableOptions,
);
lockFields(schema, ['batchId', 'revisionId', 'stage', 'attemptKey', 'leaseId', 'claimVersion'], {
  mode: 'insert-only',
});
forwardOnly(schema, 'status', {
  claimed: ['started', 'stale'],
  started: ['succeeded', 'failed', 'stale'],
  succeeded: [],
  failed: [],
  stale: [],
});
schema.index({ attemptKey: 1 }, { unique: true });
schema.index({ batchId: 1, stage: 1, createdAt: -1 });
export const ProcessingAttempt = defineModel('ProcessingAttempt', schema, 'processingAttempts');
