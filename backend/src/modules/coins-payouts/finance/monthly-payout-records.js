import { payoutCutoff } from './payout-period.js'
import {
  AuditEvent,
  LedgerEntry,
  PayoutSheetRow,
  Wallet,
  WithdrawalRequest,
} from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { evaluatePayoutEligibility } from './payout-eligibility.js'

export async function createMonthlyPayoutRecords(
  { account, wallet, periodId, policy, actorAccountId, eligibleBalanceCoins },
  session,
  now = new Date(),
) {
  if (!session?.inTransaction()) {
    throw new Error('Lập khoản chi phải chạy trong transaction.')
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodId)) {
    throw new HttpError(400, 'invalid_payout_period', 'Kỳ chi trả không hợp lệ.')
  }

  const previous = await WithdrawalRequest.findOne({
    accountId: account._id,
    periodId,
  })
    .session(session)
    .lean()

  if (previous) {
    return {
      state: 'existing',
      withdrawalId: String(previous._id),
      amountCoins: previous.amountCoins,
    }
  }

  const eligibility = evaluatePayoutEligibility({
    account,
    wallet,
    policy,
    eligibleBalanceCoins,
  })

  if (eligibility.state !== 'eligible') {
    return eligibility
  }

  const { amountCoins, thresholdCoins, bankDetailsSnapshot } = eligibility

  const [withdrawal] = await WithdrawalRequest.create(
    [
      {
        accountId: account._id,
        earningsWalletId: wallet._id,
        origin: 'system-monthly',
        executionMode: 'simulation',
        periodId,
        cutoffAt: payoutCutoff(periodId),
        evaluatedAt: now,
        evaluatedBalanceCoins: amountCoins,
        thresholdCoins,
        amountCoins,
        payoutSlipAmountVnd: amountCoins,
        bankDetailsSnapshot,
        status: 'pending',
        forcedByDeletion: false,
        policySnapshot: {
          id: String(policy._id),
          version: policy.version,
          withdrawalThresholdCoins: thresholdCoins,
        },
      },
    ],
    { session },
  )

  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      _id: wallet._id,
      ownerType: 'account',
      ownerId: account._id,
      purpose: 'author-earnings',
      unit: 'coin',
      availableBalance: wallet.availableBalance,
      balanceVersion: wallet.balanceVersion,
    },
    {
      $inc: {
        availableBalance: -amountCoins,
        balanceVersion: 1,
        version: 1,
      },
    },
    { session, returnDocument: 'after' },
  )

  if (!updatedWallet) {
    throw new HttpError(409, 'earnings_wallet_changed', 'Số dư đã thay đổi. Vui lòng xét lại.')
  }

  await PayoutSheetRow.create(
    [
      {
        withdrawalRequestId: withdrawal._id,
        periodId,
        bankDetailsSnapshot,
        bankDetailsMissing: false,
        amountCoins,
      },
    ],
    { session },
  )

  await LedgerEntry.create(
    [
      {
        walletId: wallet._id,
        ledgerType: 'withdrawal-debit',
        direction: 'debit',
        amount: amountCoins,
        actorAccountId,
        sourceType: 'WithdrawalRequest',
        sourceId: withdrawal._id,
        idempotencyScope: {
          operation: 'monthly-payout',
          ownerId: account._id,
          key: periodId,
        },
        occurredAt: now,
      },
    ],
    { session },
  )

  await AuditEvent.create(
    [
      {
        actorType: actorAccountId ? 'account' : 'system',
        actorId: actorAccountId,
        action: 'monthly-payout.created',
        targetType: 'WithdrawalRequest',
        targetId: withdrawal._id,
        targetVersion: withdrawal.version,
        result: 'committed',
        occurredAt: now,
      },
    ],
    { session },
  )

  return {
    state: 'created',
    withdrawalId: String(withdrawal._id),
    amountCoins,
    balance: updatedWallet.availableBalance,
  }
}
