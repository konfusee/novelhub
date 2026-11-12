import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'
import { lockFields } from '../shared/guards.js'

export const BANK_MATCH_STATUSES = [
  'matched',
  'unmatched',
  'amount-mismatch',
  'expired',
  'already-paid',
  'resolved',
]
const schema = new Schema(
  {
    sePayTransactionId: { type: String, required: true },
    amountVnd: { type: Number, min: 0, required: true },
    content: String,
    extractedPaymentCode: String,
    matchStatus: { type: String, enum: BANK_MATCH_STATUSES, required: true },
    originalMatchStatus: { type: String, enum: BANK_MATCH_STATUSES, required: true },
    matchedOrderId: { type: ObjectId, ref: 'TopUpOrder' },
    receivedAt: { type: Date, required: true },
    apiKeyAuthenticated: { type: Boolean, required: true },
    resolvedBy: { type: ObjectId, ref: 'Account' },
    resolvedAt: Date,
    resolutionReason: String,
    adjustmentId: { type: ObjectId, ref: 'LedgerEntry' },
  },
  mutableOptions,
)
schema.pre('validate', function setOriginalMatchStatus() {
  if (this.isNew && this.originalMatchStatus == null) this.originalMatchStatus = this.matchStatus
})
lockFields(
  schema,
  [
    'sePayTransactionId',
    'amountVnd',
    'content',
    'extractedPaymentCode',
    'originalMatchStatus',
    'receivedAt',
    'apiKeyAuthenticated',
  ],
  { mode: 'insert-only' },
)
schema.index({ sePayTransactionId: 1 }, { unique: true })
schema.index({ matchStatus: 1, receivedAt: -1 })
schema.index({ matchedOrderId: 1, apiKeyAuthenticated: 1, matchStatus: 1 })
export const BankTransaction = defineModel('BankTransaction', schema, 'bankTransactions')
