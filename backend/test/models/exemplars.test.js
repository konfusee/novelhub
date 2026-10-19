import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { Account } from '../../src/models/identity/account.model.js'
import { EmailToken } from '../../src/models/identity/email-token.model.js'
import { LedgerEntry } from '../../src/models/finance/ledger-entry.model.js'
import { useTestDatabase } from '../db.js'

useTestDatabase()

const oid = () => new mongoose.Types.ObjectId()
const withPassword = email => ({
  displayName: 'A',
  email,
  password: { hash: 'argon2-hash', algorithm: 'argon2id', updatedAt: new Date() },
  bankDetails: { bankName: 'VCB', accountNumber: '0123', accountHolder: 'NGUYEN VAN A' },
})

describe('Account', () => {
  it('normalizes email and enforces uniqueness case-insensitively', async () => {
    await Account.create({ displayName: 'A', email: 'Reader@Mail.VN' })
    await expect(
      Account.create({ displayName: 'B', email: 'reader@mail.vn' }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it('keeps normalizedEmail in sync on query updates', async () => {
    const a = await Account.create({ displayName: 'A', email: 'a@x.vn' })
    await Account.create({ displayName: 'B', email: 'b@x.vn' })
    await expect(
      Account.updateOne({ _id: a._id }, { $set: { email: 'B@X.VN' } }),
    ).rejects.toMatchObject({ code: 11000 })
    await Account.updateOne({ _id: a._id }, { $set: { email: 'New@X.VN' } })
    expect((await Account.findById(a._id).lean()).normalizedEmail).toBe('new@x.vn')
    await expect(
      Account.updateOne({ _id: a._id }, { $set: { normalizedEmail: 'other@x.vn' } }),
    ).rejects.toThrow(/derived from email/)
  })

  it('allows many anonymized accounts without email', async () => {
    await Account.create({ displayName: 'Deleted user', status: 'anonymized' })
    await Account.create({ displayName: 'Deleted user', status: 'anonymized' })
    expect(await Account.countDocuments()).toBe(2)
  })

  it('never returns the password or bank details from normal reads or JSON', async () => {
    const created = await Account.create(withPassword('a@x.vn'))
    expect(JSON.parse(JSON.stringify(created))).not.toHaveProperty('password')
    expect(JSON.parse(JSON.stringify(created))).not.toHaveProperty('bankDetails')

    const plain = await Account.findById(created._id).lean()
    expect(plain.password).toBeUndefined()
    expect(plain.bankDetails).toBeUndefined()

    const doc = await Account.findById(created._id).select('+password +bankDetails')
    expect(doc.password.hash).toBe('argon2-hash')
    expect(JSON.parse(JSON.stringify(doc))).not.toHaveProperty('password')
  })

  it('keeps everAuthor monotonic on save and query paths', async () => {
    const account = await Account.create({ displayName: 'A', email: 'a@x.vn', everAuthor: true })
    account.everAuthor = false
    await expect(account.save()).rejects.toThrow(/everAuthor cannot be cleared/)
    await expect(
      Account.updateOne({ _id: account._id }, { $set: { everAuthor: false } }),
    ).rejects.toThrow(/everAuthor cannot be cleared/)
  })

  it('applies the same email and everAuthor rules to bulkWrite and non-$set operators', async () => {
    const a = await Account.create({ displayName: 'A', email: 'a@x.vn', everAuthor: true })
    await Account.create({ displayName: 'B', email: 'b@x.vn' })
    await expect(
      Account.bulkWrite([
        { updateOne: { filter: { _id: a._id }, update: { $set: { email: 'B@X.VN' } } } },
      ]),
    ).rejects.toMatchObject({ code: 11000 })
    await expect(
      Account.bulkWrite([
        { updateOne: { filter: { _id: a._id }, update: { $set: { everAuthor: false } } } },
      ]),
    ).rejects.toThrow(/everAuthor cannot be cleared/)
    await expect(Account.updateOne({ _id: a._id }, { $set: { everAuthor: 0 } })).rejects.toThrow(
      /everAuthor cannot be cleared/,
    )
    await expect(
      Account.updateOne({ _id: a._id }, { $rename: { displayName: 'everAuthor' } }),
    ).rejects.toThrow(/not allowed/)
    expect(await Account.findById(a._id).lean()).toMatchObject({
      normalizedEmail: 'a@x.vn',
      everAuthor: true,
    })
  })

  it('rejects unknown fields', async () => {
    await expect(Account.create({ displayName: 'A', isAdmin: true })).rejects.toThrow()
  })
})

describe('EmailToken', () => {
  it('rejects a duplicate token hash', async () => {
    const base = {
      accountId: oid(),
      purpose: 'password-reset',
      expiresAt: new Date(Date.now() + 1e6),
    }
    await EmailToken.create({ ...base, tokenHash: 'h1' })
    await expect(EmailToken.create({ ...base, tokenHash: 'h1' })).rejects.toMatchObject({
      code: 11000,
    })
  })
})

describe('LedgerEntry', () => {
  const entry = (overrides = {}) => ({
    walletId: oid(),
    ledgerType: 'topup-credit',
    direction: 'credit',
    amount: 50_000,
    sourceType: 'topUpOrder',
    sourceId: oid(),
    idempotencyScope: { operation: 'topup', ownerId: oid(), key: 'order-1' },
    ...overrides,
  })

  it('is append-only on every write path', async () => {
    const created = await LedgerEntry.create(entry())
    await expect(LedgerEntry.updateOne({ _id: created._id }, { amount: 1 })).rejects.toThrow(
      /append-only/,
    )
    await expect(
      LedgerEntry.bulkWrite([
        { updateOne: { filter: { _id: created._id }, update: { $set: { amount: 999_999 } } } },
      ]),
    ).rejects.toThrow(/append-only/)
    await expect(LedgerEntry.deleteOne({ _id: created._id })).rejects.toThrow(/append-only/)
    created.amount = 1
    await expect(created.save()).rejects.toThrow(/append-only/)
    expect((await LedgerEntry.findById(created._id).lean()).amount).toBe(50_000)
  })

  it('allows one entry per wallet leg of an operation and rejects a retried leg', async () => {
    const scope = { operation: 'unlock', ownerId: oid(), key: 'unlock-1' }
    const readerWallet = oid()
    await LedgerEntry.create(
      entry({
        walletId: readerWallet,
        ledgerType: 'unlock-debit',
        direction: 'debit',
        idempotencyScope: scope,
      }),
    )
    await LedgerEntry.create(entry({ ledgerType: 'allocation-credit', idempotencyScope: scope }))
    await expect(
      LedgerEntry.create(
        entry({
          walletId: readerWallet,
          ledgerType: 'unlock-debit',
          direction: 'debit',
          idempotencyScope: scope,
        }),
      ),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it('enforces the direction allowed for each ledger type', async () => {
    await expect(
      LedgerEntry.create(entry({ ledgerType: 'topup-credit', direction: 'debit' })),
    ).rejects.toThrow(/topup-credit entries must be credit/)
  })

  it('requires a reason and an actor for Admin adjustments', async () => {
    await expect(
      LedgerEntry.create(entry({ ledgerType: 'adjustment', actorAccountId: oid() })),
    ).rejects.toThrow(/reason/)
    await expect(
      LedgerEntry.create(entry({ ledgerType: 'adjustment', reason: 'Fix' })),
    ).rejects.toThrow(/actor/)
    await expect(
      LedgerEntry.create(
        entry({ ledgerType: 'adjustment', reason: 'Fix duplicate credit', actorAccountId: oid() }),
      ),
    ).resolves.toBeTruthy()
  })

  it('allows reversing an entry exactly once', async () => {
    const original = await LedgerEntry.create(entry())
    const reversal = key =>
      entry({
        ledgerType: 'reversal',
        direction: 'debit',
        reversalOf: original._id,
        idempotencyScope: { operation: 'reversal', ownerId: oid(), key },
      })
    await expect(LedgerEntry.create(entry({ ledgerType: 'reversal' }))).rejects.toThrow(
      /reversalOf|reference/,
    )
    await LedgerEntry.create(reversal('r1'))
    await expect(LedgerEntry.create(reversal('r2'))).rejects.toMatchObject({ code: 11000 })
  })

  it('rejects fractional coin amounts', async () => {
    await expect(LedgerEntry.create(entry({ amount: 10.5 }))).rejects.toThrow()
  })
})
