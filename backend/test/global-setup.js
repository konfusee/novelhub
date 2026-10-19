import { MongoMemoryReplSet } from 'mongodb-memory-server'

// Tests run against a throwaway single-node replica set so transactions work
// exactly as in production, without touching the shared VPS database.
export default async function setup({ provide }) {
  const replSet = await MongoMemoryReplSet.create({
    // Match the VPS server (mongo:8.0) so tests exercise the same engine.
    binary: { version: '8.0.32' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })
  provide('mongoUri', replSet.getUri('novelhub_test'))
  return async () => {
    await replSet.stop()
  }
}
