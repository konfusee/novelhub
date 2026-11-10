import { Account, LedgerEntry, Wallet } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import {
  assertReportAmounts,
  matchesAuthorName,
  monthRange,
  paginateReport,
  shiftMonth,
} from './finance-reporting.js'

export async function getAdminAuthorRevenue({
  periodId,
  page = 1,
  search = '',
  activity = 'all',
  sort = 'revenue',
  all = false,
}) {
  const { start, end } = monthRange(periodId)

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

    assertReportAmounts([
      totalRevenueCoins,
      ...rows.flatMap(row => [row.monthlyRevenueCoins, row.balanceCoins]),
    ])

    const earningAuthors = rows.filter(row => row.monthlyRevenueCoins > 0)

    const filtered = rows.filter(
      row =>
        matchesAuthorName(row.displayName, search) &&
        (activity !== 'earning' || row.monthlyRevenueCoins > 0),
    )
    const sortRows = {
      revenue: (a, b) => b.monthlyRevenueCoins - a.monthlyRevenueCoins,
      balance: (a, b) => b.balanceCoins - a.balanceCoins,
      name: (a, b) => a.displayName.localeCompare(b.displayName, 'vi'),
    }
    filtered.sort((a, b) => sortRows[sort](a, b) || a.accountId.localeCompare(b.accountId))

    // The trend and headline metrics cover the whole period, independently of table filters.
    const firstPeriod = shiftMonth(periodId, -5)
    const trendRows = await LedgerEntry.aggregate([
      {
        $match: {
          walletId: { $in: wallets.map(wallet => wallet._id) },
          ledgerType: 'allocation-credit',
          direction: 'credit',
          sourceType: 'UnlockRequest',
          occurredAt: { $gte: monthRange(firstPeriod).start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$occurredAt', timezone: 'Asia/Ho_Chi_Minh' },
          },
          revenueCoins: { $sum: '$amount' },
        },
      },
    ]).session(session)
    const revenueByMonth = new Map(trendRows.map(row => [row._id, row.revenueCoins]))
    const trend = Array.from({ length: 6 }, (_, index) => {
      const month = shiftMonth(firstPeriod, index)
      return { periodId: month, revenueCoins: revenueByMonth.get(month) ?? 0 }
    })
    assertReportAmounts(trend.map(row => row.revenueCoins))

    return {
      periodId,
      summary: {
        totalAuthors: rows.length,
        earningAuthors: earningAuthors.length,
        totalRevenueCoins,
      },
      topAuthors: earningAuthors.slice(0, 5),
      trend,
      ...paginateReport(filtered, page, all),
    }
  })
}
