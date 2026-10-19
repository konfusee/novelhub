import { testConfig } from './config.js'
import mongoose from 'mongoose'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { withTransaction } from '../src/db/connection.js'
import { Account } from '../src/models/index.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

describe('database connection', () => {
  it('reports ready once connected', async () => {
    const res = await request(createApp({ ...testConfig(), corsOrigin: '*' })).get('/api/ready')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ready', database: 'connected' })
  })

  it('commits a multi-document transaction', async () => {
    await withTransaction(async session => {
      await Account.create([{ displayName: 'A', email: 'a@x.vn' }], { session })
      await Account.create([{ displayName: 'B', email: 'b@x.vn' }], { session })
    })
    expect(await Account.countDocuments()).toBe(2)
  })

  it('rolls back every write when the transaction fails', async () => {
    await expect(
      withTransaction(async session => {
        await Account.create([{ displayName: 'A', email: 'a@x.vn' }], { session })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await Account.countDocuments()).toBe(0)
  })

  it('rejects a stale concurrent save (optimistic concurrency)', async () => {
    const created = await Account.create({ displayName: 'A', email: 'a@x.vn' })
    const first = await Account.findById(created._id)
    const second = await Account.findById(created._id)
    first.displayName = 'First'
    await first.save()
    second.displayName = 'Second'
    await expect(second.save()).rejects.toBeInstanceOf(mongoose.Error.VersionError)
  })
})
