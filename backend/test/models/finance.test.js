import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../db.js';
import { BankTransaction } from '../../src/models/finance/bank-transaction.model.js';
import { PayoutResultEntry } from '../../src/models/finance/payout-result-entry.model.js';
import { PayoutSheetRow } from '../../src/models/finance/payout-sheet-row.model.js';
import { RevenueAllocation } from '../../src/models/finance/revenue-allocation.model.js';
import { TopUpOrder } from '../../src/models/finance/top-up-order.model.js';
import { TopUpPackage } from '../../src/models/finance/top-up-package.model.js';
import { UnlockEntitlement } from '../../src/models/finance/unlock-entitlement.model.js';
import { UnlockRequest } from '../../src/models/finance/unlock-request.model.js';
import { Wallet } from '../../src/models/finance/wallet.model.js';
import { WithdrawalRequest } from '../../src/models/finance/withdrawal-request.model.js';
useTestDatabase();
const id = () => new mongoose.Types.ObjectId();

describe('finance models', () => {
  it('validates payment codes and bank match statuses', async () => {
    await expect(
      new TopUpOrder({
        accountId: id(),
        walletId: id(),
        packageId: id(),
        packageSnapshot: {},
        paymentCode: 'bad',
        coinAmount: 1,
        expiresAt: new Date(),
      }).validate(),
    ).rejects.toThrow();
    await expect(
      new BankTransaction({
        sePayTransactionId: 'tx-1',
        matchStatus: 'already-paid',
        amountVnd: 1,
        receivedAt: new Date(),
        apiKeyAuthenticated: true,
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it('requires a payout row bank snapshot unless explicitly marked missing', async () => {
    const row = (overrides) => ({
      withdrawalRequestId: id(),
      periodId: '2026-01',
      amountCoins: 100_000,
      ...overrides,
    });
    await expect(PayoutSheetRow.create(row({}))).rejects.toThrow(
      /required unless bankDetailsMissing/,
    );
    await expect(
      PayoutSheetRow.create(
        row({ bankDetailsMissing: true, bankDetailsSnapshot: { accountNumber: '1' } }),
      ),
    ).rejects.toThrow(/cannot have bank details and be marked missing/);
    const missing = await PayoutSheetRow.create(row({ bankDetailsMissing: true }));
    // Admin enters support-supplied details as a correction; the marker itself stays.
    await PayoutSheetRow.updateOne(
      { _id: missing._id },
      { $set: { correctedBankDetailsSnapshot: { accountNumber: '9' }, correctedAt: new Date() } },
    );
    await expect(
      PayoutSheetRow.updateOne({ _id: missing._id }, { $set: { bankDetailsMissing: false } }),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('never lets a wallet change its purpose, even through a query update', async () => {
    const wallet = await Wallet.create({
      ownerType: 'account',
      ownerId: id(),
      purpose: 'reader-coins',
    });
    await expect(
      Wallet.updateOne({ _id: wallet._id }, { $set: { purpose: 'author-earnings' } }),
    ).rejects.toThrow(/cannot be changed/);
    wallet.purpose = 'author-earnings';
    await expect(wallet.save()).rejects.toThrow(/cannot be changed/);
    expect((await Wallet.findById(wallet._id).lean()).purpose).toBe('reader-coins');
  });

  it('enforces wallet and entitlement uniqueness', async () => {
    const ownerId = id();
    await Wallet.create({ ownerType: 'account', ownerId, purpose: 'reader-coins' });
    await expect(
      Wallet.create({ ownerType: 'account', ownerId, purpose: 'reader-coins' }),
    ).rejects.toMatchObject({ code: 11000 });
    const accountId = id();
    const chapterId = id();
    await UnlockEntitlement.create({
      accountId,
      chapterId,
      storyId: id(),
      publishedRevisionId: id(),
      status: 'active',
      purchasedAt: new Date(),
      expiresAt: new Date(),
      priceCoins: 1,
    });
    await expect(
      UnlockEntitlement.create({
        accountId,
        chapterId,
        storyId: id(),
        publishedRevisionId: id(),
        status: 'active',
        purchasedAt: new Date(),
        expiresAt: new Date(),
        priceCoins: 1,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('enforces one paid payout result and append-only behavior', async () => {
    const withdrawalRequestId = id();
    await PayoutResultEntry.create({
      withdrawalRequestId,
      resultEntryKey: 'a',
      result: 'Paid',
      occurredAt: new Date(),
    });
    await expect(
      PayoutResultEntry.create({
        withdrawalRequestId,
        resultEntryKey: 'b',
        result: 'Paid',
        occurredAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
    const entry = await PayoutResultEntry.findOne();
    await expect(entry.save()).rejects.toThrow(/append-only/);
  });
  it('enforces finance uniqueness and pure invariants', async () => {
    const base = {
      accountId: id(),
      walletId: id(),
      packageId: id(),
      packageSnapshot: {},
      coinAmount: 10,
      expiresAt: new Date(),
      paymentCode: 'NH12345678',
    };
    await TopUpOrder.create(base);
    await expect(TopUpOrder.create({ ...base, _id: undefined })).rejects.toMatchObject({
      code: 11000,
    });
    await BankTransaction.create({
      sePayTransactionId: 'same',
      matchStatus: 'matched',
      amountVnd: 1,
      receivedAt: new Date(),
      apiKeyAuthenticated: true,
    });
    await expect(
      BankTransaction.create({
        sePayTransactionId: 'same',
        matchStatus: 'matched',
        amountVnd: 1,
        receivedAt: new Date(),
        apiKeyAuthenticated: true,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(new TopUpPackage({ priceVnd: 5, coinAmount: 4 }).validate()).rejects.toThrow();
    await expect(
      new Wallet({
        ownerType: 'account',
        ownerId: id(),
        purpose: 'reader-coins',
        expiresAt: new Date(),
      }).validate(),
    ).rejects.toThrow();
  });

  it('enforces withdrawal snapshot, period and slip invariants', async () => {
    const accountId = id();
    const make = (periodId, amountCoins = 20, slip = amountCoins) => ({
      accountId,
      earningsWalletId: id(),
      periodId,
      origin: 'system-monthly',
      cutoffAt: new Date(),
      evaluatedAt: new Date(),
      evaluatedBalanceCoins: 100,
      thresholdCoins: 10,
      amountCoins,
      payoutSlipAmountVnd: slip,
      policySnapshot: { rate: 70 },
      forcedByDeletion: false,
    });
    const created = await WithdrawalRequest.create(make('2026-01'));
    await WithdrawalRequest.create(make('2026-02'));
    await expect(WithdrawalRequest.create(make('2026-01'))).rejects.toMatchObject({ code: 11000 });
    await expect(new WithdrawalRequest(make('2026-03')).validate()).resolves.toBeUndefined();
    await expect(new WithdrawalRequest(make('2026-03', 20, 21)).validate()).rejects.toThrow();
    // Change both so the slip-equals-coins rule still holds and only the lock can reject.
    created.amountCoins += 1;
    created.payoutSlipAmountVnd += 1;
    await expect(created.save()).rejects.toThrow(/cannot be changed/);
    const reloaded = await WithdrawalRequest.findById(created._id).select('+policySnapshot');
    reloaded.policySnapshot.rate = 1;
    reloaded.markModified('policySnapshot');
    await expect(reloaded.save()).rejects.toThrow(/cannot be changed/);
    await expect(
      WithdrawalRequest.updateOne({ _id: created._id }, { $set: { 'policySnapshot.rate': 1 } }),
    ).rejects.toThrow(/cannot be changed/);
    const stored = await WithdrawalRequest.findById(created._id).select('+policySnapshot').lean();
    expect(stored.policySnapshot.rate).toBe(70);
  });

  it('allows failed payout retries, and scopes result keys', async () => {
    const withdrawalRequestId = id();
    await PayoutResultEntry.create([
      { withdrawalRequestId, resultEntryKey: 'f1', result: 'Failed', occurredAt: new Date() },
      { withdrawalRequestId, resultEntryKey: 'f2', result: 'Failed', occurredAt: new Date() },
      { withdrawalRequestId, resultEntryKey: 'p1', result: 'Paid', occurredAt: new Date() },
    ]);
    await expect(
      PayoutResultEntry.create({
        withdrawalRequestId,
        resultEntryKey: 'p1',
        result: 'Paid',
        occurredAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('enforces scoped unlock idempotency and append-only allocation', async () => {
    const scope = { operation: 'unlock', ownerId: id(), key: 'one' };
    await UnlockRequest.create({
      idempotencyScope: scope,
      accountId: id(),
      chapterId: id(),
      status: 'requested',
    });
    await expect(
      UnlockRequest.create({
        idempotencyScope: scope,
        accountId: id(),
        chapterId: id(),
        status: 'requested',
      }),
    ).rejects.toMatchObject({ code: 11000 });
    const allocation = await RevenueAllocation.create({
      unlockRequestId: id(),
      ledgerEntryIds: [id()],
      beneficiaries: [id()],
      amount: 1,
      negotiatedAllocationSnapshot: { percentage: 70 },
    });
    await expect(allocation.deleteOne()).rejects.toThrow(/append-only/);
  });
});
