import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story', required: true },
    chapterId: { type: ObjectId, ref: 'Chapter', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision' },
    mode: { type: String, required: true },
    position: Number,
    duration: Number,
    contentUpdatedNotice: Boolean,
    lastReadAt: Date,
    completedAt: Date,
  },
  mutableOptions,
);
schema.index({ accountId: 1, storyId: 1, chapterId: 1, mode: 1 }, { unique: true });
schema.index({ accountId: 1, chapterId: 1, mode: 1 });
export const ReadingProgress = defineModel('ReadingProgress', schema, 'readingProgress');
