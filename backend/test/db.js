import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, inject } from 'vitest'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'

/**
 * Connects to the shared in-memory replica set, builds indexes for every model
 * the test file has imported, and clears data between tests.
 */
export function useTestDatabase() {
  beforeAll(async () => {
    await connectDatabase(inject('mongoUri'), { serverSelectionTimeoutMS: 10000 })
    for (const name of mongoose.modelNames()) {
      const model = mongoose.model(name)
      await model.createCollection()
      await model.syncIndexes()
    }
  })

  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections()
    await Promise.all(collections.map(c => c.deleteMany({})))
  })

  afterAll(async () => {
    await disconnectDatabase()
  })
}
