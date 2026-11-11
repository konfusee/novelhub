import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  LedgerEntry,
  PublicationSubmission,
  RoleAssignment,
  Session,
  Story,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
afterEach(() => vi.restoreAllMocks())
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
async function fixture(balance = 0) {
  const admin = await authenticatedAccount('admin'),
    author = await authenticatedAccount('author', {
      bankDetails: { bankName: 'Test bank', accountNumber: '123456', accountHolder: 'TEST AUTHOR' },
      password: { hash: 'not-a-real-hash', algorithm: 'scrypt', updatedAt: new Date() },
    })
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'reader-coins',
    availableBalance: 0,
  })
  const earnings = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: balance,
  })
  const close = (extra = {}) =>
    request(app)
      .post(`/api/admin/accounts/${author.account._id}/status`)
      .set('Cookie', admin.cookie)
      .set('Origin', origin)
      .send({
        action: 'close',
        expectedVersion: author.account.version,
        reason: 'Đóng tài khoản theo yêu cầu',
        ...extra,
      })
  return { admin, author, wallet, earnings, close }
}
it('anonymizes zero-balance identity and revokes access without financial writes', async () => {
  const f = await fixture()
  expect((await f.close()).status).toBe(200)
  const account = await Account.findById(f.author.account._id)
    .select(
      '+password +normalizedEmail +bankDetails +finalPayoutBankDetailsSnapshot +retainedPayoutEmail',
    )
    .lean()
  expect(account.status).toBe('anonymized')
  expect(account.displayName).toBe('Deleted user')
  expect(account.email).toBeUndefined()
  expect(account.normalizedEmail).toBeUndefined()
  expect(account.password).toBeUndefined()
  expect(account.retainedPayoutEmail).toBeUndefined()
  expect(account.finalPayoutBankDetailsSnapshot).toBeUndefined()
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(0)
  expect(
    await LedgerEntry.countDocuments({ ledgerType: 'deletion-forfeiture', walletId: f.wallet._id }),
  ).toBe(0)
  expect(await Session.countDocuments({ accountId: account._id, status: 'active' })).toBe(0)
  expect(await RoleAssignment.countDocuments({ accountId: account._id, status: 'active' })).toBe(0)
  expect((await f.close()).status).toBe(409)
  expect(
    (await request(app).get('/api/author/dashboard').set('Cookie', f.author.cookie)).status,
  ).toBe(401)
})
it('anonymizes an account with unpaid earnings and retains private final payout contact', async () => {
  const f = await fixture(500)
  const response = await f.close()
  expect(response.status).toBe(200)
  const account = await Account.findById(f.author.account._id).select(
    '+retainedPayoutEmail +finalPayoutBankDetailsSnapshot',
  )
  expect(account.status).toBe('anonymized')
  expect(account.email).toBeUndefined()
  expect(account.retainedPayoutEmail).toBe(f.author.account.email)
  expect(account.finalPayoutBankDetailsSnapshot.bankName).toBe('Test bank')
  expect(account.finalPayoutEvaluatedAt).toBeUndefined()
  expect((await Wallet.findById(f.earnings._id)).availableBalance).toBe(500)
  expect(await WithdrawalRequest.countDocuments()).toBe(0)
})
it('unpublishes live stories and cancels unreleased chapters and claimed submissions without deleting revisions', async () => {
  const f = await fixture()
  const category = await Category.create({
    name: 'Thử nghiệm',
    normalizedName: 'thử nghiệm',
    createdBy: f.admin.account._id,
  })
  const created = await request(app)
    .post('/api/author/stories')
    .set('Cookie', f.author.cookie)
    .set('Origin', origin)
    .send({ title: 'Truyện', description: 'Mô tả', categoryId: String(category._id) })
  const story = await Story.findById(created.body.story.id)
  const revision = await ContentRevision.findById(story.currentRevisionId)
  story.publicationStatus = 'published'
  story.publishedRevisionId = revision._id
  await story.save()
  const chapter = await Chapter.create({
    storyId: story._id,
    title: 'Chưa phát hành',
    orderKey: 1,
    status: 'scheduled',
  })
  const otherRevision = await ContentRevision.create({
    storyId: story._id,
    chapterId: chapter._id,
    authorAccountId: f.author.account._id,
    revisionNumber: 1,
    contentType: 'chapter',
    formatVersion: 'chapter-v1',
    content: { paragraphs: ['Nội dung'] },
    status: 'immutable',
    immutableAt: new Date(),
  })
  const submission = await PublicationSubmission.create({
    storyId: story._id,
    chapterId: chapter._id,
    revisionId: otherRevision._id,
    authorAccountId: f.author.account._id,
    status: 'pending-review',
    claimOwnerAccountId: f.admin.account._id,
    claimExpiresAt: new Date(Date.now() + 3600000),
  })
  const baseline = await Account.findById(f.author.account._id)
  expect((await f.close({ expectedVersion: baseline.version })).status).toBe(200)
  expect((await Story.findById(story._id)).publicationStatus).toBe('unpublished')
  expect((await Chapter.findById(chapter._id)).cancellationReason).toBe('account-deleted')
  const cancelled = await PublicationSubmission.findById(submission._id)
  expect(cancelled.status).toBe('cancelled')
  expect(cancelled.claimOwnerAccountId).toBeUndefined()
  expect(cancelled.claimReleaseHistory[0].reason).toBe('account-deleted')
  expect(await ContentRevision.countDocuments({ storyId: story._id })).toBe(2)
  expect((await request(app).get(`/api/catalog/stories/${story._id}`)).status).toBe(404)
})
it('rolls back identity and ledger on audit failure and rejects stale versions', async () => {
  const f = await fixture()
  expect((await f.close({ expectedVersion: 999 })).status).toBe(409)
  vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('audit failed'))
  expect((await f.close()).status).toBe(500)
  expect((await Account.findById(f.author.account._id)).status).toBe('active')
  expect((await Wallet.findById(f.wallet._id)).availableBalance).toBe(0)
  expect(await LedgerEntry.countDocuments({})).toBe(0)
})
