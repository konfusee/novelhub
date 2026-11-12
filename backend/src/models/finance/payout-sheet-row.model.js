import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
import { lockFields } from '../shared/guards.js'

const schema = new Schema(
  {
    withdrawalRequestId: {
      type: ObjectId,
      ref: 'WithdrawalRequest',
      required: true,
      // Evaluation identity, locked on every write path below.
    },
    periodId: { type: String, required: true },
    // Required unless the row is a deleted account's final payout with no bank
    // details on file; Admin can auditably correct them from verified support details.
    bankDetailsSnapshot: { type: Schema.Types.Mixed, select: false },
    bankDetailsMissing: { type: Boolean, default: false },
    amountCoins: coinAmount,
    // Audited correction by Admin/support or the active owner; original snapshot stays immutable.
    correctedBankDetailsSnapshot: { type: Schema.Types.Mixed, select: false },
    correctedBy: { type: ObjectId, ref: 'Account' },
    correctedAt: Date,
    correctionReason: String,
  },
  mutableOptions,
)
lockFields(
  schema,
  ['withdrawalRequestId', 'periodId', 'bankDetailsSnapshot', 'bankDetailsMissing', 'amountCoins'],
  { mode: 'insert-only' },
)
schema.pre('validate', function requireBankDetailsOrMarker() {
  if (!this.isNew) return
  if (this.bankDetailsMissing && this.bankDetailsSnapshot != null) {
    this.invalidate('bankDetailsMissing', 'A row cannot have bank details and be marked missing')
  }
  if (!this.bankDetailsMissing && this.bankDetailsSnapshot == null) {
    this.invalidate(
      'bankDetailsSnapshot',
      'bankDetailsSnapshot is required unless bankDetailsMissing',
    )
  }
})
schema.index({ withdrawalRequestId: 1 }, { unique: true })
schema.index({ periodId: 1 })
export const PayoutSheetRow = defineModel('PayoutSheetRow', schema, 'payoutSheetRows')
