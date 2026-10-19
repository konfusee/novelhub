import { testEnv } from './config.js'
import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
const base = { ...testEnv, MONGODB_URI: 'mongodb://localhost/novelhub', NODE_ENV: 'test' }
describe('Google OAuth environment', () => {
  it('allows empty optional credentials', () => {
    expect(
      loadEnv({ ...base, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_REDIRECT_URI: '' })
        .GOOGLE_CLIENT_ID,
    ).toBeUndefined()
  })
  it('rejects incomplete configuration', () => {
    expect(() => loadEnv({ ...base, GOOGLE_CLIENT_ID: 'client' })).toThrow(/GOOGLE_CLIENT_SECRET/)
  })
  it('accepts a complete web client configuration', () => {
    expect(
      loadEnv({
        ...base,
        GOOGLE_CLIENT_ID: 'client',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:4000/api/auth/google/callback',
      }).GOOGLE_CLIENT_ID,
    ).toBe('client')
  })
})
