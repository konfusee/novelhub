import { coinAmount, defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
import { lockFields, forwardOnly } from '../shared/guards.js';

export const UNLOCK_REQUEST_STATUSES = ['requested', 'committed', 'rejected'];

const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    chapterId: { type: ObjectId, ref: 'Chapter', required: true },
    requestedPriceCoins: { ...coinAmount, required: false },
    effectivePriceCoins: { ...coinAmount, required: false },
    idempotencyScope: {
      operation: { type: String, required: true },
      ownerId: { type: ObjectId, required: true },
      key: { type: String, required: true },
    },
    status: { type: String, enum: UNLOCK_REQUEST_STATUSES, required: true },
    entitlementId: { type: ObjectId, ref: 'UnlockEntitlement' },
    policySnapshot: Schema.Types.Mixed,
  },
  mutableOptions,
);
lockFields(
  schema,
  ['accountId', 'chapterId', 'requestedPriceCoins', 'effectivePriceCoins', 'policySnapshot'],
  { mode: 'insert-only' },
);
forwardOnly(schema, 'status', {
  requested: ['committed', 'rejected'],
  committed: [],
  rejected: [],
});
schema.index(
  { 'idempotencyScope.operation': 1, 'idempotencyScope.ownerId': 1, 'idempotencyScope.key': 1 },
  { unique: true },
);
export const UnlockRequest = defineModel('UnlockRequest', schema, 'unlockRequests');
