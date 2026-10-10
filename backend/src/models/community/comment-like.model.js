import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const LIKE_STATUSES = ['active', 'removed'];
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    commentId: { type: ObjectId, ref: 'Comment', required: true },
    status: { type: String, enum: LIKE_STATUSES, default: 'active', required: true },
    removedAt: Date,
  },
  mutableOptions,
);
schema.index({ accountId: 1, commentId: 1 }, { unique: true });
schema.index({ commentId: 1, status: 1 });
export const CommentLike = defineModel('CommentLike', schema, 'commentLikes');
