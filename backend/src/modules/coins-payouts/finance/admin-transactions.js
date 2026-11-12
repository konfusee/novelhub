import {
  Account,
  AuditEvent,
  BankTransaction,
  LedgerEntry,
  Wallet,
  UnlockRequest,
  TopUpOrder,
} from '../../../models/index.js'
import { notify } from '../../accounts-administration/service.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { requireCurrentAdmin } from './admin-guard.js'

const PAGE_SIZE = 20
const unresolved = ['unmatched', 'amount-mismatch', 'expired', 'already-paid']

export async function financialStatistics({ from, to }) {
  const range = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lt: new Date(to) } : {}) }
  return withTransaction(async session => {
    const registeredAccounts = await Account.countDocuments(
      from || to ? { createdAt: range } : {},
    ).session(session)
    const purchases = await UnlockRequest.aggregate([
      { $match: { status: 'committed', ...(from || to ? { createdAt: range } : {}) } },
      { $group: { _id: null, count: { $sum: 1 }, coins: { $sum: '$effectivePriceCoins' } } },
    ]).session(session)
    const unresolvedPayments = await BankTransaction.countDocuments({
      matchStatus: { $in: unresolved },
      ...(from || to ? { receivedAt: range } : {}),
    }).session(session)
    return {
      registeredAccounts,
      purchasedChapters: purchases[0]?.count ?? 0,
      unlockCoins: purchases[0]?.coins ?? 0,
      unresolvedPayments,
    }
  })
}

