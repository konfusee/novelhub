import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
export const EXTRACTION_STATUSES = ['pending', 'succeeded', 'failed', 'rejected']
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story' },
    chapterId: { type: ObjectId, ref: 'Chapter' },
    sourceType: { type: String, enum: ['text-layer-pdf'], required: true },
    checksum: String,
    extractionStatus: { type: String, enum: EXTRACTION_STATUSES, required: true },
    extractedTextRef: String,
    formatMetadata: { type: Schema.Types.Mixed },
    failureCode: String,
    createdRevisionId: { type: ObjectId, ref: 'ContentRevision' },
  },
  mutableOptions,
)
schema.index({ accountId: 1, createdAt: -1 })
export const ContentImport = defineModel('ContentImport', schema, 'contentImports')
