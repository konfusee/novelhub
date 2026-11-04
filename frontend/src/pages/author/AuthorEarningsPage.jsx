import { AuthorLayout } from '../../layouts'
import { Button, Card, EmptyState, Skeleton } from '../../components/ui'
import { AlertTriangle, Coins } from '../../components/icons'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { AuthorBankDetailsForm } from '../../components/author/AuthorBankDetailsForm'
import { AuthorPayoutHistory } from '../../components/author/AuthorPayoutHistory'


const entryLabels = {
  'allocation-credit': 'allocation',
  'withdrawal-debit': 'withdrawal',
  adjustment: 'adjustment',
  reversal: 'reversal',
}

export function AuthorEarningsPage() {
  const { t, formatNumber, formatDate } = useLocale()
  const earnings = useBackendDocument('/author/earnings', null)

  const copy = key => t(`authorFinance.wallet.${key}`)
  const loading = earnings.status === 'loading'
  const ready = earnings.status === 'ready' && earnings.data != null
  const data = earnings.data

  const errorTitle =
    earnings.error?.status === 401
      ? copy('loginRequired')
      : earnings.error?.status === 403
        ? copy('forbidden')
        : copy('loadError')

  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="nh-eyebrow">{t('authorFinance.eyebrow')}</p>
            <h1 className="mt-3 text-h2 sm:text-h1">{copy('title')}</h1>
            <p className="mt-2 max-w-prose text-sm text-muted">
              {copy('description')}
            </p>
          </div>

          <Button
            variant="secondary"
            disabled={loading}
            onClick={earnings.retry}
          >
            {copy('refresh')}
          </Button>
        </header>

        {loading ? (
          <Card
            className="mt-6"
            aria-busy="true"
            aria-label={copy('loading')}
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-9 w-48" />
            <Skeleton className="mt-6 h-32 w-full" />
          </Card>
        ) : !ready ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={errorTitle}
              action={
                <Button variant="secondary" onClick={earnings.retry}>
                  {t('reader.retry')}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <Card className="mt-6">
              <h2 className="text-sm font-semibold text-muted">
                {copy('balance')}
              </h2>
              <p className="mt-3 text-h1 tabular-nums">
                {formatNumber(data.balance)} {t('wallet.coinUnit')}
              </p>
              <p className="mt-2 text-sm text-muted">
                {copy('balanceHint')}
              </p>
            </Card>

            <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Card className=" overflow-hidden p-0">
                    <div className="p-6">
                      <h2 className="text-h3">{copy('history')}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {copy('historyHint')}
                      </p>
                    </div>
              {data.entries.length === 0 ? (
                <EmptyState icon={Coins} title={copy('empty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-y border-hairline bg-elevated text-muted">
                      <tr>
                        <th scope="col" className="px-6 py-3">
                          {copy('date')}
                        </th>
                        <th scope="col" className="px-6 py-3">
                          {copy('type')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right">
                          {copy('amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {data.entries.map(entry => (
                        <tr key={entry.id}>
                          <td className="px-6 py-4">
                            <time dateTime={entry.occurredAt}>
                              {formatDate(entry.occurredAt)}
                            </time>
                          </td>
                          <td className="px-6 py-4">
                            {copy(entryLabels[entry.type] ?? 'other')}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold tabular-nums">
                            {entry.amount > 0 ? '+' : ''}
                            {formatNumber(entry.amount)} {t('wallet.coinUnit')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.hasMore && (
                <p className="border-t border-hairline px-6 py-4 text-sm text-muted">
                  {copy('hasMore')}
                </p>
              )}
            </Card>
          </div>

          <aside
            id="author-bank-details"
            className="min-w-0 space-y-6 xl:col-span-4"
          >
            <AuthorBankDetailsForm />
          </aside>
        </div>
        <AuthorPayoutHistory />
          </>
        )}
      </div>
    </AuthorLayout>
  )
}