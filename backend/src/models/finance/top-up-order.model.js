import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

export const TOP_UP_ORDER_STATUSES = ['pending', 'paid', 'expired'];
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    walletId: { type: ObjectId, ref: 'Wallet', required: true },
    packageId: { type: ObjectId, ref: 'TopUpPackage', required: true },
    packageSnapshot: { type: Schema.Types.Mixed, required: true },
    paymentCode: { type: String, required: true, match: /^NH[0-9]{8}$/ },
    paidAmountVnd: { type: Number, min: 0, validate: Number.isInteger },
    coinAmount,
    status: { type: String, enum: TOP_UP_ORDER_STATUSES, required: true, default: 'pending' },
    expiresAt: { type: Date, required: true },
    bankTransactionId: { type: ObjectId, ref: 'BankTransaction' },
    confirmedAt: Date,
  },
  mutableOptions,
);
schema.index({ paymentCode: 1 }, { unique: true });
schema.index({ expiresAt: 1, status: 1 });
schema.index({ accountId: 1, createdAt: -1 });
export const TopUpOrder = defineModel('TopUpOrder', schema, 'topUpOrders');
