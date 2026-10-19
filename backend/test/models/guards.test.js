import { describe, expect, it } from 'vitest'
import { withTransaction } from '../../src/db/connection.js'
import { forwardOnly, lockFields } from '../../src/models/shared/guards.js'
import {
  appendOnly,
  appendOnlyOptions,
  defineModel,
  mutableOptions,
  Schema,
} from '../../src/models/shared/schema.js'
import { useTestDatabase } from '../db.js'

const insertOnlySchema = new Schema(
  {
    amount: Number,
    snapshot: Schema.Types.Mixed,
    secret: { type: String, select: false },
    note: String,
  },
  mutableOptions,
)
lockFields(insertOnlySchema, ['amount', 'snapshot', 'secret'], { mode: 'insert-only' })
const InsertOnly = defineModel('GuardInsertOnly', insertOnlySchema, 'guardInsertOnly')

const setOnceSchema = new Schema({ releasedAt: Date, title: String }, mutableOptions)
lockFields(setOnceSchema, ['releasedAt'], { mode: 'set-once' })
const SetOnce = defineModel('GuardSetOnce', setOnceSchema, 'guardSetOnce')

const frozenSchema = new Schema(
  { body: String, digest: String, frozenAt: Date, status: String },
  mutableOptions,
)
lockFields(frozenSchema, ['body', 'digest'], { mode: 'frozen-by', lockField: 'frozenAt' })
const Frozen = defineModel('GuardFrozen', frozenSchema, 'guardFrozen')

const flowSchema = new Schema(
  { status: { type: String, default: 'claimed' }, note: String },
  mutableOptions,
)
forwardOnly(flowSchema, 'status', {
  claimed: ['started', 'stale'],
  started: ['succeeded', 'failed', 'stale'],
})
const Flow = defineModel('GuardFlow', flowSchema, 'guardFlow')

const historySchema = new Schema({ value: Number }, appendOnlyOptions)
historySchema.plugin(appendOnly)
const History = defineModel('GuardHistory', historySchema, 'guardHistory')

useTestDatabase()

const LOCKED = /cannot be changed|not allowed|locked/

describe('lockFields insert-only', () => {
  it('rejects document, query, bulk and replace writes but allows other fields', async () => {
    const doc = await InsertOnly.create({ amount: 1, snapshot: { r: 70 }, secret: 's' })

    doc.snapshot.r = 1
    doc.markModified('snapshot')
    await expect(doc.save()).rejects.toThrow(LOCKED)

    await expect(
      InsertOnly.updateOne({ _id: doc._id }, { $set: { 'snapshot.r': 1 } }),
    ).rejects.toThrow(LOCKED)
    await expect(
      InsertOnly.findOneAndUpdate({ _id: doc._id }, { $inc: { amount: 1 } }),
    ).rejects.toThrow(LOCKED)
    await expect(
      InsertOnly.bulkWrite([
        { updateOne: { filter: { _id: doc._id }, update: { $set: { amount: 9 } } } },
      ]),
    ).rejects.toThrow(LOCKED)
    await expect(InsertOnly.replaceOne({ _id: doc._id }, { amount: 9 })).rejects.toThrow(LOCKED)

    await InsertOnly.updateOne({ _id: doc._id }, { $set: { note: 'ok' } })
    const stored = await InsertOnly.findById(doc._id).select('+secret').lean()
    expect(stored).toMatchObject({ amount: 1, snapshot: { r: 70 }, secret: 's', note: 'ok' })
  })

  it('rejects overwriting a select:false field on a normally loaded document', async () => {
    const { _id } = await InsertOnly.create({ amount: 1, secret: '111' })
    const loaded = await InsertOnly.findById(_id)
    loaded.secret = '999'
    await expect(loaded.save()).rejects.toThrow(LOCKED)
    expect((await InsertOnly.findById(_id).select('+secret').lean()).secret).toBe('111')
  })
})

describe('lockFields set-once', () => {
  it('allows the first write, then rejects changes by save and by query', async () => {
    const doc = await SetOnce.create({ title: 'Ch 1' })
    doc.releasedAt = new Date('2026-01-01')
    await doc.save()

    doc.releasedAt = new Date('2026-02-01')
    await expect(doc.save()).rejects.toThrow(LOCKED)
    await expect(
      SetOnce.updateOne({ _id: doc._id }, { $set: { releasedAt: new Date() } }),
    ).rejects.toThrow(LOCKED)
  })

  it('allows a query update only when the filter requires the field to be empty', async () => {
    const { _id } = await SetOnce.create({ title: 'Ch 1' })
    const first = await SetOnce.updateOne(
      { _id, releasedAt: null },
      { $set: { releasedAt: new Date() } },
    )
    expect(first.modifiedCount).toBe(1)
    const second = await SetOnce.updateOne(
      { _id, releasedAt: null },
      { $set: { releasedAt: new Date() } },
    )
    expect(second.modifiedCount).toBe(0)
  })

  it('sees writes made earlier in the same transaction', async () => {
    const { _id } = await SetOnce.create({ title: 'Ch 1' })
    await expect(
      withTransaction(async session => {
        const doc = await SetOnce.findById(_id).session(session)
        doc.releasedAt = new Date('2026-01-01')
        await doc.save({ session })
        doc.releasedAt = new Date('2026-03-01')
        await doc.save({ session })
      }),
    ).rejects.toThrow(LOCKED)
    expect((await SetOnce.findById(_id).lean()).releasedAt).toBeUndefined()
  })
})

