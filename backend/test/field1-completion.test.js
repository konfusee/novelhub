import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Account,
  AuditEvent,
  ContentReport,
  DeliveryAttempt,
  ExternalIdentity,
  LedgerEntry,
  Notification,
  NotificationOutbox,
  PayoutSheetRow,
  RoleAssignment,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
import {
  notify,
  policy,
  registerLifecycleHook,
} from '../src/modules/accounts-administration/service.js'
import {
  deliverNextNotification,
  closeSettledContacts,
} from '../src/modules/accounts-administration/email-worker.js'
import { evaluateDeletedAccountPayouts } from '../src/modules/coins-payouts/account-lifecycle.js'
import { correctPayoutBank } from '../src/modules/coins-payouts/finance/payout-bank-correction.js'
import { simulatePendingPayouts } from '../src/modules/coins-payouts/finance/automatic-payout-results.js'
import { claimReport } from '../src/modules/moderation-ai/moderation/report-queue.js'

useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const post = (admin, path, body) =>
  request(app).post(`/api${path}`).set('Cookie', admin.cookie).set('Origin', origin).send(body)

it('grants and revokes staff roles with authorization, single-role, former-author and stale-version guards', async () => {
  const admin = await authenticatedAccount('admin'),
    reader = await authenticatedAccount()
  const path = `/admin/accounts/${reader.account._id}/role`
  const input = {
    role: 'moderator',
    expectedVersion: reader.account.version,
    reason: 'Phân công kiểm duyệt',
  }
  expect((await post(reader, path, input)).status).toBe(403)
  expect((await post(admin, path, { ...input, role: 'author' })).status).toBe(400)
  const granted = await post(admin, path, input)
  expect(granted.status).toBe(200)
  expect((await post(admin, path, input)).status).toBe(409)
  expect(
    await RoleAssignment.countDocuments({ accountId: reader.account._id, status: 'active' }),
  ).toBe(1)
  expect((await request(app).get('/api/auth/me').set('Cookie', reader.cookie)).status).toBe(401)
  expect(
    (
      await post(admin, path, {
        ...input,
        role: 'reader',
        expectedVersion: granted.body.account.version,
      })
    ).status,
  ).toBe(200)
  expect(
    await RoleAssignment.countDocuments({ accountId: reader.account._id, status: 'active' }),
  ).toBe(0)
  const former = await authenticatedAccount('reader', { everAuthor: true })
  const denied = await post(admin, `/admin/accounts/${former.account._id}/role`, {
    ...input,
    expectedVersion: former.account.version,
  })
  expect(denied.status).toBe(409)
  expect(denied.body.error.code).toBe('former_author')
  const otherAdmin = await authenticatedAccount('admin')
  const conflict = await post(admin, `/admin/accounts/${otherAdmin.account._id}/role`, {
    ...input,
    expectedVersion: otherAdmin.account.version,
  })
  expect(conflict.status).toBe(409)
  expect(conflict.body.error.code).toBe('SYS-MSG-NEW-S08')
  expect(
    await Notification.countDocuments({
      recipientAccountId: reader.account._id,
      eventType: 'system.role-changed',
    }),
  ).toBe(2)
  expect(await AuditEvent.countDocuments({ action: 'account.role-changed' })).toBe(2)
})

it.each(['suspend', 'close'])('protects moderator accounts from %s', async action => {
  const admin = await authenticatedAccount('admin')
  const moderator = await authenticatedAccount('moderator')
  const response = await post(admin, `/admin/accounts/${moderator.account._id}/status`, {
    action,
    expectedVersion: moderator.account.version,
    reason: 'Tạm khóa',
  })
  expect(response.status).toBe(409)
  expect(response.body.error.code).toBe('protected_account')
  expect((await Account.findById(moderator.account._id)).status).toBe('active')
})

