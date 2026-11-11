import {
  Account,
  AuditEvent,
  LedgerEntry,
  Notification,
  NotificationOutbox,
  PayoutSheetRow,
  Wallet,
  WithdrawalRequest,
} from '../../models/index.js'
import { withTransaction } from '../../db/connection.js'

export async function ensureReaderWallet(accountId, session) {
  const existing = await Wallet.findOne({ ownerId: accountId, purpose: 'reader-coins' }).session(
    session,
  )
  if (existing) return existing
  const [wallet] = await Wallet.create(
    [{ ownerType: 'account', ownerId: accountId, purpose: 'reader-coins', availableBalance: 0 }],
    { session },
  )
  return wallet
}

/** Called before anonymization in the identity transaction. Preserve finance history. */
export async function prepareAccountDeletion({ account, actorAccountId, session, now }) {
  const reader = await Wallet.findOne({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'reader-coins',
  }).session(session)
  if (reader?.availableBalance > 0) {
    const amount = reader.availableBalance
    reader.availableBalance = 0
    reader.balanceVersion++
    await reader.save({ session })
    await LedgerEntry.create(
      [
        {
          walletId: reader._id,
          ledgerType: 'deletion-forfeiture',
          direction: 'debit',
          amount,
          actorAccountId,
          sourceType: 'Account',
          sourceId: account._id,
          idempotencyScope: {
            operation: 'account-deletion',
            ownerId: account._id,
            key: String(account._id),
          },
          occurredAt: now,
        },
      ],
      { session },
    )
  }
  const earnings = await Wallet.exists({
    ownerType: 'account',
    ownerId: account._id,
    purpose: 'author-earnings',
    availableBalance: { $gt: 0 },
  }).session(session)
  const pending = await WithdrawalRequest.exists({
    accountId: account._id,
    status: 'pending',
  }).session(session)
  if (earnings || pending) {
    account.retainedPayoutEmail = account.email
    account.finalPayoutBankDetailsSnapshot = account.bankDetails
    if (!earnings) account.finalPayoutEvaluatedAt = now
  } else {
    account.financiallyClosedAt = now
    account.finalPayoutEvaluatedAt = now
    account.retainedPayoutEmail = undefined
  }
}

/** On the first day, evaluate deletions before this month's Vietnam cutoff exactly once. */
export async function evaluateDeletedAccountPayouts(now = new Date()) {
  const local = new Date(+now + 7 * 3600_000)
  if (local.getUTCDate() !== 1) return
  const periodId = local.toISOString().slice(0, 7)
  const cutoff = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7 * 3600_000)
  const accounts = await Account.find({
    status: 'anonymized',
    closedAt: { $lt: cutoff },
    finalPayoutEvaluatedAt: { $exists: false },
  })
    .select('_id')
    .lean()
  for (const candidate of accounts)
    await withTransaction(async session => {
      const account = await Account.findOneAndUpdate(
        { _id: candidate._id, finalPayoutEvaluatedAt: { $exists: false } },
        { $inc: { version: 1 } },
        { session, returnDocument: 'after' },
      ).select('+finalPayoutBankDetailsSnapshot')
      if (!account) return
      const wallet = await Wallet.findOne({
        ownerType: 'account',
        ownerId: account._id,
        purpose: 'author-earnings',
      }).session(session)
      if (wallet?.availableBalance > 0) {
        const amount = wallet.availableBalance
        const bank = account.finalPayoutBankDetailsSnapshot?.toObject()
        const [withdrawal] = await WithdrawalRequest.create(
          [
            {
              accountId: account._id,
              earningsWalletId: wallet._id,
              origin: 'system-monthly',
              periodId,
              cutoffAt: cutoff,
              evaluatedAt: now,
              evaluatedBalanceCoins: amount,
              thresholdCoins: 0,
              amountCoins: amount,
              payoutSlipAmountVnd: amount,
              bankDetailsSnapshot: bank,
              status: 'pending',
              forcedByDeletion: true,
            },
          ],
          { session },
        )
        await PayoutSheetRow.create(
          [
            {
              withdrawalRequestId: withdrawal._id,
              periodId,
              amountCoins: amount,
              bankDetailsSnapshot: bank,
              bankDetailsMissing: !bank,
            },
          ],
          { session },
        )
        wallet.availableBalance = 0
        wallet.balanceVersion++
        await wallet.save({ session })
        await LedgerEntry.create(
          [
            {
              walletId: wallet._id,
              ledgerType: 'withdrawal-debit',
              direction: 'debit',
              amount,
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
              actorType: 'system',
              action: 'monthly-payout.created',
              targetType: 'WithdrawalRequest',
              targetId: withdrawal._id,
              targetVersion: withdrawal.version,
              result: 'committed',
              reason: 'account-deleted',
              occurredAt: now,
            },
          ],
          { session },
        )
        const sourceEventKey = `monthly-payout.created:${periodId}:${account._id}`
        const [notification] = await Notification.create(
          [
            {
              recipientAccountId: account._id,
              eventType: 'monthly-payout.created',
              sourceEventKey,
              deliveryState: 'available',
              payload: { periodId, withdrawalId: String(withdrawal._id), amountCoins: amount },
            },
          ],
          { session },
        )
        await NotificationOutbox.create(
          [
            {
              sourceEventKey,
              notificationId: notification._id,
              channel: 'email',
              status: 'pending',
              attemptCount: 0,
              nextAttemptAt: now,
            },
          ],
          { session },
        )
      }
      account.finalPayoutEvaluatedAt = now
      await account.save({ session })
    })
}
