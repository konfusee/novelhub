import { useLocale } from '../../context/LocaleContext'
import { Card } from '../ui'

export function PayoutSummary({ summary }) {
  const { t, formatNumber } = useLocale()
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {['totalAmountVnd', 'paidAmountVnd', 'pendingAmountVnd', 'failedCount'].map(key => (
        <Card key={key}>
          <p className="text-sm text-muted">{t(`financeReports.${key}`)}</p>
          <strong className="mt-3 block text-h2 tabular-nums">{formatNumber(summary[key])}</strong>
          {key === 'failedCount' && (
            <p className="mt-2 text-sm text-muted">
              {t('financeReports.failedAmount', { amount: formatNumber(summary.failedAmountVnd) })}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