export async function listFinancialTransactions({ source, status, search, from, to, page }) {
  const bank = source === 'bank'
  const filter = {}
  if (status && bank) filter.matchStatus = status
  const dateField = bank ? 'receivedAt' : 'occurredAt'
  if (from || to)
    filter[dateField] = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lt: new Date(to) } : {}),
    }
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = (
      bank
        ? ['sePayTransactionId', 'content', 'extractedPaymentCode']
        : ['reason', 'sourceType', 'ledgerType']
    ).map(field => ({ [field]: { $regex: literal, $options: 'i' } }))
  }
  const model = bank ? BankTransaction : LedgerEntry
  const rows = await model
    .find(filter)
    .sort({ [dateField]: -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean()
  const wallets = bank
    ? []
    : await Wallet.find({ _id: { $in: rows.map(row => row.walletId) } })
        .select('ownerId purpose')
        .lean()
  const owners = await Account.find({
    _id: { $in: wallets.map(wallet => wallet.ownerId).filter(Boolean) },
  })
    .select('displayName')
    .lean()
  const byOwner = new Map(owners.map(owner => [String(owner._id), owner.displayName]))
  const byWallet = new Map(wallets.map(wallet => [String(wallet._id), wallet]))
  return {
    page,
    hasMore: rows.length > PAGE_SIZE,
    items: rows.slice(0, PAGE_SIZE).map(row =>
      bank
        ? {
            id: String(row._id),
            version: row.version,
            reference: row.sePayTransactionId,
            amount: row.amountVnd,
            content: row.content,
            paymentCode: row.extractedPaymentCode ?? null,
            status: row.matchStatus,
            originalStatus: row.originalMatchStatus,
            occurredAt: row.receivedAt,
            canResolve: unresolved.includes(row.matchStatus) && row.apiKeyAuthenticated,
            resolutionReason: row.resolutionReason ?? null,
          }
        : {
            id: String(row._id),
            walletId: String(row.walletId),
            owner: byOwner.get(String(byWallet.get(String(row.walletId))?.ownerId)) ?? '',
            purpose: byWallet.get(String(row.walletId))?.purpose ?? '',
            type: row.ledgerType,
            direction: row.direction,
            amount: row.amount,
            reason: row.reason ?? '',
            sourceType: row.sourceType,
            sourceId: String(row.sourceId),
            occurredAt: row.occurredAt,
          },
    ),
  }
}

export async function findReaderWallets(search) {
  const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const accounts = await Account.find({
    status: 'active',
    $or: [
      { email: { $regex: literal, $options: 'i' } },
      { displayName: { $regex: literal, $options: 'i' } },
    ],
  })
    .select('displayName email')
    .limit(20)
    .lean()
  const wallets = await Wallet.find({
    ownerType: 'account',
    ownerId: { $in: accounts.map(a => a._id) },
    purpose: 'reader-coins',
    unit: 'coin',
  }).lean()
  const byId = new Map(accounts.map(account => [String(account._id), account]))
  return {
    items: wallets.map(wallet => ({
      walletId: String(wallet._id),
      displayName: byId.get(String(wallet.ownerId)).displayName,
      email: byId.get(String(wallet.ownerId)).email,
    })),
  }
}

export async function getBankTransactionDetails(bankId) {
  return withTransaction(async session => {
    const bank = await BankTransaction.findById(bankId).session(session).lean()
    if (!bank) throw new HttpError(404, 'transaction_not_found', 'Không tìm thấy giao dịch.')
    const order = bank.matchedOrderId
      ? await TopUpOrder.findById(bank.matchedOrderId)
          .select('accountId paymentCode status coinAmount packageSnapshot expiresAt')
          .session(session)
          .lean()
      : null
    const reader = order
      ? await Account.findById(order.accountId).select('displayName email').session(session).lean()
      : null
    const adjustment = bank.adjustmentId
      ? await LedgerEntry.findById(bank.adjustmentId).session(session).lean()
      : null
    return {
      id: String(bank._id),
      version: bank.version,
      reference: bank.sePayTransactionId,
      amount: bank.amountVnd,
      content: bank.content ?? '',
      paymentCode: bank.extractedPaymentCode ?? null,
      originalStatus: bank.originalMatchStatus,
      status: bank.matchStatus,
      occurredAt: bank.receivedAt,
      authenticated: bank.apiKeyAuthenticated,
      canResolve: unresolved.includes(bank.matchStatus) && bank.apiKeyAuthenticated,
      resolutionReason: bank.resolutionReason ?? null,
      resolvedAt: bank.resolvedAt ?? null,
      order: order
        ? {
            id: String(order._id),
            paymentCode: order.paymentCode,
            status: order.status,
            priceVnd: order.packageSnapshot.priceVnd,
            coinAmount: order.coinAmount,
            expiresAt: order.expiresAt,
          }
        : null,
      reader: reader
        ? { id: String(reader._id), displayName: reader.displayName, email: reader.email }
        : null,
      adjustment: adjustment
        ? {
            id: String(adjustment._id),
            walletId: String(adjustment.walletId),
            amountCoins: adjustment.amount,
          }
        : null,
    }
  })
}

// A manual adjustment credits exactly the received VND amount (1 VND = 1 coin).
// It does not rewrite bank evidence or pretend a mismatched order was paid.
export async function resolveBankTransaction(admin, bankId, input, now = new Date()) {
  return withTransaction(async session => {
    await requireCurrentAdmin(admin, session)
    const bank = await BankTransaction.findById(bankId).session(session)
    if (!bank) throw new HttpError(404, 'transaction_not_found', 'Không tìm thấy giao dịch.')
    const reason = input.reason?.trim()
    if (!reason || reason.length > 1000)
      throw new HttpError(400, 'validation_error', 'Cần nhập lý do đối soát.')
    if (bank.matchStatus === 'resolved') {
      const entry = bank.adjustmentId
        ? await LedgerEntry.findById(bank.adjustmentId).session(session).lean()
        : null
      if (
        bank.resolutionReason !== reason ||
        String(entry?.walletId ?? '') !== (input.walletId ?? '')
      )
        throw new HttpError(
          409,
          'resolution_conflict',
          'Giao dịch đã được xử lý bằng thông tin khác.',
        )
      return { reused: true, adjustmentId: bank.adjustmentId ?? null }
    }
    if (!unresolved.includes(bank.matchStatus) || !bank.apiKeyAuthenticated)
      throw new HttpError(
        409,
        'transaction_not_resolvable',
        'Giao dịch không thể đối soát thủ công.',
      )
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)
      throw new HttpError(400, 'validation_error', 'Cần phiên bản giao dịch hợp lệ.')
    const locked = await BankTransaction.updateOne(
      { _id: bankId, version: input.expectedVersion, matchStatus: bank.matchStatus },
      { $inc: { version: 1 } },
      { session },
    )
    if (locked.matchedCount !== 1)
      throw new HttpError(409, 'transaction_changed', 'Giao dịch đã thay đổi. Vui lòng tải lại.')
    bank.version = input.expectedVersion + 1
    let adjustmentId
    if (input.walletId) {
      if (!Number.isSafeInteger(bank.amountVnd) || bank.amountVnd <= 0)
        throw new HttpError(409, 'invalid_amount', 'Số tiền nhận không hợp lệ.')
      const wallet = await Wallet.findOne({
        _id: input.walletId,
        ownerType: 'account',
        purpose: 'reader-coins',
        unit: 'coin',
      }).session(session)
      const owner =
        wallet &&
        (await Account.findOneAndUpdate(
          { _id: wallet.ownerId, status: 'active' },
          { $inc: { version: 1 } },
          { session },
        ))
      if (!wallet || !owner)
        throw new HttpError(409, 'invalid_reader_wallet', 'Ví nhận xu không còn hợp lệ.')
      const updated = await Wallet.updateOne(
        {
          _id: wallet._id,
          balanceVersion: wallet.balanceVersion,
          availableBalance: { $gte: 0, $lte: Number.MAX_SAFE_INTEGER - bank.amountVnd },
        },
        { $inc: { availableBalance: bank.amountVnd, balanceVersion: 1, version: 1 } },
        { session },
      )
      if (updated.matchedCount !== 1)
        throw new HttpError(409, 'wallet_changed', 'Ví đã thay đổi. Vui lòng thử lại.')
      const [entry] = await LedgerEntry.create(
        [
          {
            walletId: wallet._id,
            ledgerType: 'adjustment',
            direction: 'credit',
            amount: bank.amountVnd,
            reason,
            actorAccountId: admin._id,
            sourceType: 'BankTransaction',
            sourceId: bank._id,
            idempotencyScope: {
              operation: 'bank-resolution',
              ownerId: wallet.ownerId,
              key: String(bank._id),
            },
            occurredAt: now,
          },
        ],
        { session },
      )
      adjustmentId = entry._id
      await notify(
        {
          recipientAccountId: wallet.ownerId,
          sourceEventKey: `bank-resolution:${bank._id}`,
          eventType: 'wallet.reconciliation-credited',
          payload: {
            amountCoins: bank.amountVnd,
            reference: bank.sePayTransactionId,
            body: `Ví của bạn đã được cộng ${bank.amountVnd.toLocaleString('vi-VN')} xu sau khi đối soát giao dịch ${bank.sePayTransactionId}.`,
          },
        },
        { session },
      )
    }
    bank.matchStatus = 'resolved'
    bank.resolvedBy = admin._id
    bank.resolvedAt = now
    bank.resolutionReason = reason
    bank.adjustmentId = adjustmentId
    await bank.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'bank-transaction.resolved',
          targetType: 'BankTransaction',
          targetId: bank._id,
          targetVersion: bank.version,
          result: adjustmentId ? 'credited' : 'closed-without-credit',
          reason,
          occurredAt: now,
        },
      ],
      { session },
    )
    return { reused: false, adjustmentId: adjustmentId ?? null }
  })
}
