import { defineModel, mutableOptions, Schema } from '../shared/schema.js'

/** Fields safe to expose about another user (use for populate projections). */
export const PUBLIC_ACCOUNT_FIELDS = 'displayName profile status'

// Never serialized: read them only through explicit selects in owner/Admin code paths.
const PRIVATE_FIELDS = [
  'password',
  'normalizedEmail',
  'bankDetails',
  'retainedPayoutEmail',
  'finalPayoutBankDetailsSnapshot',
]

export const ACCOUNT_STATUSES = ['pending-verification', 'active', 'suspended', 'anonymized']

const passwordSchema = new Schema(
  {
    // Never plaintext. The whole `password` path is select:false; auth code reads it
    // with `.select('+password')`.
    hash: { type: String, required: true },
    algorithm: { type: String, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' },
)

const bankDetailsSchema = new Schema(
  {
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountHolder: { type: String, required: true, trim: true },
  },
  { _id: false, strict: 'throw' },
)

const accountSchema = new Schema(
  {
    status: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'pending-verification',
      required: true,
    },
    email: { type: String, trim: true },
    normalizedEmail: { type: String, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    profile: {
      avatarMediaId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
      bio: { type: String, maxlength: 1000 },
    },
    preferences: {
      fontSize: { type: String, enum: ['small', 'medium', 'large', 'x-large'], default: 'medium' },
      darkMode: { type: Boolean, default: false },
    },
    // Absent for Google-only accounts.
    password: { type: passwordSchema, default: undefined, select: false },
    emailVerifiedAt: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    // Author-entered payout details; used for future monthly evaluations only.
    bankDetails: { type: bankDetailsSchema, default: undefined, select: false },
    // Increment to sign out every session (password reset/change).
    credentialVersion: { type: Number, default: 0, min: 0 },
    // Increment on role grant/revocation or suspension; guards stale privileged writes.
    authorizationEpoch: { type: Number, default: 0, min: 0 },
    // Monotonic: once an account holds Author it can never become Moderator.
    everAuthor: { type: Boolean, default: false },
    suspendedAt: Date,
    anonymizedAt: Date,
    closedAt: Date,
    // Deletion-retained, Admin-only finance contact/snapshot until financial closure.
    retainedPayoutEmail: { type: String, select: false },
    finalPayoutBankDetailsSnapshot: { type: bankDetailsSchema, default: undefined, select: false },
    finalPayoutEvaluatedAt: Date,
    financiallyClosedAt: Date,
  },
  { ...mutableOptions, toJSON: { transform: stripPrivateFields } },
)

// Anonymized accounts drop their email, so uniqueness applies only while present.
accountSchema.index(
  { normalizedEmail: 1 },
  { unique: true, partialFilterExpression: { normalizedEmail: { $type: 'string' } } },
)
accountSchema.index({ status: 1, createdAt: -1 })

function stripPrivateFields(_doc, ret) {
  for (const field of PRIVATE_FIELDS) delete ret[field]
  return ret
}

const normalize = email => email?.trim().toLowerCase()

accountSchema.pre('validate', function deriveNormalizedEmail() {
  if (this.isModified('email')) this.normalizedEmail = normalize(this.email)
})

accountSchema.pre('validate', function keepEverAuthorMonotonic() {
  if (!this.isNew && this.isModified('everAuthor') && !this.everAuthor) {
    this.invalidate('everAuthor', 'everAuthor cannot be cleared once set')
  }
})

const GUARDED = ['email', 'normalizedEmail', 'everAuthor']

/**
 * Query and bulk updates skip document validation, so derive normalizedEmail and
 * keep everAuthor monotonic here. Returns the rewritten update.
 */
function guardUpdate(update) {
  if (Array.isArray(update)) throw new Error('Account: pipeline updates are not allowed')
  const operators = Object.keys(update).filter(k => k.startsWith('$'))
  const topLevel = Object.keys(update).filter(k => !k.startsWith('$'))
  if (topLevel.some(k => GUARDED.includes(k))) {
    throw new Error('Account: use $set to change email or everAuthor')
  }
  for (const op of operators) {
    if (op === '$set' || op === '$unset') continue
    const paths = [
      ...Object.keys(update[op] ?? {}),
      ...(op === '$rename' ? Object.values(update[op]) : []),
    ]
    if (paths.some(p => GUARDED.includes(p))) {
      throw new Error(`Account: ${op} is not allowed on email, normalizedEmail or everAuthor`)
    }
  }
  const set = { ...(update.$set ?? {}) }
  const unset = { ...(update.$unset ?? {}) }
  if ('normalizedEmail' in set || 'normalizedEmail' in unset) {
    throw new Error('Account: normalizedEmail is derived from email and cannot be set directly')
  }
  if ('everAuthor' in unset || ('everAuthor' in set && set.everAuthor !== true)) {
    throw new Error('Account: everAuthor cannot be cleared once set')
  }
  if ('email' in set) set.normalizedEmail = normalize(set.email)
  if ('email' in unset) unset.normalizedEmail = 1
  const next = { ...update }
  if (Object.keys(set).length) next.$set = set
  if (Object.keys(unset).length) next.$unset = unset
  return next
}

accountSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function guardQueryUpdate() {
  this.setUpdate(guardUpdate(this.getUpdate()))
})

accountSchema.pre('bulkWrite', function guardBulkUpdate(ops) {
  for (const op of ops) {
    if ('replaceOne' in op) throw new Error('Account: replace operations are not allowed')
    const body = op.updateOne ?? op.updateMany
    if (body) body.update = guardUpdate(body.update)
  }
})

accountSchema.pre(['replaceOne', 'findOneAndReplace'], function rejectReplace() {
  throw new Error('Account: replace operations are not allowed')
})

export const Account = defineModel('Account', accountSchema, 'accounts')
