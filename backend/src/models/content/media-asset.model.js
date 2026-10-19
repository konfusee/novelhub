import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const MEDIA_KINDS = ['image', 'cover', 'banner'];
export const MEDIA_STATUSES = ['pending-upload', 'available', 'quarantined', 'failed', 'deleted'];
const schema = new Schema(
  {
    ownerAccountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story' },
    chapterId: { type: ObjectId, ref: 'Chapter' },
    revisionId: { type: ObjectId, ref: 'ContentRevision' },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    storageProvider: String,
    objectKey: { type: String, select: false },
    contentType: String,
    sizeBytes: { type: Number, min: 0 },
    checksum: String,
    status: { type: String, enum: MEDIA_STATUSES, default: 'pending-upload', required: true },
    rightsDeclarationId: { type: ObjectId, ref: 'RightsDeclaration' },
    accessClass: String,
    availabilityDigest: String,
    unavailableReason: String,
    deletedAt: Date,
  },
  mutableOptions,
);
schema.index({ storyId: 1, status: 1 });
schema.index(
  { objectKey: 1 },
  { unique: true, partialFilterExpression: { objectKey: { $type: 'string' } } },
);
export const MediaAsset = defineModel('MediaAsset', schema, 'mediaAssets');