it('creates in-app notices idempotently and retries email at most three times with recorded attempts', async () => {
  const reader = await authenticatedAccount()
  const event = {
    recipientAccountId: reader.account._id,
    eventType: 'publication.decided',
    sourceEventKey: 'submission:1',
    payload: { outcome: 'approved' },
  }
  await notify(event)
  await notify(event)
  expect(await Notification.countDocuments()).toBe(1)
  expect(await NotificationOutbox.countDocuments()).toBe(1)
  const send = vi.fn().mockRejectedValue(new Error('SMTP offline'))
  for (let index = 0; index < 4; index++)
    await deliverNextNotification({ send }, { now: new Date(Date.now() + index * 3600_000) })
  expect(send).toHaveBeenCalledTimes(3)
  expect((await NotificationOutbox.findOne()).status).toBe('failed')
  expect(await DeliveryAttempt.countDocuments({ status: 'failed' })).toBe(3)
  await notify({
    ...event,
    eventType: 'followed-story.chapter-released',
    sourceEventKey: 'chapter:1',
  })
  expect(await NotificationOutbox.countDocuments()).toBe(1)
})

it('leases delivery to one worker and recovers an abandoned claim without reusing its attempt number', async () => {
  const reader = await authenticatedAccount()
  const notice = await notify({
    recipientAccountId: reader.account._id,
    eventType: 'google.linked',
    sourceEventKey: 'google:1',
  })
  const outbox = await NotificationOutbox.findOne({ notificationId: notice._id })
  outbox.status = 'claimed'
  outbox.claimId = 'crashed'
  outbox.leaseExpiresAt = new Date(0)
  outbox.attemptCount = 1
  await outbox.save()
  await DeliveryAttempt.create({
    notificationId: notice._id,
    outboxId: outbox._id,
    channel: 'email',
    attemptKey: `${outbox._id}:1`,
    attemptNumber: 1,
    attemptedAt: new Date(0),
  })
  const send = vi.fn().mockResolvedValue({ accepted: true, provider: 'test' })
  await Promise.all([deliverNextNotification({ send }), deliverNextNotification({ send })])
  expect(send).toHaveBeenCalledTimes(1)
  expect(await DeliveryAttempt.countDocuments({ status: 'accepted', attemptNumber: 2 })).toBe(1)
  expect(
    await DeliveryAttempt.countDocuments({ status: 'failed', failureCode: 'lease_expired' }),
  ).toBe(1)
})

it('forfeits Reader coins on deletion and pays final Author earnings below threshold once next month', async () => {
  const admin = await authenticatedAccount('admin'),
    author = await authenticatedAccount('author', {
      bankDetails: { bankName: 'Bank', accountNumber: '123', accountHolder: 'AUTHOR' },
    })
  const readerWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'reader-coins',
    availableBalance: 42,
  })
  const earnings = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 500,
  })
  await ExternalIdentity.create({
    accountId: author.account._id,
    provider: 'google',
    providerSubject: 'test-subject',
  })
  expect(
    (
      await post(admin, `/admin/accounts/${author.account._id}/status`, {
        action: 'close',
        expectedVersion: author.account.version,
        reason: 'Yêu cầu xóa',
      })
    ).status,
  ).toBe(200)
  expect((await Wallet.findById(readerWallet._id)).availableBalance).toBe(0)
  expect(await LedgerEntry.countDocuments({ ledgerType: 'deletion-forfeiture', amount: 42 })).toBe(
    1,
  )
  expect(await ExternalIdentity.countDocuments({ accountId: author.account._id })).toBe(0)
  const now = new Date()
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 7 * 3600_000,
  )
  await evaluateDeletedAccountPayouts(nextMonth)
  await evaluateDeletedAccountPayouts(nextMonth)
  const withdrawal = await WithdrawalRequest.findOne({ accountId: author.account._id })
  expect(withdrawal).toMatchObject({ forcedByDeletion: true, amountCoins: 500, thresholdCoins: 0 })
  expect(await WithdrawalRequest.countDocuments()).toBe(1)
  expect(await PayoutSheetRow.countDocuments()).toBe(1)
  expect((await Wallet.findById(earnings._id)).availableBalance).toBe(0)
  await correctPayoutBank(
    admin.account,
    String(withdrawal._id),
    {
      expectedVersion: withdrawal.version,
      bankDetails: {
        bankName: 'TPBank',
        accountNumber: '0123456789',
        accountHolder: 'TEST AUTHOR',
      },
      reason: 'Support verified beneficiary',
    },
    nextMonth,
  )
  await simulatePendingPayouts(nextMonth)
  expect((await Wallet.findById(earnings._id)).availableBalance).toBe(0)
  expect(
    await LedgerEntry.countDocuments({ sourceId: withdrawal._id, ledgerType: 'withdrawal-debit' }),
  ).toBe(1)
  await closeSettledContacts()
  expect(
    (await Account.findById(author.account._id).select('+retainedPayoutEmail')).retainedPayoutEmail,
  ).toBe(author.account.email)
  const sent = []
  while (
    await deliverNextNotification(
      {
        send: async message => {
          sent.push(message)
          return { accepted: true, provider: 'test' }
        },
      },
      { now: new Date(+nextMonth + 3600_000) },
    )
  ) {
    /* drain */
  }
  expect(sent.some(message => message.text.includes('500 VND'))).toBe(true)
  await closeSettledContacts()
  const closed = await Account.findById(author.account._id).select('+retainedPayoutEmail')
  expect(closed.retainedPayoutEmail).toBeUndefined()
  expect(closed.financiallyClosedAt).toBeTruthy()
})

