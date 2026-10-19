import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
export const RATING_STATUSES = ['active', 'removed']
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story', required: true },
    value: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    status: { type: String, enum: RATING_STATUSES, default: 'active', required: true },
    removedAt: Date,
  },
  mutableOptions,
)
schema.index({ accountId: 1, storyId: 1 }, { unique: true })
schema.index({ storyId: 1, status: 1 })
export const Rating = defineModel('Rating', schema, 'ratings')
