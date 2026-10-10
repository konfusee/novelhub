import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
import { lockFields, forwardOnly } from '../shared/guards.js';

export const UNLOCK_ENTITLEMENT_STATUSES = ['active', 'expired', 'revoked'];

const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story', required: true },
    chapterId: { type: ObjectId, ref: 'Chapter', required: true },
    publishedRevisionId: { type: ObjectId, ref: 'ContentRevision', required: true },
    status: { type: String, enum: UNLOCK_ENTITLEMENT_STATUSES, required: true },
    purchasedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    priceCoins: coinAmount,
    pricePolicySnapshot: Schema.Types.Mixed,
    accessPolicySnapshot: Schema.Types.Mixed,
  },
  mutableOptions,
);
lockFields(
  schema,
  [
    'accountId',
    'storyId',
    'chapterId',
    'publishedRevisionId',
    'purchasedAt',
    'expiresAt',
    'priceCoins',
    'pricePolicySnapshot',
    'accessPolicySnapshot',
  ],
  { mode: 'insert-only' },
);
forwardOnly(schema, 'status', { active: ['expired', 'revoked'], expired: [], revoked: [] });
schema.index({ accountId: 1, chapterId: 1 }, { unique: true });
export const UnlockEntitlement = defineModel('UnlockEntitlement', schema, 'unlockEntitlements');
