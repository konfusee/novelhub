import { Account, LedgerEntry, Wallet } from '../models/index.js'
import { withTransaction } from '../db/connection.js'
import { HttpError } from '../middleware/errors.js'

function monthRange(periodId) {
  const [year, month] = periodId.split('-').map(Number)

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1

  const nextPeriod = [String(nextYear).padStart(4, '0'), String(nextMonth).padStart(2, '0')].join(
    '-',
  )

  // Khoảng tháng theo giờ Việt Nam.
  const start = new Date(`${periodId}-01T00:00:00+07:00`)
  const end = new Date(`${nextPeriod}-01T00:00:00+07:00`)

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new HttpError(400, 'invalid_revenue_period', 'Kỳ thống kê không hợp lệ.')
  }

  return { start, end }
}

export async function getAdminAuthorRevenue({ periodId, page = 1 }) {
  const { start, end } = monthRange(periodId)
  const pageSize = 20

  return withTransaction(async session => {
    // Bao gồm cả tác giả từng hoạt động để giữ dữ liệu lịch sử.
    const accounts = await Account.find({
      everAuthor: true,
    })
      .select('displayName status')
      .session(session)
      .lean()

    const wallets = await Wallet.find({
      ownerType: 'account',
      ownerId: {
        $in: accounts.map(account => account._id),
      },
      purpose: 'author-earnings',
      unit: 'coin',
    })
      .select('ownerId availableBalance')
      .session(session)
      .lean()

    const earnings = await LedgerEntry.aggregate([
      {
        $match: {
          walletId: {
            $in: wallets.map(wallet => wallet._id),
          },
          ledgerType: 'allocation-credit',
          direction: 'credit',
          sourceType: 'UnlockRequest',
          occurredAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: '$walletId',
          revenueCoins: { $sum: '$amount' },
          earningEvents: { $sum: 1 },
        },
      },
    ]).session(session)

    const walletByOwner = new Map(wallets.map(wallet => [String(wallet.ownerId), wallet]))

    const earningsByWallet = new Map(earnings.map(item => [String(item._id), item]))

    const rows = accounts.map(account => {
      const wallet = walletByOwner.get(String(account._id))
      const earning = wallet ? earningsByWallet.get(String(wallet._id)) : null

      return {
        accountId: String(account._id),
        displayName: account.displayName,
        accountStatus: account.status,
        monthlyRevenueCoins: earning?.revenueCoins ?? 0,
        earningEvents: earning?.earningEvents ?? 0,
        balanceCoins: wallet?.availableBalance ?? 0,
      }
    })

    rows.sort(
      (left, right) =>
        right.monthlyRevenueCoins - left.monthlyRevenueCoins ||
        left.accountId.localeCompare(right.accountId),
    )

    const totalRevenueCoins = rows.reduce((total, row) => total + row.monthlyRevenueCoins, 0)

    if (
      !Number.isSafeInteger(totalRevenueCoins) ||
      rows.some(
        row => !Number.isSafeInteger(row.monthlyRevenueCoins) || row.monthlyRevenueCoins < 0,
      )
    ) {
      throw new HttpError(409, 'invalid_revenue_total', 'Số liệu doanh thu vượt giới hạn xử lý.')
    }

    const earningAuthors = rows.filter(row => row.monthlyRevenueCoins > 0)

    const offset = (page - 1) * pageSize

    return {
      periodId,
      summary: {
        totalAuthors: rows.length,
        earningAuthors: earningAuthors.length,
        totalRevenueCoins,
      },
      topAuthors: earningAuthors.slice(0, 5),
      page,
      pageSize,
      totalItems: rows.length,
      hasMore: offset + pageSize < rows.length,
      items: rows.slice(offset, offset + pageSize),
    }
  })
}
