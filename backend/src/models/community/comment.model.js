import { lockFields } from '../shared/guards.js';
import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const COMMENT_TARGET_TYPES = ['story', 'chapter'];
export const COMMENT_STATUSES = ['visible', 'hidden', 'soft-deleted'];
const schema = new Schema(
  {
    authorAccountId: { type: ObjectId, ref: 'Account', required: true },
    targetType: { type: String, enum: COMMENT_TARGET_TYPES, required: true },
    targetId: { type: ObjectId, required: true },
    parentCommentId: { type: ObjectId, ref: 'Comment' },
    body: { type: String, required: true, trim: true },
    status: { type: String, enum: COMMENT_STATUSES, default: 'visible', required: true },
    likeCount: { type: Number, min: 0, default: 0 },
    editedAt: Date,
  },
  mutableOptions,
);
// Comments are never re-parented or moved, which also keeps threads one level deep.
lockFields(schema, ['authorAccountId', 'targetType', 'targetId', 'parentCommentId'], {
  mode: 'insert-only',
});
schema.pre('validate', async function oneLevelReply() {
  if (
    this.parentCommentId &&
    (this.isNew ||
      this.isModified('parentCommentId') ||
      this.isModified('targetType') ||
      this.isModified('targetId'))
  ) {
    const parent = await this.constructor
      .findById(this.parentCommentId)
      .select('parentCommentId targetType targetId')
      .session(this.$session());
    if (!parent) this.invalidate('parentCommentId', 'parent comment does not exist');
    else if (parent.parentCommentId)
      this.invalidate('parentCommentId', 'replies may only be one level');
    else if (parent.targetType !== this.targetType || !parent.targetId.equals(this.targetId))
      this.invalidate('parentCommentId', 'parent comment must have the same target');
  }
});
schema.index({ targetType: 1, targetId: 1, status: 1, createdAt: 1 });
schema.index({ parentCommentId: 1, createdAt: 1 });
export const Comment = defineModel('Comment', schema, 'comments');
