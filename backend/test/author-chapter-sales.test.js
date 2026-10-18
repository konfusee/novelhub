import { expect, it } from 'vitest';
import {
  ContentRevision,
  LedgerEntry,
  RevenueAllocation,
  Story,
  UnlockEntitlement,
  UnlockRequest,
  Wallet,
} from '../src/models/index.js';
import { authorEarnings } from '../src/modules/author-earnings.js';
import { authorChapterSales } from '../src/modules/author-chapter-sales.js';
import { authorAnalytics } from '../src/modules/author-analytics.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
it('reports distinct buyers and actual credited coins per chapter/price without recomputing negotiated shares', async () => {
  const author = await authenticatedAccount('author'),
    buyer = await authenticatedAccount('reader'),
    otherBuyer = await authenticatedAccount('reader');
  const story = await Story.create({
    authorAccountId: author.account._id,
    title: 'Truyện thuộc tác giả',
    categoryIds: [author.account._id],
  });
  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 999,
  });
  const date = new Date('2026-10-16T00:00:00Z');
  const chapterIds = [buyer.account._id, otherBuyer.account._id];
  const revisions = [];
  for (const [index, chapterId] of chapterIds.entries())
    revisions.push(
      await ContentRevision.create({
        contentType: 'chapter',
        storyId: story._id,
        chapterId,
        authorAccountId: author.account._id,
        revisionNumber: 1,
        content: { title: `Chương snapshot ${index + 1}` },
        formatVersion: 'blocks-v1',
        status: 'approved',
      }),
    );
  for (const [index, reader, chapter, price, coins] of [
    [0, buyer, 0, 201, 140],
    [1, otherBuyer, 0, 201, 130],
    [2, buyer, 1, 301, 200],
  ]) {
    const entitlement = await UnlockEntitlement.create({
      accountId: reader.account._id,
      storyId: story._id,
      chapterId: chapterIds[chapter],
      publishedRevisionId: revisions[chapter]._id,
      status: 'active',
      purchasedAt: date,
      expiresAt: new Date('2026-10-20T00:00:00Z'),
      priceCoins: price,
    });
    const scope = { operation: 'sales-test', ownerId: reader.account._id, key: String(index) };
    const unlock = await UnlockRequest.create({
      accountId: reader.account._id,
      chapterId: chapterIds[chapter],
      requestedPriceCoins: price,
      effectivePriceCoins: price,
      idempotencyScope: scope,
      status: 'committed',
      entitlementId: entitlement._id,
    });
    const allocation =
      index === 1
        ? new RevenueAllocation({
            unlockRequestId: unlock._id,
            ledgerEntryIds: [wallet._id],
            beneficiaries: [author.account._id],
            amount: price,
            policySnapshot: { authorSharePercent: 65 },
          })
        : null;
    const leg = await LedgerEntry.create({
      walletId: wallet._id,
      ledgerType: 'allocation-credit',
      direction: 'credit',
      amount: coins,
      sourceType: allocation ? 'RevenueAllocation' : 'UnlockRequest',
      sourceId: allocation?._id ?? unlock._id,
      idempotencyScope: scope,
      occurredAt: date,
    });
    if (allocation) {
      allocation.ledgerEntryIds = [leg._id];
      await allocation.save();
    }
  }
  const report = await authorEarnings(author.account._id, 'day', new Date('2026-10-16T01:00:00Z'));
  expect(
    (
      await authorAnalytics(
        author.account._id,
        { days: 7, storyId: story.id },
        new Date('2026-10-16T01:00:00Z'),
      )
    ).verifiedUnlockIncome,
  ).toBe(470);
  expect(report.balance).toBe('999');
  expect(report.allocationCredits).toBe(470);
  expect(report.buyers).toBe(2);
  expect(report.salesCoverageIncomplete).toBe(false);
  expect(report.sales).toHaveLength(2);
  expect(report.sales[0]).toMatchObject({
    title: story.title,
    chapter: 'Chương snapshot 1',
    price: 201,
    buyers: 2,
    coins: 270,
  });
  expect(report.sales[1]).toMatchObject({
    chapter: 'Chương snapshot 2',
    price: 301,
    buyers: 1,
    coins: 200,
  });
  const scope = { storyId: story._id, chapterId: chapterIds[0] };
  expect(
    (
      await authorChapterSales(
        author.account._id,
        wallet._id,
        date,
        new Date('2026-10-16T01:00:00Z'),
        scope,
      )
    ).linkedCoins,
  ).toBe(270);
  expect(
    (
      await authorChapterSales(
        author.account._id,
        wallet._id,
        date,
        new Date('2026-10-16T01:00:00Z'),
        { storyId: buyer.account._id },
      )
    ).linkedCoins,
  ).toBe(0);
  expect(
    (await authorEarnings(author.account._id, 'day', new Date('2026-10-17T01:00:00Z'))).sales,
  ).toEqual([]);
  await LedgerEntry.create({
    walletId: wallet._id,
    ledgerType: 'allocation-credit',
    direction: 'credit',
    amount: 50,
    sourceType: 'LegacyCredit',
    sourceId: story._id,
    idempotencyScope: { operation: 'legacy', ownerId: author.account._id, key: 'missing-purchase' },
    occurredAt: date,
  });
  const partial = await authorEarnings(author.account._id, 'day', new Date('2026-10-16T01:00:00Z'));
  expect(partial.allocationCredits).toBe(520);
  expect(partial.buyers).toBeNull();
  expect(partial.salesCoverageIncomplete).toBe(true);
  expect(partial.sales).toHaveLength(2);
});
