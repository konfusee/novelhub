import {
  Account,
  AuditEvent,
  AuthorRevenueRate,
  Chapter,
  ContentRevision,
  LedgerEntry,
  PolicyVersion,
  RevenueAllocation,
  Story,
  UnlockEntitlement,
  UnlockRequest,
  Wallet,
} from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
// Reserved identity for the platform wallet; never use an Admin's personal wallet.
export const PLATFORM_WALLET_OWNER = '000000000000000000000001';
async function chapterState(storyId, chapterId, session, lock = false) {
  const filter = {
    _id: storyId,
    publicationStatus: 'published',
    publishedRevisionId: { $ne: null },
  };
  const story = lock
    ? await Story.findOneAndUpdate(filter, { $inc: { version: 1 } }, { session })
    : await Story.findOne(filter).session(session ?? null);
  if (!story) throw new HttpError(404, 'not_found', 'Truyện không còn công khai.');
  const author = lock
    ? await Account.findOneAndUpdate(
        { _id: story.authorAccountId, status: 'active' },
        { $inc: { version: 1 } },
        { session },
      )
    : await Account.findOne({ _id: story.authorAccountId, status: 'active' }).session(
        session ?? null,
      );
  const parent = await ContentRevision.findOne({
    _id: story.publishedRevisionId,
    storyId: story._id,
    authorAccountId: story.authorAccountId,
    contentType: 'story',
    status: { $in: ['approved', 'immutable'] },
  }).session(session ?? null);
  const chapterFilter = {
    _id: chapterId,
    storyId: story._id,
    status: 'published',
    publishedRevisionId: { $ne: null },
  };
  const chapter = lock
    ? await Chapter.findOneAndUpdate(chapterFilter, { $inc: { version: 1 } }, { session })
    : await Chapter.findOne(chapterFilter).session(session ?? null);
  const revision =
    chapter &&
    (await ContentRevision.findOne({
      _id: chapter.publishedRevisionId,
      chapterId: chapter._id,
      storyId: story._id,
      authorAccountId: story.authorAccountId,
      contentType: 'chapter',
      status: { $in: ['approved', 'immutable'] },
    }).session(session ?? null));
  if (!author || !parent || !chapter || !revision)
    throw new HttpError(404, 'not_found', 'Không tìm thấy phiên bản chương công khai hợp lệ.');
  return { story, chapter };
}
export async function prepareUnlock(account, storyId, chapterId) {
  const { chapter } = await chapterState(storyId, chapterId);
  const entitlement = await UnlockEntitlement.findOne({
    accountId: account._id,
    chapterId: chapter._id,
    publishedRevisionId: chapter.publishedRevisionId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).lean();
  const wallet = await Wallet.findOne({
    ownerId: account._id,
    ownerType: 'account',
    purpose: 'reader-coins',
  }).lean();
  const free =
    !chapter.earlyAccess?.enabled ||
    (chapter.earlyAccess.endsAt && chapter.earlyAccess.endsAt <= new Date());
  return {
    chapterId: String(chapter._id),
    publishedRevisionId: String(chapter.publishedRevisionId),
    priceCoins: free ? 0 : (chapter.earlyAccess?.coinPrice ?? null),
    endsAt: chapter.earlyAccess?.endsAt ?? null,
    free: !!free,
    entitled: !!entitlement,
    balance: wallet?.availableBalance ?? 0,
  };
}
async function changeBalance(wallet, amount, session) {
  if (
    !Number.isSafeInteger(wallet.availableBalance) ||
    wallet.availableBalance < 0 ||
    !Number.isSafeInteger(wallet.availableBalance + amount) ||
    wallet.availableBalance + amount < 0
  )
    throw new HttpError(409, 'insufficient_balance', 'Số dư không đủ hoặc không hợp lệ.');
  const result = await Wallet.updateOne(
    { _id: wallet._id, balanceVersion: wallet.balanceVersion },
    { $inc: { availableBalance: amount, balanceVersion: 1, version: 1 } },
    { session },
  );
  if (result.modifiedCount !== 1) throw new HttpError(409, 'wallet_changed', 'Số dư đã thay đổi.');
}
export async function unlockChapter(account, storyId, chapterId, input) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await withTransaction(async (session) => {
        const owner = await Account.findOneAndUpdate(
          {
            _id: account._id,
            status: 'active',
            credentialVersion: account.credentialVersion,
            authorizationEpoch: account.authorizationEpoch,
          },
          { $inc: { version: 1 } },
          { session },
        );
        if (!owner) throw new HttpError(403, 'forbidden', 'Tài khoản không còn hoạt động.');
        const previous = await UnlockRequest.findOne({
          'idempotencyScope.operation': 'chapter-unlock',
          'idempotencyScope.ownerId': account._id,
          'idempotencyScope.key': input.idempotencyKey,
        }).session(session);
        if (previous) {
          const entitlement = await UnlockEntitlement.findById(previous.entitlementId).session(
            session,
          );
          if (
            previous.status !== 'committed' ||
            String(previous.chapterId) !== chapterId ||
            previous.requestedPriceCoins !== input.expectedPriceCoins ||
            String(entitlement?.storyId) !== storyId ||
            String(entitlement?.publishedRevisionId) !== input.publishedRevisionId
          )
            throw new HttpError(
              409,
              'idempotency_conflict',
              'Mã thao tác đã dùng với nội dung khác.',
            );
          return {
            entitlementId: String(entitlement._id),
            requestId: String(previous._id),
            replayed: true,
          };
        }
        const { story, chapter } = await chapterState(storyId, chapterId, session, true);
        const now = new Date(),
          access = chapter.earlyAccess;
        if (String(chapter.publishedRevisionId) !== input.publishedRevisionId)
          throw new HttpError(409, 'chapter_changed', 'Phiên bản chương đã đổi. Hãy tải lại.');
        if (!access?.enabled || (access.endsAt && access.endsAt <= now))
          return { free: true, replayed: false };
        if (
          !access.endsAt ||
          !Number.isSafeInteger(access.coinPrice) ||
          access.coinPrice <= 0 ||
          access.coinPrice !== input.expectedPriceCoins
        )
          throw new HttpError(
            409,
            'price_changed',
            'Giá hoặc thời hạn đọc sớm không hợp lệ. Hãy tải lại.',
          );
        const existing = await UnlockEntitlement.findOne({
          accountId: account._id,
          chapterId: chapter._id,
        }).session(session);
        if (existing) {
          if (
            existing.status === 'active' &&
            existing.expiresAt > now &&
            String(existing.publishedRevisionId) === input.publishedRevisionId
          )
            return { entitlementId: String(existing._id), replayed: true };
          throw new HttpError(
            409,
            'existing_purchase',
            'Đã có giao dịch cho chương này. Không thu phí thêm; vui lòng liên hệ hỗ trợ.',
          );
        }
        if (String(story.authorAccountId) === String(account._id))
          throw new HttpError(409, 'own_chapter', 'Sử dụng xem trước để đọc chương của bạn.');
        const pricePolicy =
          access.policyVersionId &&
          (await PolicyVersion.findById(access.policyVersionId).session(session));
        const policy = await PolicyVersion.findOne({
          status: 'effective',
          effectiveAt: { $lte: now },
        })
          .sort({ effectiveAt: -1, _id: -1 })
          .session(session);
        if (
          !pricePolicy ||
          !policy ||
          !Number.isSafeInteger(access.durationDays) ||
          access.durationDays < pricePolicy.durationMinDays ||
          access.durationDays > pricePolicy.durationMaxDays ||
          access.coinPrice < pricePolicy.priceMinCoins ||
          access.coinPrice > pricePolicy.priceMaxCoins
        )
          throw new HttpError(409, 'policy_required', 'Không xác minh được policy giá/thời hạn.');
        const rate = await AuthorRevenueRate.findOne({
          authorAccountId: story.authorAccountId,
          effectiveAt: { $lte: now },
        })
          .sort({ effectiveAt: -1, _id: -1 })
          .session(session);
        const percent = rate?.percentage ?? policy.authorSharePercent;
        if (!Number.isInteger(percent) || percent < 0 || percent > 100)
          throw new HttpError(409, 'invalid_rate', 'Tỷ lệ phân bổ không hợp lệ.');
        const price = access.coinPrice,
          authorAmount = Number((BigInt(price) * BigInt(percent)) / 100n),
          platformAmount = price - authorAmount;
        const reader = await Wallet.findOne({
          ownerId: account._id,
          ownerType: 'account',
          purpose: 'reader-coins',
        }).session(session);
        if (!reader) throw new HttpError(409, 'insufficient_balance', 'Ví chưa có đủ xu.');
        const author = await Wallet.findOneAndUpdate(
          { ownerId: story.authorAccountId, ownerType: 'account', purpose: 'author-earnings' },
          { $setOnInsert: { availableBalance: 0 } },
          { upsert: true, returnDocument: 'after', session },
        );
        const platform = await Wallet.findOneAndUpdate(
          { ownerId: PLATFORM_WALLET_OWNER, ownerType: 'system', purpose: 'system-earnings' },
          { $setOnInsert: { availableBalance: 0 } },
          { upsert: true, returnDocument: 'after', session },
        );
        const policySnapshot = {
          id: String(policy._id),
          version: policy.version,
          authorSharePercent: percent,
          platformSharePercent: 100 - percent,
        };
        const [entitlement] = await UnlockEntitlement.create(
          [
            {
              accountId: account._id,
              storyId: story._id,
              chapterId: chapter._id,
              publishedRevisionId: chapter.publishedRevisionId,
              status: 'active',
              purchasedAt: now,
              expiresAt: access.endsAt,
              priceCoins: price,
              pricePolicySnapshot: {
                id: String(pricePolicy._id),
                version: pricePolicy.version,
                priceMinCoins: pricePolicy.priceMinCoins,
                priceMaxCoins: pricePolicy.priceMaxCoins,
                priceCoins: price,
              },
              accessPolicySnapshot: {
                durationDays: access.durationDays,
                endsAt: access.endsAt,
                policyId: String(pricePolicy._id),
              },
            },
          ],
          { session },
        );
        const scope = {
          operation: 'chapter-unlock',
          ownerId: account._id,
          key: input.idempotencyKey,
        };
        const [unlock] = await UnlockRequest.create(
          [
            {
              accountId: account._id,
              chapterId: chapter._id,
              requestedPriceCoins: input.expectedPriceCoins,
              effectivePriceCoins: price,
              idempotencyScope: scope,
              status: 'committed',
              entitlementId: entitlement._id,
              policySnapshot,
            },
          ],
          { session },
        );
        await changeBalance(reader, -price, session);
        await changeBalance(author, authorAmount, session);
        await changeBalance(platform, platformAmount, session);
        const entries = await LedgerEntry.create(
          [
            { walletId: reader._id, ledgerType: 'unlock-debit', direction: 'debit', amount: price },
            {
              walletId: author._id,
              ledgerType: 'allocation-credit',
              direction: 'credit',
              amount: authorAmount,
            },
            {
              walletId: platform._id,
              ledgerType: 'allocation-credit',
              direction: 'credit',
              amount: platformAmount,
            },
          ].map((leg) => ({
            ...leg,
            sourceType: 'UnlockRequest',
            sourceId: unlock._id,
            idempotencyScope: scope,
            occurredAt: now,
          })),
          { session, ordered: true },
        );
        await RevenueAllocation.create(
          [
            {
              unlockRequestId: unlock._id,
              ledgerEntryIds: entries.map((e) => e._id),
              beneficiaries: [story.authorAccountId, PLATFORM_WALLET_OWNER],
              amount: price,
              policySnapshot,
              ...(rate
                ? {
                    negotiatedAllocationSnapshot: {
                      id: String(rate._id),
                      percentage: rate.percentage,
                      effectiveAt: rate.effectiveAt,
                    },
                  }
                : {}),
              roundingData: { author: 'floor', platform: 'remainder' },
            },
          ],
          { session },
        );
        await AuditEvent.create(
          [
            {
              actorType: 'account',
              actorId: account._id,
              action: 'chapter.unlocked',
              targetType: 'UnlockRequest',
              targetId: unlock._id,
              result: 'committed',
              occurredAt: now,
              correlationId: `policy:${policy._id}:v${policy.version}`,
            },
          ],
          { session },
        );
        return {
          entitlementId: String(entitlement._id),
          requestId: String(unlock._id),
          replayed: false,
        };
      });
    } catch (error) {
      if (
        attempt === 2 ||
        error.code !== 11000 ||
        !error.keyPattern?.ownerId ||
        !error.keyPattern?.purpose
      )
        throw error;
    }
  }
}
