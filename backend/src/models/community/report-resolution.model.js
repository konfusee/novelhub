import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js'
export const RESOLUTION_OUTCOMES = [
  'dismissed',
  'comment-hidden',
  'chapter-unpublished',
  'story-unpublished',
  'author-warned',
]
export const REPORT_ACTIONS = [
  'dismiss',
  'hide-comment',
  'unpublish-chapter',
  'unpublish-story',
  'warn-author',
]
const schema = new Schema(
  {
    reportId: { type: ObjectId, ref: 'ContentReport', required: true },
    moderatorAccountId: { type: ObjectId, ref: 'Account', required: true },
    outcome: { type: String, enum: RESOLUTION_OUTCOMES, required: true },
    contentAction: { type: String, enum: REPORT_ACTIONS, required: true },
    reason: { type: String, required: true },
    // BR-NEW-S02: whether the resolution actually changed the reported content.
    contentChanged: { type: Boolean, required: true },
    targetSnapshot: { type: Schema.Types.Mixed },
    targetHash: String,
    resolvedAt: { type: Date, default: Date.now, required: true },
    historyId: { type: ObjectId, ref: 'ModerationHistory' },
  },
  appendOnlyOptions,
)
schema.plugin(appendOnly)
schema.index({ reportId: 1 }, { unique: true })
export const ReportResolution = defineModel('ReportResolution', schema, 'reportResolutions')
