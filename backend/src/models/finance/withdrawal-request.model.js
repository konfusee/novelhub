import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
import { lockFields, forwardOnly } from '../shared/guards.js'

export const WITHDRAWAL_STATUSES = ['pending', 'paid']
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    earningsWalletId: { type: ObjectId, ref: 'Wallet', required: true },
    origin: { type: String, enum: ['system-monthly'], required: true },
    // No default: legacy obligations must never be silently simulated.
    executionMode: { type: String, enum: ['simulation', 'external'] },
    periodId: { type: String, required: true },
    cutoffAt: { type: Date, required: true },
    evaluatedBalanceCoins: coinAmount,
    thresholdCoins: coinAmount,
    policySnapshot: { type: Schema.Types.Mixed },
    evaluatedAt: { type: Date, required: true },
    amountCoins: coinAmount,
    payoutSlipAmountVnd: { type: Number, required: true, min: 0 },
    bankDetailsSnapshot: { type: Schema.Types.Mixed, select: false },
    status: { type: String, enum: WITHDRAWAL_STATUSES, default: 'pending', required: true },
    forcedByDeletion: { type: Boolean, required: true },
    executionMode: { type: String, enum: ['external', 'simulation'], default: 'external' },
  },
  mutableOptions,
)
schema.pre('validate', function validateSlipAmount() {
  if (this.payoutSlipAmountVnd !== this.amountCoins) {
    this.invalidate('payoutSlipAmountVnd', 'Payout slip equals withdrawn coins')
  }
})
lockFields(
  schema,
  [
    'accountId',
    'earningsWalletId',
    'origin',
    'executionMode',
    'periodId',
    'cutoffAt',
    'evaluatedBalanceCoins',
    'thresholdCoins',
    'policySnapshot',
    'evaluatedAt',
    'amountCoins',
    'payoutSlipAmountVnd',
    'bankDetailsSnapshot',
    'forcedByDeletion',
    'executionMode',
  ],
  { mode: 'insert-only' },
)
forwardOnly(schema, 'status', { pending: ['paid'], paid: [] })
schema.index({ accountId: 1, periodId: 1 }, { unique: true })
schema.index({ status: 1, periodId: 1 })
schema.index({ executionMode: 1, status: 1, evaluatedAt: 1 })
export const WithdrawalRequest = defineModel('WithdrawalRequest', schema, 'withdrawalRequests')
