import { lockFields } from '../shared/guards.js'
import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'

export const WALLET_PURPOSES = ['reader-coins', 'author-earnings', 'system-earnings']
export const OWNER_TYPES = ['account', 'system']

const walletSchema = new Schema(
  {
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    ownerId: { type: ObjectId, required: true },
    purpose: { type: String, enum: WALLET_PURPOSES, required: true },
    unit: { type: String, enum: ['coin'], default: 'coin' },
    availableBalance: { ...coinAmount, default: 0 },
    balanceVersion: { type: Number, min: 0, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  mutableOptions,
)
// Owner, purpose and unit define the wallet; they never change after creation.
// Balance changes must use a conditional update (e.g. `availableBalance: { $gte: amount }`)
// because $inc bypasses schema validators.
lockFields(walletSchema, ['ownerType', 'ownerId', 'purpose', 'unit', 'expiresAt'], {
  mode: 'insert-only',
})
walletSchema.index({ ownerId: 1, purpose: 1 }, { unique: true })
walletSchema.index({ ownerType: 1, purpose: 1 })
walletSchema.pre('validate', function validateWallet() {
  if (this.expiresAt != null) this.invalidate('expiresAt', 'Coins never expire')
  if (this.ownerType === 'system' && this.purpose !== 'system-earnings') {
    this.invalidate('purpose', 'System owners hold only system earnings')
  }
  if (this.ownerType === 'account' && this.purpose === 'system-earnings') {
    this.invalidate('purpose', 'Account owners cannot hold system earnings')
  }
})
export const Wallet = defineModel('Wallet', walletSchema, 'wallets')
