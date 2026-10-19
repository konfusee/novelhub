import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'

export const TOP_UP_PACKAGE_STATUSES = ['active', 'inactive']
const schema = new Schema(
  {
    priceVnd: { type: Number, required: true, min: 0, validate: Number.isInteger },
    coinAmount,
    status: { type: String, enum: TOP_UP_PACKAGE_STATUSES, required: true, default: 'active' },
    policyVersionId: { type: ObjectId, ref: 'PolicyVersion' },
    actorAccountId: { type: ObjectId, ref: 'Account' },
  },
  mutableOptions,
)
schema.index({ status: 1 })
schema.pre('validate', function validateFixedExchange() {
  if (this.priceVnd !== this.coinAmount) {
    this.invalidate('coinAmount', 'Top-up packages exchange VND to coins at 1:1')
  }
})
export const TopUpPackage = defineModel('TopUpPackage', schema, 'topUpPackages')
