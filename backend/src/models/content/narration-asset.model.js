import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const NARRATION_STATUSES = ['requested', 'processing', 'available', 'failed'];
const schema = new Schema(
  {
    chapterId: { type: ObjectId, ref: 'Chapter', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    voiceId: { type: String, required: true },
    language: { type: String, default: 'vi', required: true },
    provider: String,
    status: { type: String, enum: NARRATION_STATUSES, default: 'requested', required: true },
    audioReference: { type: String, select: false },
    failureCode: String,
    retryable: Boolean,
    attempts: { type: Number, min: 0, default: 0 },
    requestedAt: Date,
    completedAt: Date,
  },
  mutableOptions,
);
schema.index({ revisionId: 1, voiceId: 1 }, { unique: true });
schema.index({ chapterId: 1, status: 1 });
export const NarrationAsset = defineModel('NarrationAsset', schema, 'narrationAssets');