describe('lockFields frozen-by', () => {
  it('allows edits before the lock and rejects them after, on every path', async () => {
    const doc = await Frozen.create({ body: 'draft', digest: 'd1' })
    doc.body = 'edited'
    await doc.save()

    doc.frozenAt = new Date()
    await doc.save()

    doc.body = 'tampered'
    await expect(doc.save()).rejects.toThrow(LOCKED)

    const fresh = await Frozen.findById(doc._id)
    fresh.frozenAt = undefined
    fresh.body = 'tampered'
    await expect(fresh.save()).rejects.toThrow(LOCKED)

    await expect(Frozen.updateOne({ _id: doc._id }, { $set: { digest: 'd2' } })).rejects.toThrow(
      LOCKED,
    )
    await expect(Frozen.updateOne({ _id: doc._id }, { $unset: { frozenAt: 1 } })).rejects.toThrow(
      LOCKED,
    )

    await Frozen.updateOne({ _id: doc._id }, { $set: { status: 'approved' } })
    expect(await Frozen.findById(doc._id).lean()).toMatchObject({
      body: 'edited',
      digest: 'd1',
      status: 'approved',
    })
  })

  it('allows a guarded query update while still unlocked', async () => {
    const { _id } = await Frozen.create({ body: 'draft' })
    await Frozen.updateOne({ _id, frozenAt: null }, { $set: { body: 'v2' } })
    expect((await Frozen.findById(_id).lean()).body).toBe('v2')
  })
})

describe('appendOnly', () => {
  it('rejects bulkWrite updates and deletes but allows bulk inserts', async () => {
    const { _id } = await History.create({ value: 50 })
    await expect(
      History.bulkWrite([{ updateOne: { filter: { _id }, update: { $set: { value: 999 } } } }]),
    ).rejects.toThrow(/append-only/)
    await expect(History.bulkWrite([{ deleteOne: { filter: { _id } } }])).rejects.toThrow(
      /append-only/,
    )
    await History.bulkWrite([{ insertOne: { document: { value: 1 } } }])
    expect(await History.countDocuments()).toBe(2)
    expect((await History.findById(_id).lean()).value).toBe(50)
  })
})

describe('forwardOnly', () => {
  it('allows forward moves and rejects backward moves on save', async () => {
    const doc = await Flow.create({})
    doc.status = 'started'
    await doc.save()
    doc.status = 'claimed'
    await expect(doc.save()).rejects.toThrow(/cannot move from started to claimed/)
    const fresh = await Flow.findById(doc._id)
    fresh.status = 'succeeded'
    await fresh.save()
    expect((await Flow.findById(doc._id).lean()).status).toBe('succeeded')
  })

  it('requires compare-and-set for query updates', async () => {
    const { _id } = await Flow.create({})
    await expect(Flow.updateOne({ _id }, { $set: { status: 'started' } })).rejects.toThrow(
      /compare-and-set/,
    )
    await expect(
      Flow.updateOne({ _id, status: 'claimed' }, { $set: { status: 'succeeded' } }),
    ).rejects.toThrow(/compare-and-set/)
    const moved = await Flow.updateOne({ _id, status: 'claimed' }, { $set: { status: 'started' } })
    expect(moved.modifiedCount).toBe(1)
    // A stale writer that still believes the status is 'claimed' matches nothing.
    const stale = await Flow.updateOne({ _id, status: 'claimed' }, { $set: { status: 'stale' } })
    expect(stale.modifiedCount).toBe(0)
    await Flow.updateOne({ _id }, { $set: { note: 'unrelated fields stay free' } })
    expect((await Flow.findById(_id).lean()).status).toBe('started')
  })

  it('rejects bulk transitions without compare-and-set', async () => {
    const { _id } = await Flow.create({})
    await expect(
      Flow.bulkWrite([{ updateOne: { filter: { _id }, update: { $set: { status: 'failed' } } } }]),
    ).rejects.toThrow(/compare-and-set/)
  })
})
