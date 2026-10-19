import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
export const LLM_REVIEW_STATUSES = ['pending', 'succeeded', 'failed']
const schema = new Schema(
  {
    batchId: { type: ObjectId, ref: 'EvidenceBatch', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    status: { type: String, enum: LLM_REVIEW_STATUSES, required: true },
    criteriaVersion: String,
    inputFingerprint: String,
    suggestions: [{ type: String }],
    riskReasons: [{ type: String }],
    evidenceRefs: [{ type: Schema.Types.Mixed }],
    provider: String,
    providerResponseRef: { type: String, select: false },
    completedAt: Date,
    failureCode: String,
  },
  mutableOptions,
)
schema.index({ batchId: 1 }, { unique: true, partialFilterExpression: { status: 'succeeded' } })
export const LlmReview = defineModel('LlmReview', schema, 'llmReviews')
