import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { loadEnv, toAppConfig } from '../src/config/env.js'
export const testEnv = {
  ...parseEnv(readFileSync(new URL('../.env.example', import.meta.url), 'utf8')),
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://test',
}
export const testConfig = (overrides = {}) => ({ ...toAppConfig(loadEnv(testEnv)), ...overrides })
export const captchaConfig = testConfig().securityConfig
