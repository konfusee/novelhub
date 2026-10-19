import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
export const EVIDENCE_STAGES = ['embedding', 'comparison', 'llm']
export const EVIDENCE_STATUSES = [
  'pending',
  'embedding-complete',
  'discovery-complete',
  'llm-complete',
  'available-for-human-review',
  'failed',
]
const schema = new Schema(
  {
    submissionId: { type: ObjectId, ref: 'PublicationSubmission', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    packageDigest: String,
    stage: { type: String, enum: EVIDENCE_STAGES },
    status: { type: String, enum: EVIDENCE_STATUSES, default: 'pending', required: true },
    failedStage: { type: String, enum: EVIDENCE_STAGES },
    outputSchemaVersion: String,
    activeLeaseId: String,
  },
  mutableOptions,
)
schema.index({ submissionId: 1, createdAt: -1 })
schema.index({ revisionId: 1, status: 1 })
export const EvidenceBatch = defineModel('EvidenceBatch', schema, 'evidenceBatches')
