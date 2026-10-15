import { describe, expect, it } from 'vitest';
import { seedReferenceData } from '../seed/seed-reference-data.js';
import { Account, Category, Story, Wallet, LedgerEntry } from '../src/models/index.js';
import { useTestDatabase } from './db.js';
import { catalogPresentation } from '../src/modules/catalog-presentation.js';
useTestDatabase();
describe('reference data import into existing schemas', () => {
  it('imports relational data and presentation metadata, then reruns without duplicates or overwrites', async () => {
    const input = { password: 'ReferenceTest-2026!' };
    const first = await seedReferenceData(input);
    expect(first.stories).toBeGreaterThan(10);
    expect(await Category.countDocuments()).toBe(9);
    const forest = await Story.findOne({ title: 'The Silent Forest' });
    expect(forest.publishedRevisionId).toBeTruthy();
    const category = await Category.findOne({ name: 'Kỳ ảo' });
    expect((await catalogPresentation().findOne({ _id: category._id })).icon).toBe('Sparkles');
    const accountCount = await Account.countDocuments();
    const stories = await Story.countDocuments();
    const wallets = await Wallet.find().lean();
    for (const wallet of wallets) {
      const entries = await LedgerEntry.find({ walletId: wallet._id }).lean();
      expect(
        entries.reduce(
          (sum, item) => sum + (item.direction === 'credit' ? item.amount : -item.amount),
          0,
        ),
      ).toBe(wallet.availableBalance);
    }
    forest.title = 'Tên do người dùng sửa';
    await forest.save();
    expect(await seedReferenceData(input)).toEqual({});
    expect(await Account.countDocuments()).toBe(accountCount);
    expect(await Story.countDocuments()).toBe(stories);
    expect((await Story.findById(forest._id)).title).toBe('Tên do người dùng sửa');
  });
});
