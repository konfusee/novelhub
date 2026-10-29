import { Chapter, ContentRevision, UnlockEntitlement, Wallet } from '../models/index.js'
import { queryPublishedStories } from './catalog-query.js'
import { HttpError } from '../middleware/errors.js'

export async function getReaderUnlockQuote(accountId, storyId, chapterId) {
  const catalog = await queryPublishedStories({
    ids: [storyId],
    pageSize: 1,
  })

  const story = catalog.items[0]

  if (!story) {
    throw new HttpError(404, 'chapter_not_found', 'Không tìm thấy chương có thể truy cập.')
  }

  const chapter = await Chapter.findOne({
    _id: chapterId,
    storyId,
    status: 'published',
    publishedRevisionId: { $ne: null },
  }).lean()

  const revisionExists =
    chapter &&
    (await ContentRevision.exists({
      _id: chapter.publishedRevisionId,
      storyId,
      chapterId: chapter._id,
      authorAccountId: story.authorId,
      contentType: 'chapter',
      status: { $in: ['approved', 'immutable'] },
    }))

  if (!revisionExists) {
    throw new HttpError(404, 'chapter_not_found', 'Không tìm thấy chương có thể truy cập.')
  }

  const wallet = await Wallet.findOne({
    ownerType: 'account',
    ownerId: accountId,
    purpose: 'reader-coins',
  })
    .select('availableBalance')
    .lean()

  const base = {
    storyId,
    chapterId: String(chapter._id),
    revisionId: String(chapter.publishedRevisionId),
    balance: wallet?.availableBalance ?? 0,
    earlyAccessEndsAt: chapter.earlyAccess?.endsAt ?? null,
  }

  const now = new Date()
  const terms = chapter.earlyAccess

  if (!terms?.enabled || (terms.endsAt && terms.endsAt <= now)) {
    return {
      ...base,
      state: 'free',
      canRead: true,
      priceCoins: 0,
      canAfford: true,
    }
  }

  if (!terms.endsAt) {
    throw new HttpError(409, 'chapter_unavailable', 'Chương chưa có thời hạn đọc sớm hợp lệ.')
  }

  const entitlement = await UnlockEntitlement.findOne({
    accountId,
    storyId,
    chapterId: chapter._id,
  }).lean()

  if (entitlement) {
    const valid =
      entitlement.status === 'active' &&
      entitlement.expiresAt > now &&
      String(entitlement.publishedRevisionId) === base.revisionId

    if (!valid) {
      throw new HttpError(
        409,
        'unlock_entitlement_unavailable',
        'Quyền đọc hiện có cần được kiểm tra lại.',
      )
    }

    return {
      ...base,
      state: 'owned',
      canRead: true,
      priceCoins: 0,
      canAfford: true,
    }
  }

  const priceCoins = terms.coinPrice

  if (!Number.isSafeInteger(priceCoins) || priceCoins <= 0) {
    throw new HttpError(409, 'invalid_unlock_price', 'Giá mở khóa chương không hợp lệ.')
  }

  return {
    ...base,
    state: 'locked',
    canRead: false,
    priceCoins,
    canAfford: base.balance >= priceCoins,
  }
}
