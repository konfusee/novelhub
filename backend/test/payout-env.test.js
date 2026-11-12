import { expect, it } from 'vitest'
import { loadEnv, toAppConfig } from '../src/config/env.js'
import { testEnv } from './config.js'

it('requires explicit opt-in to start the payout worker', () => {
  const source = { ...testEnv }
  delete source.PAYOUT_WORKER_ENABLED
  expect(toAppConfig(loadEnv(source)).payoutWorkerEnabled).toBe(false)
  expect(
    toAppConfig(loadEnv({ ...source, PAYOUT_WORKER_ENABLED: 'true' })).payoutWorkerEnabled,
  ).toBe(true)
  expect(() => loadEnv({ ...source, PAYOUT_WORKER_ENABLED: 'yes' })).toThrow(
    'PAYOUT_WORKER_ENABLED',
  )
})
