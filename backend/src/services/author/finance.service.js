import { withTransaction } from '../../db/connection.js'
import {
  Account,
  LedgerEntry,
  PayoutResultEntry,
  Wallet,
  WithdrawalRequest,
} from '../../models/index.js'
import { HttpError } from '../../middleware/errors.js'

const LEDGER_LABELS = new Set([
  'allocation-credit',
  'withdrawal-debit',
  'adjustment',
  'reversal',
  'deletion-forfeiture',
])

function id(value) {
  return value == null ? null : String(value)
}

function signedAmount(entry) {
  return entry.direction === 'debit' ? -entry.amount : entry.amount
}

function serializeLedger(entry) {
  return {
    id: id(entry._id),
    type: entry.ledgerType,
    amount: signedAmount(entry),
    sourceType: entry.sourceType,
    sourceId: id(entry.sourceId),
    reason: entry.reason ?? null,
    occurredAt: entry.occurredAt,
  }
}

function serializePayout(withdrawal, result) {
  return {
    id: id(withdrawal._id),
    periodId: withdrawal.periodId,
    amountCoins: withdrawal.amountCoins,
    payoutSlipAmountVnd: withdrawal.payoutSlipAmountVnd,
    status: withdrawal.status,
    evaluatedAt: withdrawal.evaluatedAt,
    result: result?.result ?? null,
    resultNote: result?.note ?? null,
    resultAt: result?.occurredAt ?? null,
    processingDate: result?.occurredAt ?? null,
  }
}

export async function authorFinance(accountId) {
  const [account, wallet] = await Promise.all([
    Account.findById(accountId).select('+bankDetails').lean(),
    Wallet.findOne({
      ownerType: 'account',
      ownerId: accountId,
      purpose: 'author-earnings',
      unit: 'coin',
    })
      .select('availableBalance')
      .lean(),
  ])
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản tác giả.')

  const [ledgerEntries, withdrawals] = await Promise.all([
    wallet
      ? LedgerEntry.find({ walletId: wallet._id, ledgerType: { $in: [...LEDGER_LABELS] } })
          .select('ledgerType direction amount sourceType sourceId reason occurredAt')
          .sort({ occurredAt: -1, _id: -1 })
          .limit(51)
          .lean()
      : [],
    WithdrawalRequest.find({ accountId })
      .select('periodId amountCoins payoutSlipAmountVnd status evaluatedAt')
      .sort({ periodId: -1, _id: -1 })
      .limit(50)
      .lean(),
  ])
  const payoutIds = withdrawals.map(item => item._id)
  const results = payoutIds.length
    ? await PayoutResultEntry.find({ withdrawalRequestId: { $in: payoutIds } })
        .select('withdrawalRequestId result note occurredAt')
        .sort({ occurredAt: -1, _id: -1 })
        .lean()
    : []
  const latestResult = new Map()
  for (const result of results) {
    const key = id(result.withdrawalRequestId)
    if (!latestResult.has(key)) latestResult.set(key, result)
  }
  return {
    balance: wallet?.availableBalance ?? 0,
    entries: ledgerEntries.slice(0, 50).map(serializeLedger),
    hasMoreEntries: ledgerEntries.length > 50,
    paymentDetails: account.bankDetails
      ? {
          bankName: account.bankDetails.bankName,
          accountNumber: account.bankDetails.accountNumber,
          accountHolder: account.bankDetails.accountHolder,
        }
      : null,
    payouts: withdrawals.map(item => serializePayout(item, latestResult.get(id(item._id)))),
  }
}

export async function updateAuthorPaymentDetails(accountId, input) {
  return withTransaction(async session => {
    const account = await Account.findById(accountId).select('+bankDetails').session(session)
    if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản tác giả.')
    account.bankDetails = input
    account.increment()
    await account.save({ session })
    return {
      paymentDetails: {
        bankName: account.bankDetails.bankName,
        accountNumber: account.bankDetails.accountNumber,
        accountHolder: account.bankDetails.accountHolder,
      },
    }
  })
}
