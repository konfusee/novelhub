import { queryPublishedStories } from '../../reading-community/catalog/catalog-query.js'
import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  Chapter,
  ContentRevision,
  Story,
  UnlockEntitlement,
  UnlockRequest,
  Wallet,
} from '../../../models/index.js'
import { ownerWrite } from '../../reading-community/reading/owner-write.js'
import { readRichChapter } from '../../authoring-publishing/content/rich-chapter-document.js'
import { getUnlockRevenueSplit } from './unlock-revenue.js'
import { executePaidUnlock } from './unlock-purchase.js'

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

async function lockUnlockTarget(storyId, chapterId, session) {
  const story = await Story.findOneAndUpdate(
    {
      _id: storyId,
      publicationStatus: 'published',
      publishedRevisionId: { $ne: null },
    },
    { $inc: { version: 1 } },
    { session, returnDocument: 'after' },
  )

  if (!story) {
    throw new HttpError(404, 'chapter_not_found', 'Không tìm thấy chương.')
  }

  const author = await Account.findOneAndUpdate(
    { _id: story.authorAccountId, status: 'active' },
    { $inc: { version: 1 } },
    { session },
  )

  if (!author) {
    throw new HttpError(409, 'author_unavailable', 'Truyện hiện không thể phát sinh giao dịch mới.')
  }

  const chapter = await Chapter.findOneAndUpdate(
    {
      _id: chapterId,
      storyId: story._id,
      status: 'published',
      publishedRevisionId: { $ne: null },
    },
    { $inc: { version: 1 } },
    { session, returnDocument: 'after' },
  )

  if (!chapter) {
    throw new HttpError(404, 'chapter_not_found', 'Không tìm thấy chương.')
  }

  const storyRevision = await ContentRevision.exists({
    _id: story.publishedRevisionId,
    storyId: story._id,
    authorAccountId: story.authorAccountId,
    contentType: 'story',
    status: { $in: ['approved', 'immutable'] },
    'content.title': { $type: 'string', $ne: '' },
  }).session(session)

  const chapterRevision = await ContentRevision.findOne({
    _id: chapter.publishedRevisionId,
    storyId: story._id,
    chapterId: chapter._id,
    authorAccountId: story.authorAccountId,
    contentType: 'chapter',
    status: { $in: ['approved', 'immutable'] },
  })
    .select('content formatVersion mediaIds')
    .session(session)
    .lean()

  if (!storyRevision || !chapterRevision) {
    throw new HttpError(404, 'chapter_not_found', 'Bản xuất bản chưa sẵn sàng.')
  }

  readRichChapter(chapterRevision)

  return { story, chapter }
}

export async function purchaseReaderChapter(req, storyId, chapterId, input) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ownerWrite(req, async (session, account) => {
        const { story, chapter } = await lockUnlockTarget(storyId, chapterId, session)

        const previous = await UnlockRequest.findOne({
          'idempotencyScope.operation': 'chapter-unlock',
          'idempotencyScope.ownerId': account._id,
          'idempotencyScope.key': input.requestKey,
        })
          .session(session)
          .lean()

        if (
          previous &&
          (String(previous.chapterId) !== chapterId.toLowerCase() ||
            previous.requestedPriceCoins !== input.expectedPriceCoins ||
            previous.policySnapshot?.revisionId !== input.expectedRevisionId.toLowerCase())
        ) {
          throw new HttpError(
            409,
            'unlock_request_conflict',
            'Mã yêu cầu đã được dùng cho thông tin mua khác.',
          )
        }

        const now = new Date()
        const terms = chapter.earlyAccess

        if (terms?.enabled && !terms.endsAt) {
          throw new HttpError(409, 'chapter_unavailable', 'Thời hạn đọc sớm chưa hợp lệ.')
        }

        if (!terms?.enabled || terms.endsAt <= now) {
          return { state: 'free', reused: true, priceCoins: 0 }
        }

        if (previous && previous.status !== 'committed') {
          throw new HttpError(
            409,
            'unlock_request_unavailable',
            'Yêu cầu mua cần được kiểm tra lại.',
          )
        }

        const entitlement = await UnlockEntitlement.findOne({
          accountId: account._id,
          chapterId: chapter._id,
        })
          .session(session)
          .lean()

        if (entitlement) {
          const valid =
            entitlement.status === 'active' &&
            entitlement.expiresAt > now &&
            String(entitlement.publishedRevisionId) === String(chapter.publishedRevisionId)

          if (!valid) {
            throw new HttpError(
              409,
              'unlock_entitlement_unavailable',
              'Quyền đọc hiện có cần được kiểm tra lại.',
            )
          }

          return {
            state: 'owned',
            reused: true,
            entitlementId: String(entitlement._id),
            priceCoins: 0,
          }
        }

        if (previous) {
          throw new HttpError(
            409,
            'unlock_record_inconsistent',
            'Bản ghi mua cần được kiểm tra lại.',
          )
        }

        if (
          input.expectedPriceCoins !== terms.coinPrice ||
          input.expectedRevisionId.toLowerCase() !== String(chapter.publishedRevisionId)
        ) {
          throw new HttpError(
            409,
            'unlock_quote_changed',
            'Giá hoặc bản xuất bản đã thay đổi. Vui lòng kiểm tra lại.',
          )
        }

        const split = await getUnlockRevenueSplit(
          story.authorAccountId,
          terms.coinPrice,
          session,
          now,
        )

        const result = await executePaidUnlock(
          {
            accountId: account._id,
            authorId: story.authorAccountId,
            chapter,
            priceCoins: terms.coinPrice,
            split,
            requestKey: input.requestKey,
          },
          session,
          now,
        )

        return { ...result, state: 'owned', reused: false }
      })
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error
    }
  }
}
