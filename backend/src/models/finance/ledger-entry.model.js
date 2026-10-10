import {
  appendOnly,
  appendOnlyOptions,
  coinAmount,
  defineModel,
  ObjectId,
  Schema,
} from '../shared/schema.js';

// Allowed directions per ledger type (adjustments and reversals may go either way).
const DIRECTIONS_BY_TYPE = {
  'topup-credit': ['credit'],
  'unlock-debit': ['debit'],
  'allocation-credit': ['credit'],
  'withdrawal-debit': ['debit'],
  adjustment: ['credit', 'debit'],
  reversal: ['credit', 'debit'],
  'deletion-forfeiture': ['debit'],
};

export const LEDGER_TYPES = Object.keys(DIRECTIONS_BY_TYPE);

const ledgerEntrySchema = new Schema(
  {
    walletId: { type: ObjectId, ref: 'Wallet', required: true },
    ledgerType: { type: String, enum: LEDGER_TYPES, required: true },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amount: coinAmount,
    unit: { type: String, enum: ['coin'], default: 'coin' },
    // Mandatory for Admin adjustments; enforced below.
    reason: { type: String, trim: true, maxlength: 500 },
    actorAccountId: { type: ObjectId, ref: 'Account' },
    sourceType: { type: String, required: true },
    sourceId: { type: ObjectId, required: true },
    // Idempotency is scoped to operation + owner, never a free-form global key.
    idempotencyScope: {
      operation: { type: String, required: true },
      ownerId: { type: ObjectId, required: true },
      key: { type: String, required: true },
    },
    reversalOf: { type: ObjectId, ref: 'LedgerEntry' },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  appendOnlyOptions,
);

ledgerEntrySchema.plugin(appendOnly);

ledgerEntrySchema.pre('validate', function enforceLedgerRules() {
  const allowed = DIRECTIONS_BY_TYPE[this.ledgerType];
  if (allowed && !allowed.includes(this.direction)) {
    this.invalidate('direction', `${this.ledgerType} entries must be ${allowed.join(' or ')}`);
  }
  if (this.ledgerType === 'adjustment') {
    if (!this.reason) this.invalidate('reason', 'Admin adjustments require a reason');
    if (!this.actorAccountId)
      this.invalidate('actorAccountId', 'Admin adjustments require an actor');
  }
  if (this.ledgerType === 'reversal' && !this.reversalOf) {
    this.invalidate('reversalOf', 'Reversals must reference the reversed entry');
  }
});

// One operation (e.g. an unlock) writes one entry per wallet leg; retries hit this key.
ledgerEntrySchema.index(
  {
    'idempotencyScope.operation': 1,
    'idempotencyScope.ownerId': 1,
    'idempotencyScope.key': 1,
    walletId: 1,
  },
  { unique: true },
);
// An entry can be reversed at most once.
ledgerEntrySchema.index(
  { reversalOf: 1 },
  { unique: true, partialFilterExpression: { reversalOf: { $type: 'objectId' } } },
);
ledgerEntrySchema.index({ walletId: 1, occurredAt: -1 });
ledgerEntrySchema.index({ sourceType: 1, sourceId: 1 });

export const LedgerEntry = defineModel('LedgerEntry', ledgerEntrySchema, 'ledgerEntries');
