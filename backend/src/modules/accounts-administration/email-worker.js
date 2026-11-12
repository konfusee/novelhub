import { randomUUID } from 'node:crypto'
import {
  Account,
  DeliveryAttempt,
  Notification,
  NotificationOutbox,
  WithdrawalRequest,
  Wallet,
} from '../../models/index.js'
import { withTransaction } from '../../db/connection.js'
import { createDevelopmentEmailDelivery, unavailableEmailDelivery } from '../../email/delivery.js'

const subjects = {
  'google.linked': 'Đã liên kết tài khoản Google',
  'publication.decided': 'Kết quả kiểm duyệt tác phẩm',
  'author-application.decided': 'Kết quả đăng ký tác giả',
  'monthly-payout.created': 'Khoản chi trả đã được lập',
  'monthly-payout.bank-details-missing': 'Cần bổ sung thông tin ngân hàng',
  'monthly-payout.Paid': 'Phiếu chi trả NovelHub',
  'monthly-payout.Failed': 'Chi trả chưa thành công',
}

function messageFor(notification, account) {
  const subject = subjects[notification.eventType] ?? 'Thông báo NovelHub'
  const payload = notification.payload ?? {}
  const details = [
    payload.title,
    payload.status,
    payload.outcome,
    payload.reason,
    payload.feedback,
    payload.periodId && `Kỳ: ${payload.periodId}`,
    payload.amountCoins != null &&
      `Số tiền: ${payload.amountCoins} xu${notification.eventType === 'monthly-payout.Paid' ? ` (${payload.amountCoins} VND)` : ''}`,
  ].filter(Boolean)
  return {
    to: account.email || account.retainedPayoutEmail,
    subject,
    text: [subject, ...details].join('\n\n'),
  }
}

/** One leased delivery. SMTP runs after claim commit; business outcomes never roll back. */
export async function deliverNextNotification(delivery, { now = new Date() } = {}) {
  const claimId = randomUUID()
  const claimed = await withTransaction(async session => {
    const row = await NotificationOutbox.findOneAndUpdate(
      {
        $or: [
          {
            status: 'pending',
            $or: [{ nextAttemptAt: { $lte: now } }, { nextAttemptAt: { $exists: false } }],
          },
          { status: 'claimed', leaseExpiresAt: { $lte: now } },
        ],
      },
      { $set: { status: 'claimed', claimId, leaseExpiresAt: new Date(+now + 300_000) } },
      { sort: { createdAt: 1, _id: 1 }, returnDocument: 'after', session },
    )
    if (!row) return null
    // An expired lease consumed an attempt; preserve its uncertain provider outcome.
    await DeliveryAttempt.updateMany(
      { outboxId: row._id, status: 'pending' },
      { $set: { status: 'failed', failureCode: 'lease_expired', resolvedAt: now } },
      { session },
    )
    if ((row.attemptCount ?? 0) >= 3) {
      row.status = 'failed'
      row.lastFailureCode = 'attempts_exhausted'
      await row.save({ session })
      return { exhausted: true }
    }
    row.attemptCount = (row.attemptCount ?? 0) + 1
    await row.save({ session })
    const [attempt] = await DeliveryAttempt.create(
      [
        {
          outboxId: row._id,
          notificationId: row.notificationId,
          attemptKey: `${row._id}:${row.attemptCount}`,
          channel: row.channel,
          status: 'pending',
          attemptNumber: row.attemptCount,
          attemptedAt: now,
        },
      ],
      { session },
    )
    return { row, attempt }
  })
  if (!claimed || claimed.exhausted) return Boolean(claimed)
  const { row, attempt } = claimed
  let result, failure
  try {
    const notification = await Notification.findById(row.notificationId).lean()
    if (!notification) throw new Error('notification_missing')
    if (row.channel === 'in-app') result = { provider: 'novelhub', accepted: true }
    else {
      const account = await Account.findById(notification.recipientAccountId)
        .select('+retainedPayoutEmail')
        .lean()
      if (!account || (!account.email && !account.retainedPayoutEmail))
        throw new Error('recipient_unavailable')
      result = await delivery.send({
        ...messageFor(notification, account),
        attempt: row.attemptCount,
      })
      if (!result?.accepted) throw new Error('provider_rejected')
    }
  } catch {
    failure = 'email_delivery_failed'
  }
  await withTransaction(async session => {
    const owned = await NotificationOutbox.findOne({
      _id: row._id,
      status: 'claimed',
      claimId,
    }).session(session)
    if (!owned) return
    const resolvedAt = new Date()
    const nextAttemptAt = new Date(+resolvedAt + 60_000 * 2 ** (row.attemptCount - 1))
    await DeliveryAttempt.updateOne(
      { _id: attempt._id, status: 'pending' },
      {
        $set: {
          status: failure ? 'failed' : 'accepted',
          resolvedAt,
          ...(failure
            ? { failureCode: failure, nextAttemptAt }
            : { provider: result.provider, messageReference: result.messageId }),
        },
      },
      { session },
    )
    owned.status = failure ? (row.attemptCount >= 3 ? 'failed' : 'pending') : 'delivered'
    owned.lastFailureCode = failure
    owned.nextAttemptAt = failure ? nextAttemptAt : undefined
    owned.claimId = undefined
    owned.leaseExpiresAt = undefined
    await owned.save({ session })
  })
  return true
}

/** Remove deletion-retained email only after finance and all queued emails finish. */
export async function closeSettledContacts() {
  const accounts = await Account.find({
    status: 'anonymized',
    financiallyClosedAt: { $exists: false },
    finalPayoutEvaluatedAt: { $exists: true },
  }).select('+retainedPayoutEmail')
  for (const account of accounts) {
    await withTransaction(async session => {
      const unsettled = await WithdrawalRequest.exists({
        accountId: account._id,
        status: 'pending',
      }).session(session)
      if (unsettled) return
      if (
        await Wallet.exists({
          ownerType: 'account',
          ownerId: account._id,
          purpose: 'author-earnings',
          availableBalance: { $gt: 0 },
        }).session(session)
      )
        return
      const ids = await Notification.find({ recipientAccountId: account._id })
        .distinct('_id')
        .session(session)
      const unsent = await NotificationOutbox.exists({
        notificationId: { $in: ids },
        channel: 'email',
        status: { $ne: 'delivered' },
      }).session(session)
      if (!unsent)
        await Account.updateOne(
          { _id: account._id, status: 'anonymized' },
          { $set: { financiallyClosedAt: new Date() }, $unset: { retainedPayoutEmail: 1 } },
          { session },
        )
    })
  }
}

export function startNotificationWorker(config) {
  const delivery =
    config.emailDelivery ??
    (config.nodeEnv === 'production'
      ? unavailableEmailDelivery()
      : createDevelopmentEmailDelivery({ logger: config.logger }))
  let stopped = false,
    active = null
  const tick = () => {
    if (stopped || active) return
    active = (async () => {
      for (let i = 0; i < 25 && !stopped; i++) if (!(await deliverNextNotification(delivery))) break
      await closeSettledContacts()
    })()
      .catch(error => config.logger?.error({ err: error }, 'notification worker failed'))
      .finally(() => {
        active = null
      })
  }
  const timer = setInterval(tick, 5000)
  timer.unref()
  tick()
  return async () => {
    stopped = true
    clearInterval(timer)
    await active
  }
}
