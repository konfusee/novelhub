import { appendOnly, appendOnlyOptions, defineModel, ObjectId, Schema } from '../shared/schema.js'

export const PAYOUT_RESULTS = ['Paid', 'Failed']
const schema = new Schema(
  {
    withdrawalRequestId: { type: ObjectId, ref: 'WithdrawalRequest', required: true },
    executionMode: { type: String, enum: ['external', 'simulation'] },
    requestDigest: String,
    resultEntryKey: { type: String, required: true },
    actorAccountId: { type: ObjectId, ref: 'Account' },
    occurredAt: { type: Date, required: true },
    result: { type: String, enum: PAYOUT_RESULTS, required: true },
    transferReference: { type: String, select: false },
    transferOccurredAt: Date,
    note: String,
    correctedBankDetailsSnapshot: { type: Schema.Types.Mixed, select: false },
  },
  appendOnlyOptions,
)
schema.plugin(appendOnly)
schema.index({ withdrawalRequestId: 1, resultEntryKey: 1 }, { unique: true })
schema.index(
  { transferReference: 1 },
  {
    unique: true,
    partialFilterExpression: { result: 'Paid', transferReference: { $type: 'string' } },
  },
)
schema.index(
  { withdrawalRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { result: 'Paid' },
  },
)
export const PayoutResultEntry = defineModel('PayoutResultEntry', schema, 'payoutResultEntries')
