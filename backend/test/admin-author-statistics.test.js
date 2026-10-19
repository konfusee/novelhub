import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, AuthorApplication } from '../src/models/index.js'
import { adminAuthorStatistics } from '../src/modules/admin-author-statistics.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(
  testConfig({
    cookieName: 'novelhub_session',
  }),
)
it('counts real application decisions, current eligible Authors at Vietnam boundaries', async () => {
  const author = await authenticatedAccount('author'),
    suspended = await authenticatedAccount('author'),
    buyer = await authenticatedAccount('reader')
  await Account.updateOne(
    {
      _id: suspended.account._id,
    },
    {
      $set: {
        status: 'suspended',
      },
    },
  )
  await AuthorApplication.create([
    {
      applicantAccountId: author.account._id,
      status: 'approved',
      submittedAt: new Date('2026-09-01'),
      decidedAt: new Date('2026-09-30T17:00:00Z'),
      decidedBy: author.account._id,
    },
    {
      applicantAccountId: buyer.account._id,
      status: 'submitted',
      submittedAt: new Date('2026-10-01'),
    },
    {
      applicantAccountId: suspended.account._id,
      status: 'rejected',
      submittedAt: new Date('2026-10-02'),
      decidedAt: new Date('2026-10-03'),
      decidedBy: author.account._id,
    },
  ])
  const result = await adminAuthorStatistics('2026-10', new Date('2026-11-02'))
  expect(result.summary).toEqual({
    applications: 2,
    approvedApplications: 1,
    rejectedApplications: 1,
    pendingApplications: 1,
    activeAuthors: 1,
  })
  expect(JSON.stringify(result)).not.toContain(buyer.account.email)
})
it('enforces Admin access, strict periods and private responses without fabricating missing counts', async () => {
  const admin = await authenticatedAccount('admin')
  const path = '/api/admin/author-statistics'
  expect((await request(app).get(path)).status).toBe(401)
  const reader = await authenticatedAccount('reader')
  expect((await request(app).get(path).set('Cookie', reader.cookie)).status).toBe(403)
  for (const query of ['period=2026-13', 'accountId=forged'])
    expect((await request(app).get(`${path}?${query}`).set('Cookie', admin.cookie)).status).toBe(
      400,
    )
  const response = await request(app).get(path).set('Cookie', admin.cookie)
  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toContain('no-store')
  expect(Object.values(response.body.summary)).toEqual(Array(5).fill(0))
})
