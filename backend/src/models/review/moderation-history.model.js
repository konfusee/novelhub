import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js'
const schema = new Schema(
  {
    aggregateType: { type: String, required: true },
    aggregateId: { type: ObjectId, required: true },
    action: { type: String, required: true },
    outcome: String,
    submissionId: { type: ObjectId, ref: 'PublicationSubmission' },
    revisionId: { type: ObjectId, ref: 'ContentRevision' },
    evidenceBatchId: { type: ObjectId, ref: 'EvidenceBatch' },
    evidenceBatchVersion: Number,
    actorAccountId: { type: ObjectId, ref: 'Account', required: true },
    actorAuthorizationEpoch: Number,
    reason: String,
    feedback: String,
    beforeStateDigest: String,
    afterStateDigest: String,
    occurredAt: { type: Date, default: Date.now },
    correlationId: String,
  },
  appendOnlyOptions,
)
schema.plugin(appendOnly)
schema.index({ aggregateType: 1, aggregateId: 1, createdAt: -1 })
schema.index({ submissionId: 1, createdAt: -1 })
schema.index({ action: 1, occurredAt: -1 })
export const ModerationHistory = defineModel('ModerationHistory', schema, 'moderationHistory')
