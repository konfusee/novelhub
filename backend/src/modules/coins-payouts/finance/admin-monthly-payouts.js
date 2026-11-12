import { requireCurrentAdmin } from './admin-guard.js'
import { currentPayoutPeriod, availableAtCutoff, payoutCutoff } from './payout-period.js'
import {
  Account,
  Notification,
  NotificationOutbox,
  PolicyVersion,
  Wallet,
  WithdrawalRequest,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { evaluatePayoutEligibility } from './payout-eligibility.js'
import { createMonthlyPayoutRecords } from './monthly-payout-records.js'

function validatePayoutPeriod(periodId, now) {
  if (periodId !== currentPayoutPeriod(now)) {
    throw new HttpError(
      409,
      'payout_period_not_due',
      'Chỉ được lập chi trả cho kỳ hiện tại, từ ngày 1 theo giờ Việt Nam.',
    )
  }
}

async function queuePayoutNotice(accountId, periodId, result, session, now) {
  const eventType =
    result.state === 'created' ? 'monthly-payout.created' : 'monthly-payout.bank-details-missing'

  const sourceEventKey = `${eventType}:${periodId}:${accountId}`

  const notification = await Notification.findOneAndUpdate(
    { recipientAccountId: accountId, sourceEventKey },
    {
      $setOnInsert: {
        recipientAccountId: accountId,
        sourceEventKey,
        eventType,
        deliveryState: 'available',
        payload: {
          executionMode: 'simulation',
          periodId,
          withdrawalId: result.withdrawalId ?? null,
          amountCoins: result.amountCoins ?? null,
        },
      },
    },
    { upsert: true, returnDocument: 'after', session },
  )

  for (const channel of ['in-app', 'email']) {
    await NotificationOutbox.updateOne(
      { sourceEventKey, channel },
      {
        $setOnInsert: {
          sourceEventKey,
          channel,
          notificationId: notification._id,
          status: 'pending',
          attemptCount: 0,
          nextAttemptAt: now,
        },
      },
      { upsert: true, session },
    )
  }
}

export async function generateMonthlyPayouts(admin, periodId, now = new Date()) {
  validatePayoutPeriod(periodId, now)

  return withTransaction(async session => {
    if (admin) await requireCurrentAdmin(admin, session)

    const policy = await PolicyVersion.findOne({
      status: { $in: ['effective', 'superseded'] },
      effectiveAt: { $lte: payoutCutoff(periodId) },
    })
      .sort({ effectiveAt: -1, _id: -1 })
      .session(session)
      .lean()

    if (!policy) {
      throw new HttpError(409, 'policy_required', 'Chưa có chính sách chi trả có hiệu lực.')
    }

    // Earnings remain payable after the author role is revoked.
    const authorWallets = await Wallet.find({
      ownerType: 'account',
      purpose: 'author-earnings',
      unit: 'coin',
    })
      .select('ownerId')
      .sort({ ownerId: 1 })
      .session(session)
      .lean()

    const results = []

    for (const role of authorWallets) {
      if (await WithdrawalRequest.exists({ accountId: role.ownerId, periodId }).session(session)) {
        results.push({ accountId: String(role.ownerId), state: 'existing' })
        continue
      }
      const account = await Account.findOne({ _id: role.ownerId, status: 'active' })
        .select('+bankDetails')
        .session(session)

      if (!account) {
        results.push({
          accountId: String(role.ownerId),
          state: 'skipped',
          reason: 'account-inactive',
        })
        continue
      }

      const wallet = await Wallet.findOne({
        ownerType: 'account',
        ownerId: account._id,
        purpose: 'author-earnings',
      }).session(session)

      const eligibleBalanceCoins = await availableAtCutoff(wallet, periodId, session)
      const eligibility = evaluatePayoutEligibility({
        account,
        wallet,
        policy,
        eligibleBalanceCoins,
      })
      if (eligibility.state === 'eligible') {
        const locked = await Account.updateOne(
          { _id: account._id, status: 'active', version: account.version },
          { $inc: { version: 1 } },
          { session },
        )
        if (locked.matchedCount !== 1)
          throw new HttpError(409, 'account_changed', 'Tài khoản đã thay đổi. Vui lòng thử lại.')
      }
      const result = await createMonthlyPayoutRecords(
        {
          account,
          wallet,
          periodId,
          policy,
          actorAccountId: admin?._id,
          eligibleBalanceCoins,
        },
        session,
        now,
      )

      if (result.state === 'created' || result.state === 'missing-bank-details') {
        await queuePayoutNotice(account._id, periodId, result, session, now)
      }
      if (result.state === 'created') {
        const bumped = await Account.updateOne(
          { _id: account._id, version: account.version },
          { $inc: { version: 1 } },
          { session },
        )
        if (bumped.modifiedCount !== 1)
          throw new HttpError(
            409,
            'account_changed',
            'Tài khoản đã thay đổi. Hãy tải lại và thử lại.',
          )
      }

      results.push({
        accountId: String(account._id),
        displayName: account.displayName,
        ...result,
      })
    }

    return {
      periodId,
      totalAuthors: authorWallets.length,
      results,
    }
  })
}
