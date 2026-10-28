import { TopUpPackage } from '../models/index.js'

export async function getTopUpPackages() {
  const packages = await TopUpPackage.find({
    status: 'active',
    priceVnd: { $gt: 0 },
    coinAmount: { $gt: 0 },
  })
    .select('priceVnd coinAmount')
    .sort({ priceVnd: 1, _id: 1 })
    .lean()

  return {
    items: packages.map(pack => ({
      id: String(pack._id),
      priceVnd: pack.priceVnd,
      coinAmount: pack.coinAmount,
    })),
  }
}