it('updates revenue defaults and payout threshold through the effective policy contract', async () => {
  const admin = await authenticatedAccount('admin')
  const response = await post(admin, '/admin/policy', {
    expectedPolicyId: null,
    expectedPolicyVersion: null,
    reason: 'Cấu hình',
    priceMinCoins: 200,
    priceMaxCoins: 5000,
    durationMinDays: 1,
    durationMaxDays: 14,
    withdrawalThresholdCoins: 500,
    authorSharePercent: 80,
  })
  expect(response.status).toBe(201)
  expect(await policy.getEffective()).toMatchObject({
    authorSharePercent: 80,
    platformSharePercent: 20,
    withdrawalThresholdCoins: 500,
  })
  expect((await post(admin, '/admin/policy', { authorSharePercent: 101 })).status).toBe(400)
})

it('rolls back coin forfeiture and anonymization when a deletion hook fails', async () => {
  const admin = await authenticatedAccount('admin'),
    reader = await authenticatedAccount()
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: 80,
  })
  const remove = registerLifecycleHook('onAccountDeleted', 'test-failure', async () => {
    throw new Error('dependent field failed')
  })
  try {
    const result = await post(admin, `/admin/accounts/${reader.account._id}/status`, {
      action: 'close',
      expectedVersion: reader.account.version,
      reason: 'Xóa tài khoản',
    })
    expect(result.status).toBe(500)
    expect((await Account.findById(reader.account._id)).status).toBe('active')
    expect((await Wallet.findById(wallet._id)).availableBalance).toBe(80)
    expect(await LedgerEntry.countDocuments()).toBe(0)
  } finally {
    remove()
  }
})

it('uses the effective Admin policy for new moderation claims without changing old deadlines', async () => {
  const admin = await authenticatedAccount('admin'),
    moderator = await authenticatedAccount('moderator')
  expect(
    (
      await post(admin, '/admin/policy', {
        expectedPolicyId: null,
        expectedPolicyVersion: null,
        reason: 'Thời hạn mới',
        priceMinCoins: 200,
        priceMaxCoins: 5000,
        durationMinDays: 1,
        durationMaxDays: 14,
        claimExpiryHours: 6,
      })
    ).status,
  ).toBe(201)
  const report = await ContentReport.create({
    reporterAccountId: admin.account._id,
    targetType: 'story',
    targetId: admin.account._id,
  })
  const now = new Date()
  await claimReport(
    moderator.account,
    String(report._id),
    { expectedVersion: report.version },
    testConfig(),
    now,
  )
  const claimed = await ContentReport.findById(report._id)
  expect(+claimed.claimExpiresAt - +now).toBe(6 * 3600_000)
})
