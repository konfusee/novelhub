import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
import { lockFields } from '../shared/guards.js';
export const REVISION_STATUSES = [
  'editable',
  'validated',
  'submitted',
  'immutable',
  'superseded',
  'approved',
  'rejected',
  'cancelled',
];
const schema = new Schema(
  {
    contentType: { type: String, enum: ['story', 'chapter'], required: true },
    storyId: { type: ObjectId, ref: 'Story', required: true },
    chapterId: {
      type: ObjectId,
      ref: 'Chapter',
      required() {
        return this.contentType === 'chapter';
      },
    },
    authorAccountId: { type: ObjectId, ref: 'Account', required: true },
    revisionNumber: { type: Number, required: true, min: 1 },
    parentRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    content: { type: Schema.Types.Mixed, required: true },
    formatVersion: { type: String, required: true },
    validation: { type: Schema.Types.Mixed },
    altText: { type: String },
    rightsDeclarationId: { type: ObjectId, ref: 'RightsDeclaration' },
    status: { type: String, enum: REVISION_STATUSES, default: 'editable', required: true },
    submittedAt: Date,
    immutableAt: Date,
    packageDigest: { type: String },
    rightsDigest: { type: String },
    mediaDigest: { type: String },
    mediaIds: [{ type: ObjectId, ref: 'MediaAsset' }],
  },
  mutableOptions,
);
lockFields(
  schema,
  [
    'contentType',
    'storyId',
    'chapterId',
    'authorAccountId',
    'revisionNumber',
    'parentRevisionId',
    'content',
    'formatVersion',
    'validation',
    'altText',
    'rightsDeclarationId',
    'packageDigest',
    'rightsDigest',
    'mediaDigest',
    'mediaIds',
    'submittedAt',
  ],
  { mode: 'frozen-by', lockField: 'immutableAt' },
);
schema.index({ contentType: 1, storyId: 1, chapterId: 1, revisionNumber: 1 }, { unique: true });
schema.index({ chapterId: 1, status: 1, revisionNumber: -1 });
export const ContentRevision = defineModel('ContentRevision', schema, 'contentRevisions');
