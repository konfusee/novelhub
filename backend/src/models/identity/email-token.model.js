import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

export const EMAIL_TOKEN_PURPOSES = ['email-verification', 'password-reset', 'password-reset-otp'];

const emailTokenSchema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    // Hash of the emailed token; the raw token is never stored.
    tokenHash: { type: String, required: true },
    purpose: { type: String, enum: EMAIL_TOKEN_PURPOSES, required: true },
    otpHash: String,
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    revokedAt: Date,
  },
  mutableOptions,
);

emailTokenSchema.index({ tokenHash: 1 }, { unique: true });
emailTokenSchema.index({ accountId: 1, purpose: 1, usedAt: 1, revokedAt: 1 });

export const EmailToken = defineModel('EmailToken', emailTokenSchema, 'emailTokens');
