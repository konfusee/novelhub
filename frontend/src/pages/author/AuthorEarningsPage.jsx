import { AuthorLayout } from '../../layouts'
import { Button, Card, EmptyState, Input, Select, Skeleton } from '../../components/ui'
import { useState } from 'react'
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
  const [storySearch, setStorySearch] = useState('')
  const stories = useBackendDocument(
    `/author/earnings/stories?${new URLSearchParams({ search: storySearch })}`,
    null,
  )
  const [filters, setFilters] = useState({ type: 'all', page: 1 })
  const earnings = useBackendDocument(`/author/earnings?${new URLSearchParams(filters)}`, null)

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
            <p className="mt-2 max-w-prose text-sm text-muted">{copy('description')}</p>
          </div>

          <Button variant="secondary" disabled={loading} onClick={earnings.retry}>
            {copy('refresh')}
          </Button>
        </header>
        <Card className="mt-6">
          <form
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={event => {
              event.preventDefault()
              const values = Object.fromEntries(new FormData(event.currentTarget))
              if (!values.storyId) delete values.storyId
              if (values.from) values.from = new Date(values.from + 'T00:00:00+07:00').toISOString()
              else delete values.from
              if (values.to)
                values.to = new Date(
                  +new Date(values.to + 'T00:00:00+07:00') + 86400000,
                ).toISOString()
              else delete values.to
              setFilters({ ...values, page: 1 })
            }}
          >
            <label className="flex min-w-0 flex-col gap-2 text-sm">
              {t('financialTransactions.type')}
              <Select name="type" defaultValue="all">
                <option value="all">{t('financialTransactions.all')}</option>
                {['allocation-credit', 'withdrawal-debit', 'adjustment', 'reversal'].map(value => (
                  <option key={value} value={value}>
                    {t('financialTransactions.' + value)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm">
              {t('financialTransactions.from')}
              <Input type="date" name="from" />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm">
              {t('financialTransactions.to')}
              <Input type="date" name="to" />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm">
              {copy('storySearch')}
              <Input
                type="search"
                value={storySearch}
                maxLength={100}
                onChange={event => setStorySearch(event.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm">
              {copy('story')}
              <Select name="storyId" defaultValue="">
                <option value="">{t('financialTransactions.all')}</option>
                {(stories.data?.items ?? []).map(story => (
                  <option key={story._id} value={story._id}>
                    {story.title}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" className="self-end">
              {t('financialTransactions.apply')}
            </Button>
          </form>
        </Card>

        {loading ? (
          <Card className="mt-6" aria-busy="true" aria-label={copy('loading')}>
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
              <h2 className="text-sm font-semibold text-muted">{copy('balance')}</h2>
              <p className="mt-3 text-h1 tabular-nums">
                {formatNumber(data.balance)} {t('wallet.coinUnit')}
              </p>
              <p className="mt-2 text-sm text-muted">{copy('balanceHint')}</p>
            </Card>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                'monthRevenue',
                'paidUnlockCount',
                'payoutPending',
                'payoutPaid',
                'payoutFailed',
                'nextEvaluation',
              ].map(key => {
                const summary = data.summary ?? {}
                const value = {
                  monthRevenue: summary.revenueCoins,
                  paidUnlockCount: summary.paidUnlockCount,
                  payoutPending: summary.payoutSummary?.pending,
                  payoutPaid: summary.payoutSummary?.paid,
                  payoutFailed: summary.payoutSummary?.failed,
                }[key]
                return (
                  <Card key={key}>
                    <h2 className="text-sm text-muted">{copy(key)}</h2>
                    <p className="mt-3 text-h3 tabular-nums">
                      {key === 'nextEvaluation'
                        ? summary.nextEvaluationAt
                          ? formatDate(summary.nextEvaluationAt)
                          : '—'
                        : formatNumber(value ?? 0)}
                    </p>
                  </Card>
                )
              })}
            </div>
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-8">
                <Card className=" overflow-hidden p-0">
                  <div className="p-6">
                    <h2 className="text-h3">{copy('history')}</h2>
                    <p className="mt-1 text-sm text-muted">{copy('historyHint')}</p>
                    <p className="mt-3 text-sm font-semibold">
                      {copy('netAmount')}: {formatNumber(data.netAmount ?? 0)}{' '}
                      {t('wallet.coinUnit')}
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
                            <th scope="col" className="px-6 py-3 text-right">
                              {copy('balanceAfter')}
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
                                <p className="mt-1 text-xs leading-5 text-muted">
                                  {entry.description}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-right font-semibold tabular-nums">
                                {entry.amount > 0 ? '+' : ''}
                                {formatNumber(entry.amount)} {t('wallet.coinUnit')}
                              </td>
                              <td className="px-6 py-4 text-right tabular-nums">
                                {formatNumber(entry.balanceAfter ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line p-4">
                    <Button
                      variant="secondary"
                      disabled={filters.page === 1}
                      onClick={() =>
                        setFilters(previous => ({ ...previous, page: previous.page - 1 }))
                      }
                    >
                      {t('walletFlow.previous')}
                    </Button>
                    <span>{filters.page}</span>
                    <Button
                      variant="secondary"
                      disabled={!data.hasMore}
                      onClick={() =>
                        setFilters(previous => ({ ...previous, page: previous.page + 1 }))
                      }
                    >
                      {t('walletFlow.next')}
                    </Button>
                  </div>
                </Card>
              </div>

              <aside id="author-bank-details" className="min-w-0 space-y-6 xl:col-span-4">
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
