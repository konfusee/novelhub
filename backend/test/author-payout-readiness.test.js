import { expect, it } from 'vitest';
import { Account, PolicyVersion, Wallet, WithdrawalRequest } from '../src/models/index.js';
import { authorPayoutReadiness } from '../src/modules/author-payout-readiness.js';
import { authorEarnings } from '../src/modules/author-earnings.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const now = new Date('2026-12-31T17:00:00Z');
it('reports current threshold and bank readiness without creating payouts or exposing bank details', async () => {
  const author = await authenticatedAccount('author');
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    actorAccountId: author.account._id,
  });
  expect((await authorPayoutReadiness(author.account._id, 99999, now)).state).toBe(
    'below-threshold',
  );
  const missing = await authorPayoutReadiness(author.account._id, 100000, now);
  expect(missing.state).toBe('bank-required');
  expect(missing.nextEvaluationAt).toEqual(new Date('2027-01-31T17:00:00Z'));
  await Account.updateOne(
    { _id: author.account._id },
    {
      $set: {
        bankDetails: {
          bankName: 'PRIVATE BANK',
          accountNumber: '00123456',
          accountHolder: 'PRIVATE AUTHOR',
        },
      },
    },
  );
  await Wallet.create({
    ownerType: 'account',
    ownerId: author.account._id,
    purpose: 'author-earnings',
    availableBalance: 100000,
  });
  const report = await authorEarnings(author.account._id, 'month', now);
  expect(report.payoutReadiness.state).toBe('eligible');
  expect(report.payoutReadiness.thresholdCoins).toBe(100000);
  expect(JSON.stringify(report)).not.toContain('00123456');
  expect(JSON.stringify(report)).not.toContain('PRIVATE BANK');
  expect(await WithdrawalRequest.countDocuments()).toBe(0);
});
it('keeps missing policies unknown, excludes future policies and does not treat an empty wallet as payable', async () => {
  const author = await authenticatedAccount('author');
  expect((await authorPayoutReadiness(author.account._id, 100000, now)).state).toBe('unavailable');
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2027-02-01'),
    actorAccountId: author.account._id,
  });
  expect((await authorPayoutReadiness(author.account._id, 100000, now)).state).toBe('unavailable');
  await PolicyVersion.create({
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    withdrawalThresholdCoins: 0,
    actorAccountId: author.account._id,
  });
  expect((await authorPayoutReadiness(author.account._id, 0, now)).state).toBe('below-threshold');
  expect(
    (await authorPayoutReadiness(author.account._id, Number.MAX_SAFE_INTEGER + 1, now)).state,
  ).toBe('unavailable');
});
