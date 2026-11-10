import { useLocale } from '../../context/LocaleContext'
import { Card } from '../ui'

const compactNumber = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function AuthorRevenueTrend({ items }) {
  const { t, formatNumber } = useLocale()
  const max = Math.max(1, ...items.map(item => item.revenueCoins))
  return (
    <Card className="mt-5 min-w-0">
      <h3 className="text-h3">{t('financeReports.trendTitle')}</h3>
      <p className="mt-2 text-sm text-muted">{t('financeReports.trendHint')}</p>
      <div className="mt-5 overflow-x-auto">
        <div
          className="grid grid-cols-6 gap-2 sm:gap-4"
          role="list"
          aria-label={t('financeReports.trendTitle')}
        >
          {items.map(item => (
            <div
              role="listitem"
              key={item.periodId}
              className="min-w-0 text-center"
              aria-label={`${item.periodId}: ${t('adminRevenue.coinAmount', { amount: formatNumber(item.revenueCoins) })}`}
            >
              <p
                className="mb-2 truncate text-xs font-semibold tabular-nums"
                title={formatNumber(item.revenueCoins)}
              >
                <span className="sm:hidden">{compactNumber.format(item.revenueCoins)}</span>
                <span className="hidden sm:inline">{formatNumber(item.revenueCoins)}</span>
              </p>
              <div
                className="flex h-28 items-end justify-center border-b border-line"
                aria-hidden="true"
              >
                <div
                  className="w-8 rounded-t-lg bg-brand sm:w-12"
                  style={{ height: `${(item.revenueCoins / max) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted" title={item.periodId}>
                <span className="sm:hidden">
                  {item.periodId.slice(5)}/{item.periodId.slice(2, 4)}
                </span>
                <span className="hidden sm:inline">{item.periodId}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
