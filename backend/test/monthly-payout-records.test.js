import { expect, it, vi } from 'vitest'
import {
  Account,
  AuditEvent,
  LedgerEntry,
  PayoutSheetRow,
  PolicyVersion,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { withTransaction } from '../src/db/connection.js'
import { createMonthlyPayoutRecords } from '../src/modules/coins-payouts/finance/monthly-payout-records.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const bank = {
  bankName: 'TPBank',
  accountNumber: '0123456789',
  accountHolder: 'NGUYEN VAN A',
}

// 23:59:59 ngày 30/11 theo giờ Việt Nam.
const evaluatedAt = new Date('2026-11-30T16:59:59.000Z')

async function preparePayout(balance = 150000, bankDetails = bank) {
  const author = await authenticatedAccount('author', { bankDetails })
  const admin = await authenticatedAccount('admin')

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: balance,
  })

  const policy = await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-11-01T00:00:00+07:00'),
    withdrawalThresholdCoins: 100000,
    actorAccountId: admin.account._id,
  })

  async function run() {
    return withTransaction(async session => {
      const account = await Account.findById(author.account._id)
        .select('+bankDetails')
        .session(session)

      const currentWallet = await Wallet.findById(wallet._id).session(session)

      const currentPolicy = await PolicyVersion.findById(policy._id).session(session)

      return createMonthlyPayoutRecords(
        {
          account,
          wallet: currentWallet,
          periodId: '2026-11',
          policy: currentPolicy,
          actorAccountId: admin.account._id,
        },
        session,
        evaluatedAt,
      )
    })
  }

  return {
    walletId: wallet._id,
    accountId: author.account._id,
    run,
  }
}

async function expectNoPayoutRecords() {
  expect(await WithdrawalRequest.countDocuments()).toBe(0)
  expect(await PayoutSheetRow.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
  expect(await AuditEvent.countDocuments({ action: 'monthly-payout.created' })).toBe(0)
}

it.each([100000, 150000])(
  'số dư %i xu thì trích toàn bộ và tạo khoản chi pending',
  async balance => {
    const { walletId, accountId, run } = await preparePayout(balance)

    const result = await run()

    expect(result).toMatchObject({
      state: 'created',
      amountCoins: balance,
      balance: 0,
    })

    const wallet = await Wallet.findById(walletId)
    expect(wallet.availableBalance).toBe(0)

    const withdrawal = await WithdrawalRequest.findOne({
      accountId,
      periodId: '2026-11',
    })
      .select('+bankDetailsSnapshot')
      .lean()

    expect(withdrawal).toMatchObject({
      status: 'pending',
      amountCoins: balance,
      evaluatedBalanceCoins: balance,
      thresholdCoins: 100000,
      payoutSlipAmountVnd: balance,
      bankDetailsSnapshot: bank,
    })

    const row = await PayoutSheetRow.findOne({
      withdrawalRequestId: withdrawal._id,
    }).lean()

    expect(row.amountCoins).toBe(balance)

    const entry = await LedgerEntry.findOne({
      sourceType: 'WithdrawalRequest',
      sourceId: withdrawal._id,
    }).lean()

    expect(entry).toMatchObject({
      ledgerType: 'withdrawal-debit',
      direction: 'debit',
      amount: balance,
    })

    expect(await WithdrawalRequest.countDocuments()).toBe(1)
    expect(await PayoutSheetRow.countDocuments()).toBe(1)
    expect(await LedgerEntry.countDocuments()).toBe(1)
    expect(await AuditEvent.countDocuments({ action: 'monthly-payout.created' })).toBe(1)
  },
)

it.each([50000, 99999])(
  'số dư %i xu dưới ngưỡng thì giữ nguyên, không tạo khoản chi',
  async balance => {
    const { walletId, run } = await preparePayout(balance)

    expect(await run()).toEqual({
      state: 'skipped',
      reason: 'below-threshold',
    })

    expect((await Wallet.findById(walletId)).availableBalance).toBe(balance)
    await expectNoPayoutRecords()
  },
)

it('đủ xu nhưng thiếu ngân hàng thì không trích xu', async () => {
  const { walletId, run } = await preparePayout(150000, null)

  expect(await run()).toEqual({
    state: 'missing-bank-details',
  })

  expect((await Wallet.findById(walletId)).availableBalance).toBe(150000)
  await expectNoPayoutRecords()
})

it('lập lại cùng kỳ không tạo trùng và không trích số xu mới phát sinh', async () => {
  const { walletId, run } = await preparePayout()

  const first = await run()

  // Giả lập tác giả kiếm thêm xu sau khi khoản chi đã được lập.
  await Wallet.findByIdAndUpdate(walletId, {
    $inc: {
      availableBalance: 50000,
      balanceVersion: 1,
      version: 1,
    },
  })

  const repeated = await run()

  expect(repeated).toMatchObject({
    state: 'existing',
    withdrawalId: first.withdrawalId,
    amountCoins: 150000,
  })

  expect((await Wallet.findById(walletId)).availableBalance).toBe(50000)
  expect(await WithdrawalRequest.countDocuments()).toBe(1)
  expect(await PayoutSheetRow.countDocuments()).toBe(1)
  expect(await LedgerEntry.countDocuments()).toBe(1)
})

it('ghi audit lỗi thì rollback số dư và toàn bộ bản ghi khoản chi', async () => {
  const { walletId, run } = await preparePayout()

  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('test-audit-failure'))

  try {
    await expect(run()).rejects.toThrow('test-audit-failure')
  } finally {
    spy.mockRestore()
  }

  expect((await Wallet.findById(walletId)).availableBalance).toBe(150000)
  await expectNoPayoutRecords()
})
