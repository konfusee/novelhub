import {
  appendOnly,
  appendOnlyOptions,
  coinAmount,
  defineModel,
  ObjectId,
  Schema,
} from '../shared/schema.js';

const schema = new Schema(
  {
    unlockRequestId: { type: ObjectId, ref: 'UnlockRequest', required: true },
    ledgerEntryIds: {
      type: [{ type: ObjectId, ref: 'LedgerEntry' }],
      required: true,
      default: undefined,
      validate: { validator: (v) => v.length > 0, message: 'ledgerEntryIds must not be empty' },
    },
    beneficiaries: {
      type: [ObjectId],
      required: true,
      default: undefined,
      validate: { validator: (v) => v.length > 0, message: 'beneficiaries must not be empty' },
    },
    amount: coinAmount,
    negotiatedAllocationSnapshot: Schema.Types.Mixed,
    roundingData: {
      author: { type: String, enum: ['floor'], default: 'floor' },
      platform: { type: String, enum: ['remainder'], default: 'remainder' },
    },
    policySnapshot: {
      type: Schema.Types.Mixed,
      required: function () {
        return this.negotiatedAllocationSnapshot == null;
      },
    },
  },
  appendOnlyOptions,
);
schema.plugin(appendOnly);
schema.index({ unlockRequestId: 1 }, { unique: true });
export const RevenueAllocation = defineModel('RevenueAllocation', schema, 'revenueAllocations');
