import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
export const FOLLOW_STATUSES = ['active', 'removed']
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story', required: true },
    status: { type: String, enum: FOLLOW_STATUSES, default: 'active', required: true },
    removedAt: Date,
  },
  mutableOptions,
)
schema.index({ accountId: 1, storyId: 1 }, { unique: true })
schema.index({ storyId: 1, status: 1 })
export const Follow = defineModel('Follow', schema, 'follows')
