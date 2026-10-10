import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js';

const schema = new Schema(
  {
    authorAccountId: { type: ObjectId, ref: 'Account', required: true },
    percentage: { type: Number, min: 0, max: 100, required: true },
    effectiveAt: { type: Date, required: true },
    actorAccountId: { type: ObjectId, ref: 'Account', required: true },
    policyVersionId: { type: ObjectId, ref: 'PolicyVersion' },
  },
  appendOnlyOptions,
);
schema.plugin(appendOnly);
schema.index({ authorAccountId: 1, effectiveAt: -1 }, { unique: true });
export const AuthorRevenueRate = defineModel('AuthorRevenueRate', schema, 'authorRevenueRates');
