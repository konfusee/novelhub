import { Wallet } from '../models/index.js'
import { HttpError } from '../middleware/errors.js'

export const PLATFORM_OWNER_ID = '000000000000000000000002'

async function creditEarningsWallet(identity, amount, session) {
  const wallet = await Wallet.findOneAndUpdate(
    identity,
    { $setOnInsert: { availableBalance: 0 } },
    { upsert: true, returnDocument: 'after', session },
  )

  if (amount === 0) return wallet

  const updated = await Wallet.findOneAndUpdate(
    {
      _id: wallet._id,
      unit: 'coin',
      availableBalance: {
        $gte: 0,
        $lte: Number.MAX_SAFE_INTEGER - amount,
      },
    },
    {
      $inc: {
        availableBalance: amount,
        balanceVersion: 1,
        version: 1,
      },
    },
    { returnDocument: 'after', session },
  )

  if (!updated) {
    throw new HttpError(409, 'earnings_wallet_unavailable', 'Không thể cập nhật ví nhận doanh thu.')
  }

  return updated
}

export async function transferUnlockCoins(readerId, authorId, priceCoins, split, session) {
  if (!session?.inTransaction()) {
    throw new Error('Chuyển xu phải chạy trong transaction.')
  }

  const { authorCoins, platformCoins } = split

  if (
    !Number.isSafeInteger(priceCoins) ||
    priceCoins <= 0 ||
    !Number.isSafeInteger(authorCoins) ||
    !Number.isSafeInteger(platformCoins) ||
    authorCoins < 0 ||
    platformCoins < 0 ||
    authorCoins + platformCoins !== priceCoins
  ) {
    throw new HttpError(409, 'invalid_unlock_allocation', 'Số xu phân bổ không hợp lệ.')
  }

  const readerWallet = await Wallet.findOneAndUpdate(
    {
      ownerType: 'account',
      ownerId: readerId,
      purpose: 'reader-coins',
      unit: 'coin',
      availableBalance: {
        $gte: priceCoins,
        $lte: Number.MAX_SAFE_INTEGER,
      },
    },
    {
      $inc: {
        availableBalance: -priceCoins,
        balanceVersion: 1,
        version: 1,
      },
    },
    { returnDocument: 'after', session },
  )

  if (!readerWallet) {
    throw new HttpError(409, 'insufficient_coins', 'Số dư xu không đủ để mở khóa chương.')
  }

  const authorWallet = await creditEarningsWallet(
    {
      ownerType: 'account',
      ownerId: authorId,
      purpose: 'author-earnings',
    },
    authorCoins,
    session,
  )

  const platformWallet = await creditEarningsWallet(
    {
      ownerType: 'system',
      ownerId: PLATFORM_OWNER_ID,
      purpose: 'system-earnings',
    },
    platformCoins,
    session,
  )

  return { readerWallet, authorWallet, platformWallet }
}
