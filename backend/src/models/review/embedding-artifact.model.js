import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js'
const schema = new Schema(
  {
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    batchId: { type: ObjectId, ref: 'EvidenceBatch', required: true },
    model: { type: String, required: true },
    dimensions: { type: Number, required: true, min: 1 },
    passageId: { type: String, required: true },
    passageOrder: Number,
    offsets: { type: Schema.Types.Mixed },
    textReference: String,
    textHash: String,
    authorAccountId: { type: ObjectId, ref: 'Account' },
    eligibilityStatus: String,
    vector: {
      type: [Number],
      required: true,
      validate: {
        validator(values) {
          return values.length === this.dimensions
        },
        message: 'vector length must equal dimensions',
      },
    },
    provider: String,
    status: String,
    chunkingVersion: { type: String, required: true },
  },
  appendOnlyOptions,
)
schema.plugin(appendOnly)
schema.index({ revisionId: 1, model: 1, chunkingVersion: 1, passageId: 1 }, { unique: true })
schema.index({ batchId: 1, passageOrder: 1 })
export const EmbeddingArtifact = defineModel('EmbeddingArtifact', schema, 'embeddingArtifacts')
