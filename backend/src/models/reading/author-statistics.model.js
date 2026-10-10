import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

const schema = new Schema(
  {
    authorAccountId: { type: ObjectId, ref: 'Account', required: true },
    storyViews: Schema.Types.Mixed,
    chapterViews: Schema.Types.Mixed,
    followers: Number,
    averageRating: Number,
    unlocks: Number,
    earningsByChapterMonth: Schema.Types.Mixed,
    commentCounts: Schema.Types.Mixed,
    projectionVersion: Number,
    sourceCursor: String,
    status: String,
  },
  mutableOptions,
);
schema.index({ authorAccountId: 1 }, { unique: true });
export const AuthorStatistics = defineModel('AuthorStatistics', schema, 'authorStatistics');
