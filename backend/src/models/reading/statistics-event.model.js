import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js'

export const STATISTICS_EVENT_TYPES = ['view', 'follow', 'rating', 'unlock', 'earning', 'comment']
export const VIEWER_TYPES = ['account', 'guest-device']
const schema = new Schema(
  {
    sourceEventKey: { type: String, required: true },
    eventType: { type: String, enum: STATISTICS_EVENT_TYPES, required: true },
    day: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      set: value => {
        if (value instanceof Date) {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value)
        }
        return value
      },
    },
    viewerType: {
      type: String,
      enum: VIEWER_TYPES,
      required: function () {
        return this.eventType === 'view'
      },
    },
    viewerKey: {
      type: String,
      required: function () {
        return this.eventType === 'view'
      },
    },
    storyId: { type: ObjectId, ref: 'Story' },
    chapterId: {
      type: ObjectId,
      ref: 'Chapter',
      required: function () {
        return this.eventType === 'view'
      },
    },
    occurredAt: { type: Date, required: true },
    payloadDigest: String,
    projectionVersion: Number,
  },
  appendOnlyOptions,
)
schema.index({ sourceEventKey: 1 }, { unique: true })
schema.plugin(appendOnly)
schema.index(
  { chapterId: 1, day: 1, viewerType: 1, viewerKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventType: 'view' },
  },
)
schema.index({ storyId: 1, day: 1, eventType: 1 })
export const StatisticsEvent = defineModel('StatisticsEvent', schema, 'statisticsEvents')
