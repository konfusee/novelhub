import { testConfig } from './config.js'
import { Writable } from 'node:stream'
import express from 'express'
import pino from 'pino'
import { pinoHttp } from 'pino-http'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createLogger, logSerializers } from '../src/config/logger.js'
import { errorHandler } from '../src/middleware/errors.js'

function duplicateKeyError() {
  const err = new Error('E11000 duplicate key error dup key: { normalizedEmail: "leak@x.vn" }')
  err.code = 11000
  err.keyValue = { normalizedEmail: 'leak@x.vn' }
  err.errorResponse = { errmsg: err.message }
  return err
}

describe('error logging', () => {
  it('never writes duplicate-key values through the request logger', async () => {
    const lines = []
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString())
        done()
      },
    })
    const logger = pino({ serializers: logSerializers }, sink)
    const app = express()
    app.use(pinoHttp({ logger, serializers: logSerializers }))
    app.get('/boom', () => {
      throw duplicateKeyError()
    })
    app.use(errorHandler)

    const res = await request(app).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('internal_error')
    const output = lines.join('')
    expect(output).toContain('Duplicate key')
    expect(output).not.toContain('leak@x.vn')
  })
})

describe('compact HTTP logging', () => {
  it('omits headers and query secrets and keeps routine guest checks quiet', async () => {
    const lines = []
    const sink = new Writable({
      write(chunk, _encoding, done) {
        lines.push(chunk.toString())
        done()
      },
    })
    const logger = pino({ level: 'info' }, sink)
    const app = createApp({
      ...testConfig(),
      logger,
      corsOrigin: 'http://localhost:5173',
      nodeEnv: 'test',
    })
    await request(app).get('/api/auth/me')
    expect(lines).toHaveLength(0)
    await request(app)
      .get('/api/missing?token=private-query')
      .set('Authorization', 'Bearer private-header')
      .set('User-Agent', 'private-agent')
    const output = lines.join('')
    expect(output).toContain('GET /api/missing -> 404')
    expect(output).not.toContain('private-query')
    expect(output).not.toContain('private-header')
    expect(output).not.toContain('private-agent')
    expect(output).not.toContain('headers')
  })
})

describe('secret redaction', () => {
  it('redacts root and nested credentials and OTP codes', () => {
    const lines = []
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString())
        done()
      },
    })
    const logger = createLogger('info', { nodeEnv: 'test' }, sink)
    logger.info(
      {
        password: 'private-password',
        token: 'private-token',
        otp: 'private-otp',
        challenge: 'private-challenge',
        clientSecret: 'private-client-secret',
        config: {
          GOOGLE_CLIENT_SECRET: 'private-google',
          SMTP_PASSWORD: 'private-smtp',
          otp: 'private-nested-otp',
        },
      },
      'safe event',
    )
    expect(lines.join('')).not.toContain('private-')
    expect(lines.join('')).toContain('[redacted]')
  })
})
