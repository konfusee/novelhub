import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
import { lockFields, forwardOnly } from '../shared/guards.js';
export const RIGHTS_BASES = ['original', 'licensed'];
const schema = new Schema(
  {
    storyId: { type: ObjectId, ref: 'Story', required: true },
    submissionId: { type: ObjectId, ref: 'PublicationSubmission', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    basis: { type: String, enum: RIGHTS_BASES, required: true },
    asserted: { type: Boolean, required: true },
    sourceLicenceNote: String,
    declaredBy: { type: ObjectId, ref: 'Account', required: true },
    declaredAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['draft', 'asserted', 'superseded'],
      default: 'draft',
      required: true,
    },
    immutableAt: Date,
  },
  mutableOptions,
);
lockFields(
  schema,
  [
    'storyId',
    'submissionId',
    'revisionId',
    'basis',
    'asserted',
    'sourceLicenceNote',
    'declaredBy',
    'declaredAt',
  ],
  { mode: 'frozen-by', lockField: 'immutableAt' },
);
forwardOnly(schema, 'status', {
  draft: ['asserted'],
  asserted: ['superseded'],
  superseded: [],
});
schema.index({ storyId: 1, revisionId: 1 }, { unique: true });
export const RightsDeclaration = defineModel('RightsDeclaration', schema, 'rightsDeclarations');
