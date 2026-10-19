import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.js'],
    // One in-memory replica set is shared; run files sequentially to keep
    // collection state and index builds deterministic.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
