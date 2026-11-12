import { defineModel, mutableOptions, Schema } from '../shared/schema.js'

const schema = new Schema(
  {
    periodId: { type: String, required: true },
    cutoffAt: { type: Date, required: true },
    executionMode: { type: String, enum: ['simulation'], required: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'pending', 'failed'],
      required: true,
    },
    lastEvaluatedAt: Date,
    totalCount: { type: Number, default: 0 },
    paidCount: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },
    totalCoins: { type: Number, default: 0 },
  },
  mutableOptions,
)
schema.index({ periodId: 1 }, { unique: true })
export const MonthlyPayoutRun = defineModel('MonthlyPayoutRun', schema, 'monthlyPayoutRuns')
