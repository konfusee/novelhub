import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const PUBLICATION_STATUSES = [
  'draft',
  'submitted',
  'under-review',
  'approved',
  'published',
  'unpublished',
  'archived',
];
export const COMPLETION_STATUSES = ['ongoing', 'completed'];
const themeSchema = new Schema(
  {
    accentColor: { type: String, maxlength: 64 },
    fontFamily: { type: String, maxlength: 64 },
    headingDividerPreset: { type: String, maxlength: 64 },
    coverBannerMediaId: { type: ObjectId, ref: 'MediaAsset' },
  },
  { _id: false, strict: 'throw' },
);
const schema = new Schema(
  {
    authorAccountId: { type: ObjectId, ref: 'Account', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    coverMediaId: { type: ObjectId, ref: 'MediaAsset' },
    language: { type: String, enum: ['vi'], default: 'vi', required: true },
    categoryIds: {
      type: [{ type: ObjectId, ref: 'Category' }],
      required: true,
      validate: {
        validator: (values) => values.length >= 1,
        message: 'a story must have at least one category',
      },
    },
    publicationStatus: {
      type: String,
      enum: PUBLICATION_STATUSES,
      default: 'draft',
      required: true,
    },
    completionStatus: {
      type: String,
      enum: COMPLETION_STATUSES,
      default: 'ongoing',
      required: true,
    },
    draftRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    currentRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    publishedRevisionId: { type: ObjectId, ref: 'ContentRevision' },
    theme: { type: themeSchema, default: undefined },
    authoringFrozen: { type: Boolean, default: false, required: true },
    publicationTransition: { type: Schema.Types.Mixed },
    publishedAt: Date,
  },
  mutableOptions,
);
schema.index({ publicationStatus: 1, completionStatus: 1, publishedAt: -1 });
schema.index({ authorAccountId: 1, publicationStatus: 1 });
schema.index({ categoryIds: 1, publicationStatus: 1 });
export const Story = defineModel('Story', schema, 'stories');
