import mongoose from 'mongoose'

export const { Schema } = mongoose
export const { ObjectId } = Schema.Types

/**
 * Options for mutable documents. `version` is the optimistic-concurrency
 * counter the design uses for compare-and-set: a stale `save()` throws
 * `VersionError` instead of overwriting a newer write.
 */
export const mutableOptions = Object.freeze({
  timestamps: true,
  versionKey: 'version',
  optimisticConcurrency: true,
  strict: 'throw',
})

/** Options for append-only records (history, ledger, audit). */
export const appendOnlyOptions = Object.freeze({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  strict: 'throw',
})

const MUTATING_QUERIES = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]

/**
 * Makes a collection append-only at the model layer: documents can be
 * created, never updated or deleted. Corrections are new records
 * (adjustments/reversals), as the finance and moderation design requires.
 * Writes through `Model.collection` bypass Mongoose and are forbidden.
 */
export function appendOnly(schema) {
  for (const op of MUTATING_QUERIES) {
    schema.pre(op, function rejectMutation() {
      throw new Error(`${this.model.modelName} is append-only: ${op} is not allowed`)
    })
  }
  schema.pre('save', function rejectResave() {
    if (!this.isNew)
      throw new Error(`${this.constructor.modelName} is append-only: update not allowed`)
  })
  schema.pre(['deleteOne'], { document: true, query: false }, function rejectDelete() {
    throw new Error(`${this.constructor.modelName} is append-only: delete not allowed`)
  })
  schema.pre('bulkWrite', function rejectBulkMutation(ops) {
    const mutation = ops.find(op => !('insertOne' in op))
    if (mutation) {
      const type = Object.keys(mutation)[0]
      throw new Error(`${this.modelName} is append-only: bulkWrite ${type} is not allowed`)
    }
  })
}

/** Builds a model, reusing it if already compiled (keeps watch-mode reloads safe). */
export function defineModel(name, schema, collection) {
  return mongoose.models[name] ?? mongoose.model(name, schema, collection)
}

/** Positive whole-coin amount (coins are the only internal unit; 1 coin = 1 VND). */
export const coinAmount = { type: Number, required: true, min: 0, validate: Number.isInteger }
