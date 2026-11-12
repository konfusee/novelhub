import { expect, it, vi } from 'vitest'
import {
  Account,
  AuditEvent,
  PayoutResultEntry,
  MonthlyPayoutRun,
  LedgerEntry,
  PolicyVersion,
  RoleAssignment,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { runMonthlyPayouts } from '../src/modules/coins-payouts/finance/monthly-payout-worker.js'
import { generateMonthlyPayouts } from '../src/modules/coins-payouts/finance/admin-monthly-payouts.js'
import { getMonthlyPayoutPreview } from '../src/modules/coins-payouts/finance/admin-payout-preview.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const cutoff = new Date('2026-11-01T00:00:00+07:00')
const bank = { bankName: 'TPBank', accountNumber: '0123456789', accountHolder: 'TEST AUTHOR' }
async function prepare(balance = 150000) {
  const { account: admin } = await authenticatedAccount('admin')
  const { account } = await authenticatedAccount('author', { bankDetails: bank })
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: balance,
  })
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    withdrawalThresholdCoins: 100000,
    actorAccountId: admin._id,
  })
  return { account, wallet, admin }
}

it('runs at the Vietnam month boundary and includes former authors exactly once', async () => {
  const { account, wallet, admin } = await prepare()
  const role = await RoleAssignment.findOne({ accountId: account._id, role: 'author' })
  role.status = 'revoked'
  await role.save()
  await expect(
    generateMonthlyPayouts(admin, '2026-11', new Date(+cutoff - 1)),
  ).rejects.toMatchObject({ code: 'payout_period_not_due' })
  await Promise.all([runMonthlyPayouts(cutoff), runMonthlyPayouts(cutoff)])
  const withdrawal = await WithdrawalRequest.findOne({ accountId: account._id })
  expect(withdrawal).toMatchObject({
    periodId: '2026-11',
    amountCoins: 150000,
    status: 'paid',
    cutoffAt: cutoff,
  })
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(0)
  expect(await WithdrawalRequest.countDocuments()).toBe(1)
  expect(await LedgerEntry.countDocuments({ ledgerType: 'withdrawal-debit' })).toBe(1)
})

it('late recovery leaves new earnings for the next period', async () => {
  const { account, wallet } = await prepare(200000)
  await LedgerEntry.create({
    walletId: wallet._id,
    ledgerType: 'adjustment',
    direction: 'credit',
    amount: 50000,
    actorAccountId: account._id,
    reason: 'New earnings after cutoff',
    sourceType: 'test',
    sourceId: account._id,
    idempotencyScope: { operation: 'test', ownerId: account._id, key: 'new-credit' },
    occurredAt: new Date(+cutoff + 1000),
  })
  const recovered = await runMonthlyPayouts(new Date('2026-11-11T12:00:00+07:00'))
  expect(recovered.results[0].amountCoins).toBe(150000)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(50000)
  await runMonthlyPayouts(new Date('2026-11-12T12:00:00+07:00'))
  expect(await WithdrawalRequest.countDocuments()).toBe(1)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(50000)
})

it('a below-threshold prior balance does not qualify because of new monthly credits', async () => {
  const { account, wallet } = await prepare(150000)
  await LedgerEntry.create({
    walletId: wallet._id,
    ledgerType: 'adjustment',
    direction: 'credit',
    amount: 100000,
    actorAccountId: account._id,
    reason: 'After cutoff',
    sourceType: 'test',
    sourceId: account._id,
    idempotencyScope: { operation: 'test', ownerId: account._id, key: 'new-credit' },
    occurredAt: cutoff,
  })
  await runMonthlyPayouts(cutoff)
  expect(await WithdrawalRequest.countDocuments()).toBe(0)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(150000)
})

it('preview includes revoked authors with their retained bank and earnings', async () => {
  const { account } = await prepare()
  await RoleAssignment.updateOne(
    { accountId: account._id, role: 'author' },
    { $set: { status: 'revoked' } },
  )
  const preview = await getMonthlyPayoutPreview('2026-11')
  expect(preview.items.map(row => row.accountId)).toContain(String(account._id))
  expect((await Account.findById(account._id)).status).toBe('active')
})

it('automatically simulates once, with system audit and a persisted run', async () => {
  const { wallet } = await prepare()
  await runMonthlyPayouts(cutoff)
  await runMonthlyPayouts(cutoff)
  const result = await PayoutResultEntry.findOne().select('+transferReference')
  expect(result).toMatchObject({ result: 'Paid', executionMode: 'simulation' })
  expect(result.transferReference).toMatch(/^SIM-AUTO-/)
  expect(result.actorAccountId).toBeUndefined()
  expect(await PayoutResultEntry.countDocuments()).toBe(1)
  expect(
    await AuditEvent.countDocuments({ actorType: 'system', action: 'monthly-payout.simulated' }),
  ).toBe(1)
  expect(await MonthlyPayoutRun.findOne()).toMatchObject({
    periodId: '2026-11',
    status: 'completed',
    totalCount: 1,
    paidCount: 1,
    pendingCount: 0,
    totalCoins: 150000,
  })
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(0)
})

it('an invalid bank produces an explicit simulated failure, without a second debit', async () => {
  const { account, wallet } = await prepare()
  await Account.updateOne(
    { _id: account._id },
    { $set: { bankDetails: { ...bank, accountNumber: 'invalid' } } },
  )
  await runMonthlyPayouts(cutoff)
  await runMonthlyPayouts(cutoff)
  expect(await WithdrawalRequest.findOne()).toMatchObject({ status: 'pending' })
  expect(await PayoutResultEntry.findOne()).toMatchObject({
    result: 'Failed',
    executionMode: 'simulation',
  })
  expect(await PayoutResultEntry.countDocuments()).toBe(1)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(0)
  expect(await MonthlyPayoutRun.findOne()).toMatchObject({ status: 'pending', pendingCount: 1 })
})

it('a failed automatic settlement is recoverable after restart with no duplicate reservation', async () => {
  const { wallet } = await prepare()
  const spy = vi
    .spyOn(PayoutResultEntry, 'create')
    .mockRejectedValueOnce(new Error('provider persistence failure'))
  try {
    await expect(runMonthlyPayouts(cutoff)).rejects.toThrow('provider persistence failure')
  } finally {
    spy.mockRestore()
  }
  expect((await WithdrawalRequest.findOne()).status).toBe('pending')
  expect(await PayoutResultEntry.countDocuments()).toBe(0)
  await runMonthlyPayouts(cutoff)
  expect((await WithdrawalRequest.findOne()).status).toBe('paid')
  expect(await LedgerEntry.countDocuments({ ledgerType: 'withdrawal-debit' })).toBe(1)
  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(0)
})
