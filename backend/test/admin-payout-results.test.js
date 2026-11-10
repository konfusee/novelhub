import { expect, it, vi } from 'vitest'
import {
  AuditEvent,
  LedgerEntry,
  PayoutResultEntry,
  PolicyVersion,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { generateMonthlyPayouts } from '../src/modules/coins-payouts/finance/admin-monthly-payouts.js'
import { recordSimulatedPayoutResult } from '../src/modules/coins-payouts/finance/admin-payout-results.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

async function prepare() {
  const { account: admin } = await authenticatedAccount('admin')

  const { account: author } = await authenticatedAccount('author', {
    bankDetails: {
      bankName: 'TPBank',
      accountNumber: '0123456789',
      accountHolder: 'NGUYEN VAN A',
    },
  })

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author._id,
    purpose: 'author-earnings',
    availableBalance: 150000,
  })

  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-11-01T00:00:00+07:00'),
    withdrawalThresholdCoins: 100000,
    actorAccountId: admin._id,
  })

  const generated = await generateMonthlyPayouts(
    admin,
    '2026-11',
    new Date('2026-11-30T10:00:00+07:00'),
  )

  const withdrawalId = generated.results.find(
    item => item.accountId === String(author._id),
  ).withdrawalId

  // Doanh thu mới phát sinh sau khi đã trích khoản chi.
  await Wallet.updateOne(
    { _id: wallet._id },
    {
      $inc: {
        availableBalance: 20000,
        balanceVersion: 1,
        version: 1,
      },
    },
  )

  return { admin, withdrawalId, walletId: wallet._id }
}

function input(result, note = '') {
  return {
    resultEntryKey: crypto.randomUUID(),
    result,
    note,
  }
}

async function expectWalletUnchanged(walletId) {
  expect((await Wallet.findById(walletId)).availableBalance).toBe(20000)

  // Chỉ có dòng trích xu lúc lập khoản chi.
  expect(
    await LedgerEntry.countDocuments({
      walletId,
      ledgerType: 'withdrawal-debit',
    }),
  ).toBe(1)
}

it('Paid đổi khoản chi sang paid nhưng không trừ xu lần nữa', async () => {
  const { admin, withdrawalId, walletId } = await prepare()

  const result = await recordSimulatedPayoutResult(admin, withdrawalId, input('Paid'))

  expect(result).toMatchObject({
    withdrawalId,
    result: 'Paid',
    status: 'paid',
    reused: false,
  })

  expect((await WithdrawalRequest.findById(withdrawalId)).status).toBe('paid')

  const entry = await PayoutResultEntry.findById(result.resultEntryId).select('+transferReference')

  expect(entry.transferReference).toMatch(/^SIM-/)
  expect(await PayoutResultEntry.countDocuments()).toBe(1)

  await expectWalletUnchanged(walletId)
})

it('Failed giữ pending; lần thử mới có thể chuyển thành Paid', async () => {
  const { admin, withdrawalId, walletId } = await prepare()

  const failed = await recordSimulatedPayoutResult(
    admin,
    withdrawalId,
    input('Failed', 'Giả lập lỗi chuyển khoản'),
  )

  expect(failed.status).toBe('pending')

  const paid = await recordSimulatedPayoutResult(admin, withdrawalId, input('Paid'))

  expect(paid.status).toBe('paid')

  expect(await PayoutResultEntry.countDocuments({ result: 'Failed' })).toBe(1)

  expect(await PayoutResultEntry.countDocuments({ result: 'Paid' })).toBe(1)

  await expectWalletUnchanged(walletId)
})

it('gửi lại cùng mã trả kết quả cũ; không cho trả thành công lần hai', async () => {
  const { admin, withdrawalId, walletId } = await prepare()
  const body = input('Paid')

  const first = await recordSimulatedPayoutResult(admin, withdrawalId, body)

  const replay = await recordSimulatedPayoutResult(admin, withdrawalId, body)

  expect(replay.reused).toBe(true)
  expect(replay.resultEntryId).toBe(first.resultEntryId)

  await expect(recordSimulatedPayoutResult(admin, withdrawalId, input('Paid'))).rejects.toThrow(
    'Khoản chi đã được thanh toán.',
  )

  expect(await PayoutResultEntry.countDocuments()).toBe(1)

  expect(
    await AuditEvent.countDocuments({
      action: 'monthly-payout.result-recorded',
    }),
  ).toBe(1)

  await expectWalletUnchanged(walletId)
})

it('không được dùng lại mã thao tác với kết quả khác', async () => {
  const { admin, withdrawalId } = await prepare()
  const body = input('Failed')

  await recordSimulatedPayoutResult(admin, withdrawalId, body)

  await expect(
    recordSimulatedPayoutResult(admin, withdrawalId, {
      ...body,
      result: 'Paid',
    }),
  ).rejects.toThrow('Mã thao tác đã được dùng cho kết quả khác.')

  expect((await WithdrawalRequest.findById(withdrawalId)).status).toBe('pending')

  expect(await PayoutResultEntry.countDocuments()).toBe(1)
})

it('lỗi ghi audit thì rollback trạng thái và bản ghi kết quả', async () => {
  const { admin, withdrawalId, walletId } = await prepare()

  const auditSpy = vi
    .spyOn(AuditEvent, 'create')
    .mockRejectedValueOnce(new Error('Giả lập lỗi audit'))

  try {
    await expect(recordSimulatedPayoutResult(admin, withdrawalId, input('Paid'))).rejects.toThrow(
      'Giả lập lỗi audit',
    )
  } finally {
    auditSpy.mockRestore()
  }

  expect((await WithdrawalRequest.findById(withdrawalId)).status).toBe('pending')

  expect(await PayoutResultEntry.countDocuments()).toBe(0)

  await expectWalletUnchanged(walletId)
})

it('tài khoản không có quyền admin không được ghi kết quả', async () => {
  const { withdrawalId } = await prepare()
  const { account: reader } = await authenticatedAccount()

  await expect(recordSimulatedPayoutResult(reader, withdrawalId, input('Paid'))).rejects.toThrow(
    'Quyền quản trị không còn hiệu lực.',
  )

  expect(await PayoutResultEntry.countDocuments()).toBe(0)

  expect((await WithdrawalRequest.findById(withdrawalId)).status).toBe('pending')
})
