import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

export const EXTERNAL_IDENTITY_STATUSES = ['linked', 'unlinked'];
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    provider: { type: String, required: true, trim: true },
    providerSubject: { type: String, required: true, select: false },
    emailAtLink: { type: String, select: false },
    claimsDigest: { type: String, select: false },
    linkedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: EXTERNAL_IDENTITY_STATUSES, default: 'linked', required: true },
  },
  mutableOptions,
);
schema.index({ provider: 1, providerSubject: 1 }, { unique: true });
schema.index({ accountId: 1, status: 1 });
export const ExternalIdentity = defineModel('ExternalIdentity', schema, 'externalIdentities');
