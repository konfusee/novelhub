import mongoose from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import { diffModelIndexes } from '../src/db/index-diff.js'
import { useTestDatabase } from './db.js'

// A probe model of its own, so an extra index never touches an application collection.
const Probe = mongoose.model(
  'IndexDiffProbe',
  new mongoose.Schema({ name: String }).index({ name: 1 }),
  'indexDiffProbes',
)
useTestDatabase()

const failing = (collectionName, error) => ({
  collection: { collectionName },
  diffIndexes: vi.fn(async () => {
    throw error
  }),
})
const { MongoNetworkError, MongoServerError } = mongoose.mongo

describe('index diff', () => {
  it('reports nothing to drop when the indexes match the model', async () => {
    const log = vi.fn()
    expect(await diffModelIndexes([Probe], { log })).toEqual([])
    expect(log).toHaveBeenCalledWith('indexDiffProbes: create [] drop []')
  })

  it('reports an index that syncIndexes() would drop without dropping it', async () => {
    await Probe.collection.createIndex({ extra: 1 })
    try {
      const log = vi.fn()
      expect(await diffModelIndexes([Probe], { log })).toEqual([
        'indexDiffProbes would drop extra_1',
      ])
      expect(log).toHaveBeenCalledWith('indexDiffProbes: create [] drop ["extra_1"]')
      const names = (await Probe.listIndexes()).map(index => index.name)
      expect(names).toContain('extra_1')
    } finally {
      await Probe.collection.dropIndex('extra_1')
    }
  })

  it('treats only a missing namespace as a missing collection and continues', async () => {
    const log = vi.fn()
    const missing = failing(
      'notYetCreated',
      new MongoServerError({
        message: 'ns does not exist',
        code: 26,
        codeName: 'NamespaceNotFound',
      }),
    )
    expect(await diffModelIndexes([missing, Probe], { log })).toEqual([])
    expect(log.mock.calls.map(call => call[0])).toEqual([
      'notYetCreated: missing collection (would be created)',
      'indexDiffProbes: create [] drop []',
    ])
  })

  it('fails instead of reporting a diff when the inspection itself fails', async () => {
    const unauthorized = new MongoServerError({
      message: 'not authorized',
      code: 13,
      codeName: 'Unauthorized',
    })
    const network = new MongoNetworkError('connection closed')
    for (const error of [unauthorized, network]) {
      const log = vi.fn()
      await expect(diffModelIndexes([failing('accounts', error), Probe], { log })).rejects.toBe(
        error,
      )
      expect(log).not.toHaveBeenCalled()
    }
  })
})
