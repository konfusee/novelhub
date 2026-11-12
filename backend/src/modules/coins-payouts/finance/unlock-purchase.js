import {
  AuditEvent,
  LedgerEntry,
  RevenueAllocation,
  UnlockEntitlement,
  UnlockRequest,
} from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { transferUnlockCoins } from './unlock-wallets.js'

export async function executePaidUnlock(
  { accountId, authorId, chapter, priceCoins, split, requestKey },
  session,
  now = new Date(),
) {
  if (!session?.inTransaction()) {
    throw new Error('Mua quyền đọc phải chạy trong transaction.')
  }

  const terms = chapter.earlyAccess

  if (!terms?.enabled || !terms.endsAt || terms.endsAt <= now) {
    throw new HttpError(
      409,
      'chapter_not_paid',
      'Chương không còn trong thời gian mở khóa trả phí.',
    )
  }

  if (priceCoins !== terms.coinPrice) {
    throw new HttpError(
      409,
      'unlock_price_changed',
      'Giá mở khóa đã thay đổi. Vui lòng kiểm tra lại.',
    )
  }

  const policySnapshot = {
    ...split.policySnapshot,
    appliedAuthorPercent: split.authorPercent,
    appliedPlatformPercent: split.platformPercent,
  }

  const [unlockRequest] = await UnlockRequest.create(
    [
      {
        accountId,
        chapterId: chapter._id,
        requestedPriceCoins: priceCoins,
        effectivePriceCoins: priceCoins,
        idempotencyScope: {
          operation: 'chapter-unlock',
          ownerId: accountId,
          key: requestKey,
        },
        status: 'requested',
        policySnapshot: {
          ...policySnapshot,
          revisionId: String(chapter.publishedRevisionId),
          earlyAccessEndsAt: terms.endsAt,
        },
      },
    ],
    { session },
  )

  const wallets = await transferUnlockCoins(accountId, authorId, priceCoins, split, session)

  const [entitlement] = await UnlockEntitlement.create(
    [
      {
        accountId,
        storyId: chapter.storyId,
        chapterId: chapter._id,
        publishedRevisionId: chapter.publishedRevisionId,
        status: 'active',
        purchasedAt: now,
        expiresAt: terms.endsAt,
        priceCoins,
        pricePolicySnapshot: {
          priceCoins,
          policyVersionId: terms.policyVersionId ?? null,
        },
        accessPolicySnapshot: {
          revisionId: String(chapter.publishedRevisionId),
          earlyAccessEndsAt: terms.endsAt,
        },
      },
    ],
    { session },
  )

  const legs = [
    {
      wallet: wallets.readerWallet,
      ledgerType: 'unlock-debit',
      direction: 'debit',
      amount: priceCoins,
    },
    {
      wallet: wallets.authorWallet,
      ledgerType: 'allocation-credit',
      direction: 'credit',
      amount: split.authorCoins,
    },
    {
      wallet: wallets.platformWallet,
      ledgerType: 'allocation-credit',
      direction: 'credit',
      amount: split.platformCoins,
    },
  ].filter(leg => leg.amount > 0)

  const entries = await LedgerEntry.create(
    legs.map(leg => ({
      walletId: leg.wallet._id,
      ledgerType: leg.ledgerType,
      direction: leg.direction,
      amount: leg.amount,
      actorAccountId: accountId,
      sourceType: 'UnlockRequest',
      sourceId: unlockRequest._id,
      idempotencyScope: {
        operation: 'chapter-unlock',
        ownerId: leg.wallet.ownerId,
        key: String(unlockRequest._id),
      },
      occurredAt: now,
    })),
    { session, ordered: true },
  )

  await RevenueAllocation.create(
    [
      {
        unlockRequestId: unlockRequest._id,
        ledgerEntryIds: entries.map(entry => entry._id),
        beneficiaries: [wallets.authorWallet.ownerId, wallets.platformWallet.ownerId],
        amount: priceCoins,
        policySnapshot,
      },
    ],
    { session },
  )

  unlockRequest.status = 'committed'
  unlockRequest.entitlementId = entitlement._id
  await unlockRequest.save({ session })

  await AuditEvent.create(
    [
      {
        actorType: 'account',
        actorId: accountId,
        action: 'chapter.unlock.committed',
        targetType: 'UnlockRequest',
        targetId: unlockRequest._id,
        targetVersion: unlockRequest.version,
        result: 'committed',
        occurredAt: now,
      },
    ],
    { session },
  )

  return {
    entitlementId: String(entitlement._id),
    balance: wallets.readerWallet.availableBalance,
    priceCoins,
  }
}
