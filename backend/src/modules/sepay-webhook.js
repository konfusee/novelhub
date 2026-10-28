import { z } from 'zod'
import { HttpError } from '../middleware/errors.js'
import { AuditEvent, LedgerEntry, TopUpOrder, Wallet, BankTransaction } from '../models/index.js'
import { withTransaction } from '../db/connection.js'

const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

const payloadSchema = z.object({
  id: positiveInteger,
  gateway: z.string().trim().min(1).max(100),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  accountNumber: z.string().trim().min(1).max(34),
  subAccount: z.string().max(100).nullish(),
  code: z.string().max(100).nullish(),
  content: z.string().min(1).max(10000),
  transferType: z.enum(['in', 'out']),
  transferAmount: positiveInteger,
})

export function parseSePayPayload(body) {
  const result = payloadSchema.safeParse(body)

  if (!result.success) {
    throw new HttpError(400, 'invalid_sepay_payload', 'Dữ liệu giao dịch SePay không hợp lệ.')
  }

  return result.data
}

export function extractPaymentCode(payload) {
  const text = `${payload.code ?? ''} ${payload.content}`

  const matches = text.match(/NH\d{8}(?!\d)/gi) ?? []
  const codes = [...new Set(matches.map(code => code.toUpperCase()))]

  return codes.length === 1 ? codes[0] : null
}

export function classifyTopUpOrder(order, amount, now = new Date()) {
  if (!order) return 'unmatched'

  if (order.status === 'paid') return 'already-paid'

  if (order.status === 'expired' || order.expiresAt.getTime() <= now.getTime()) {
    return 'expired'
  }

  if (order.status !== 'pending') return 'unmatched'

  if (amount !== order.packageSnapshot.priceVnd) {
    return 'amount-mismatch'
  }

  return 'matched'
}

export async function findTopUpMatch(payload, session, now = new Date()) {
  const paymentCode = extractPaymentCode(payload)

  const order = paymentCode ? await TopUpOrder.findOne({ paymentCode }).session(session) : null

  return {
    paymentCode,
    order,
    matchStatus: classifyTopUpOrder(order, payload.transferAmount, now),
  }
}

export async function creditTopUpOrder(order, bankTransaction, session, now = new Date()) {
  if (!session?.inTransaction()) {
    throw new Error('Cộng xu phải chạy trong transaction.')
  }

  if (classifyTopUpOrder(order, bankTransaction.amountVnd, now) !== 'matched') {
    throw new Error('Đơn chưa đủ điều kiện cộng xu.')
  }

  const coins = order.coinAmount

  if (!Number.isSafeInteger(coins) || coins <= 0 || coins !== order.packageSnapshot.priceVnd) {
    throw new Error('Số xu của đơn không hợp lệ.')
  }

  order.status = 'paid'
  order.paidAmountVnd = bankTransaction.amountVnd
  order.bankTransactionId = bankTransaction._id
  order.confirmedAt = now

  await order.save({ session })

  const updated = await Wallet.updateOne(
    {
      _id: order.walletId,
      ownerType: 'account',
      ownerId: order.accountId,
      purpose: 'reader-coins',
      unit: 'coin',
      availableBalance: {
        $gte: 0,
        $lte: Number.MAX_SAFE_INTEGER - coins,
      },
    },
    {
      $inc: {
        availableBalance: coins,
        balanceVersion: 1,
        version: 1,
      },
    },
    { session },
  )

  if (updated.matchedCount !== 1) {
    throw new Error('Không thể cập nhật ví nhận xu.')
  }

  await LedgerEntry.create(
    [
      {
        walletId: order.walletId,
        ledgerType: 'topup-credit',
        direction: 'credit',
        amount: coins,
        sourceType: 'TopUpOrder',
        sourceId: order._id,
        idempotencyScope: {
          operation: 'topup-credit',
          ownerId: order.accountId,
          key: String(order._id),
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
        action: 'topup.payment.confirmed',
        targetType: 'TopUpOrder',
        targetId: order._id,
        targetVersion: order.version,
        result: 'paid',
        occurredAt: now,
      },
    ],
    { session },
  )
}

export async function processSePayWebhook(payload, config) {
  if (payload.transferType !== 'in') {
    return { ignored: true }
  }

  const bank = config.topUpBank

  if (!bank?.accountNumber || !bank.name) {
    throw new HttpError(503, 'payment_not_configured', 'Chưa cấu hình tài khoản nhận tiền.')
  }

  const correctBank = payload.gateway.trim().toLowerCase() === bank.name.trim().toLowerCase()

  const correctAccount = payload.accountNumber === bank.accountNumber

  if (!correctBank || !correctAccount) {
    throw new HttpError(
      400,
      'unexpected_bank_account',
      'Giao dịch không thuộc tài khoản nhận tiền đã cấu hình.',
    )
  }

  const sePayTransactionId = String(payload.id)

  try {
    return await withTransaction(async session => {
      const existing = await BankTransaction.findOne({
        sePayTransactionId,
      }).session(session)

      if (existing) {
        return { duplicate: true }
      }

      const now = new Date()
      const match = await findTopUpMatch(payload, session, now)

      const [bankTransaction] = await BankTransaction.create(
        [
          {
            sePayTransactionId,
            amountVnd: payload.transferAmount,
            content: payload.content,
            extractedPaymentCode: match.paymentCode ?? undefined,
            matchStatus: match.matchStatus,
            originalMatchStatus: match.matchStatus,
            matchedOrderId: match.order?._id,
            receivedAt: now,
            apiKeyAuthenticated: true,
          },
        ],
        { session },
      )

      if (match.matchStatus === 'matched') {
        await creditTopUpOrder(match.order, bankTransaction, session, now)
      }

      await AuditEvent.create(
        [
          {
            actorType: 'system',
            action: 'topup.webhook.recorded',
            targetType: 'BankTransaction',
            targetId: bankTransaction._id,
            result: match.matchStatus,
            occurredAt: now,
          },
        ],
        { session },
      )

      return { matchStatus: match.matchStatus }
    })
  } catch (error) {
    const duplicateTransaction = error.code === 11000 && error.keyPattern?.sePayTransactionId

    if (duplicateTransaction) {
      const existing = await BankTransaction.findOne({
        sePayTransactionId,
      }).lean()

      if (existing) {
        return { duplicate: true }
      }
    }

    throw error
  }
}
