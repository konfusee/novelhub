import {
  Account,
  Notification,
  NotificationOutbox,
  PolicyVersion,
  RoleAssignment,
  Wallet,
} from '../models/index.js'
import { withTransaction } from '../db/connection.js'
import { HttpError } from '../middleware/errors.js'
import { createMonthlyPayoutRecords } from './monthly-payout-records.js'
import { buildMonthlyPayoutPreview } from './admin-payout-preview.js'

function validatePayoutPeriod(periodId, now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const date = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]),
  )

  const currentPeriod = `${date.year}-${date.month}`

  const lastDay = new Date(Date.UTC(Number(date.year), Number(date.month), 0)).getUTCDate()

  if (periodId !== currentPeriod || Number(date.day) !== lastDay) {
    throw new HttpError(
      409,
      'payout_period_not_due',
      'Chỉ được lập chi trả cho tháng hiện tại vào ngày cuối tháng.',
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

export async function generateMonthlyPayouts(
  admin,
  periodId,
  now = new Date(),
  expectedPreviewHash,
) {
  validatePayoutPeriod(periodId, now)

  return withTransaction(async session => {
    const actor = await Account.findOneAndUpdate(
      {
        _id: admin._id,
        status: 'active',
        credentialVersion: admin.credentialVersion,
        authorizationEpoch: admin.authorizationEpoch,
      },
      { $inc: { version: 1 } },
      { session },
    )

    const adminRole = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)

    if (!actor || !adminRole) {
      throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.')
    }

    // API sẽ luôn truyền expectedPreviewHash.
    // Các test nghiệp vụ gọi trực tiếp hàm cũ vẫn có thể không truyền.
    if (expectedPreviewHash !== undefined) {
      const currentPreview = await buildMonthlyPayoutPreview(periodId, session, now)

      if (currentPreview.previewHash !== expectedPreviewHash) {
        throw new HttpError(
          409,
          'payout_preview_changed',
          'Danh sách dự kiến đã thay đổi. Vui lòng tải lại trước khi xác nhận.',
        )
      }

      if (currentPreview.eligibleCount === 0) {
        throw new HttpError(
          409,
          'payout_preview_empty',
          'Không có tác giả đủ điều kiện để lập chi trả.',
        )
      }
    }

    const policy = await PolicyVersion.findOne({
      status: 'effective',
      effectiveAt: { $lte: now },
    })
      .sort({ effectiveAt: -1, _id: -1 })
      .session(session)
      .lean()

    if (!policy) {
      throw new HttpError(409, 'policy_required', 'Chưa có chính sách chi trả có hiệu lực.')
    }

    const authorRoles = await RoleAssignment.find({
      role: 'author',
      status: 'active',
    })
      .select('accountId')
      .sort({ accountId: 1 })
      .session(session)
      .lean()

    const results = []

    for (const role of authorRoles) {
      const account = await Account.findOneAndUpdate(
        {
          _id: role.accountId,
          status: 'active',
        },
        { $inc: { version: 1 } },
        { session, returnDocument: 'after' },
      ).select('+bankDetails')

      if (!account) {
        results.push({
          accountId: String(role.accountId),
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

      const result = await createMonthlyPayoutRecords(
        {
          account,
          wallet,
          periodId,
          policy,
          actorAccountId: admin._id,
        },
        session,
        now,
      )

      if (result.state === 'created' || result.state === 'missing-bank-details') {
        await queuePayoutNotice(account._id, periodId, result, session, now)
      }

      results.push({
        accountId: String(account._id),
        displayName: account.displayName,
        ...result,
      })
    }

    return {
      periodId,
      totalAuthors: authorRoles.length,
      results,
    }
  })
}
