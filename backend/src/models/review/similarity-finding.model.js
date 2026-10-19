import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js';
const schema = new Schema(
  {
    batchId: { type: ObjectId, ref: 'EvidenceBatch', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    sourceChapterId: { type: ObjectId, ref: 'Chapter', required: true },
    sourceRevisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    sourceAuthorAccountId: { type: ObjectId, ref: 'Account', required: true },
    queryPassageId: { type: String, required: true },
    sourcePassageId: { type: String, required: true },
    rank: { type: Number, required: true, min: 1, validate: Number.isInteger },
    score: { type: Number, required: true, min: 0, max: 1 },
    matchedSnippets: [{ type: Schema.Types.Mixed }],
    evidenceHash: String,
    occurredAt: { type: Date, default: Date.now },
  },
  appendOnlyOptions,
);
schema.plugin(appendOnly);
schema.index({ batchId: 1, score: -1 });
schema.index({ revisionId: 1, sourceRevisionId: 1 });
export const SimilarityFinding = defineModel('SimilarityFinding', schema, 'similarityFindings');
