import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const POLICY_STATUSES = ['draft', 'effective', 'superseded'];
const schema = new Schema(
  {
    status: { type: String, enum: POLICY_STATUSES, default: 'draft', required: true },
    effectiveAt: Date,
    priceMinCoins: { type: Number, min: 0, default: 200, required: true },
    priceMaxCoins: { type: Number, min: 0, default: 5000, required: true },
    durationMinDays: { type: Number, min: 1, default: 1, required: true },
    durationMaxDays: { type: Number, min: 1, default: 14, required: true },
    withdrawalThresholdCoins: { type: Number, min: 0, default: 100000, required: true },
    authorSharePercent: { type: Number, min: 0, max: 100, default: 70, required: true },
    platformSharePercent: { type: Number, min: 0, max: 100, default: 30, required: true },
    orderExpiryHours: { type: Number, min: 0, default: 24, required: true },
    claimExpiryHours: { type: Number, min: 0, default: 24, required: true },
    actorAccountId: { type: ObjectId, ref: 'Account', required: true },
  },
  mutableOptions,
);
schema.pre('validate', function validateBounds() {
  if (this.priceMinCoins > this.priceMaxCoins)
    this.invalidate('priceMaxCoins', 'max must be >= min');
  if (this.durationMinDays > this.durationMaxDays)
    this.invalidate('durationMaxDays', 'max must be >= min');
  if (this.authorSharePercent + this.platformSharePercent !== 100)
    this.invalidate('platformSharePercent', 'shares must total 100');
});
schema.index({ status: 1, effectiveAt: -1 });
export const PolicyVersion = defineModel('PolicyVersion', schema, 'policyVersions');
