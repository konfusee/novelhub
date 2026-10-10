import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const SUBMISSION_STATUSES = [
  'validated',
  'pending-review',
  'decision-pending',
  'approved',
  'rejected',
  'revision-requested',
  'cancelled',
];
export const SUBMISSION_CANCELLATION_REASONS = ['author-role-removed', 'account-deleted'];
const schema = new Schema(
  {
    storyId: { type: ObjectId, ref: 'Story', required: true },
    chapterId: { type: ObjectId, ref: 'Chapter' },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    authorAccountId: { type: ObjectId, ref: 'Account', required: true },
    status: { type: String, enum: SUBMISSION_STATUSES, default: 'validated', required: true },
    submittedAt: { type: Date, required: true, default: Date.now },
    currentEvidenceBatchId: { type: ObjectId, ref: 'EvidenceBatch' },
    packageDigest: String,
    decisionSummary: String,
    claimOwnerAccountId: { type: ObjectId, ref: 'Account' },
    claimExpiresAt: Date,
    claimVersion: { type: Number, min: 0, default: 0 },
    claimReleaseHistory: [{ type: Schema.Types.Mixed }],
    cancelledAt: Date,
    cancellationReason: { type: String, enum: SUBMISSION_CANCELLATION_REASONS },
  },
  mutableOptions,
);
schema.index({ revisionId: 1 }, { unique: true });
schema.index({ status: 1, claimExpiresAt: 1, submittedAt: 1 });
export const PublicationSubmission = defineModel(
  'PublicationSubmission',
  schema,
  'publicationSubmissions',
);
