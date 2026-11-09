import { Wallet, LedgerEntry } from '../../../models/index.js'

export async function getReaderWallet(accountId) {
  const wallet = await Wallet.findOne({
    ownerType: 'account',
    ownerId: accountId,
    purpose: 'reader-coins',
  })
    .select('availableBalance')
    .lean()

  const entries = wallet
    ? await LedgerEntry.find({ walletId: wallet._id })
        .select('ledgerType direction amount occurredAt')
        .sort({ occurredAt: -1, _id: -1 })
        .limit(51)
        .lean()
    : []

  return {
    balance: wallet?.availableBalance ?? 0,
    entries: entries.slice(0, 50).map(entry => ({
      id: String(entry._id),
      type: entry.ledgerType,
      amount: entry.direction === 'credit' ? entry.amount : -entry.amount,
      occurredAt: entry.occurredAt,
    })),
    hasMore: entries.length > 50,
  }
}
