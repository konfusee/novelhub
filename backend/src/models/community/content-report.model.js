import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
export const REPORT_STATUSES = ['open', 'under-review', 'dismissed', 'actioned', 'closed']
export const REPORT_TARGET_TYPES = ['story', 'chapter', 'comment']
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'copyright',
  'spoiler',
  'other',
]
const schema = new Schema(
  {
    reporterAccountId: { type: ObjectId, ref: 'Account', required: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    targetId: { type: ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS },
    details: { type: String, trim: true, maxlength: 1000 },
    targetRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    targetSnapshot: { type: Schema.Types.Mixed },
    targetHash: String,
    status: { type: String, enum: REPORT_STATUSES, default: 'open', required: true },
    submittedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    resolutionId: { type: ObjectId, ref: 'ReportResolution' },
    claimOwnerAccountId: { type: ObjectId, ref: 'Account' },
    claimExpiresAt: Date,
    claimVersion: { type: Number, default: 0 },
    claimReleaseHistory: [{ type: Schema.Types.Mixed }],
  },
  mutableOptions,
)
schema.index({ targetType: 1, targetId: 1, status: 1 })
schema.index({ reporterAccountId: 1, targetType: 1, targetId: 1, status: 1 })
schema.index({ status: 1, claimExpiresAt: 1, submittedAt: 1 })
export const ContentReport = defineModel('ContentReport', schema, 'contentReports')
