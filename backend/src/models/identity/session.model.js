import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

export const SESSION_STATUSES = ['active', 'revoked', 'expired'];
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    // SHA-256 digest of the opaque browser token. The raw token is never persisted.
    tokenHash: { type: String, required: true, select: false },
    credentialVersion: { type: Number, required: true, min: 0 },
    authorizationEpoch: { type: Number, required: true, min: 0 },
    status: { type: String, enum: SESSION_STATUSES, default: 'active', required: true },
    issuedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    providerSessionReference: { type: String, select: false },
  },
  mutableOptions,
);
schema.index({ accountId: 1, status: 1 });
schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ expiresAt: 1, status: 1 });
export const Session = defineModel('Session', schema, 'sessions');
