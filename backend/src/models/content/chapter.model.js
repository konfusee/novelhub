import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
import { lockFields } from '../shared/guards.js';
export const CHAPTER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'scheduled',
  'due',
  'published',
  'unpublished',
  'archived',
  'cancelled',
];
export const CANCELLATION_REASONS = ['author-role-removed', 'account-deleted'];
const earlyAccessSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    durationDays: { type: Number, min: 1 },
    coinPrice: { type: Number, min: 0 },
    endsAt: Date,
    policyVersionId: { type: ObjectId, ref: 'PolicyVersion' },
  },
  { _id: false, strict: 'throw' },
);
const transitionSchema = new Schema(
  {
    actorAccountId: { type: ObjectId, ref: 'Account' },
    occurredAt: Date,
    from: String,
    to: String,
    result: String,
    failure: String,
  },
  { _id: false, strict: 'throw' },
);
const schema = new Schema(
  {
    storyId: { type: ObjectId, ref: 'Story', required: true },
    orderKey: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: CHAPTER_STATUSES, default: 'draft', required: true },
    draftRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    currentRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    publishedRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    earlyAccess: { type: earlyAccessSchema, default: undefined },
    requestedReleaseAt: Date,
    publicationTransition: { type: transitionSchema, default: undefined },
    firstReleasedAt: Date,
    publishedAt: Date,
    cancelledAt: Date,
    cancellationReason: { type: String, enum: CANCELLATION_REASONS },
  },
  mutableOptions,
);
lockFields(schema, ['firstReleasedAt'], { mode: 'set-once' });
schema.index({ storyId: 1, orderKey: 1 }, { unique: true });
schema.index({ status: 1, requestedReleaseAt: 1, storyId: 1, orderKey: 1 });
schema.index({ storyId: 1, publishedRevisionId: 1, orderKey: 1 });
export const Chapter = defineModel('Chapter', schema, 'chapters');
