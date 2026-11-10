import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { PayoutActionDialog } from '../../components/admin/PayoutActionDialog'
import { Button, Card, Input, Select } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'
import { AdminLayout } from '../../layouts'
import { AuthorRevenuePanel } from '../../components/admin/AuthorRevenuePanel'
import { PayoutSummary } from '../../components/admin/PayoutSummary'
import { FinanceExportButton } from '../../components/admin/FinanceExportButton'

const empty = {
  items: [],
  hasMore: false,
}

const columns = ['author', 'coins', 'money', 'bank', 'status', 'latest', 'actions']

function selectResponse(response) {
  if (!Array.isArray(response?.items) || typeof response.hasMore !== 'boolean') {
    throw new Error('Invalid payout list response')
  }

  return response
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find(part => part.type === 'year').value
  const month = parts.find(part => part.type === 'month').value

  return `${year}-${month}`
}

export function MonthlyPayoutsPage() {
  const { t, formatNumber } = useLocale()
  const m = key => t(`adminPayouts.${key}`)

  const [filters, setFilters] = useState(() => ({
    periodId: currentPeriod(),
    status: '',
    search: '',
    latestResult: '',
    page: 1,
  }))

  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  const [reportVersion, setReportVersion] = useState(0)

  const query = new URLSearchParams({
    periodId: filters.periodId,
    page: String(filters.page),
  })

  if (filters.status) {
    query.set('status', filters.status)
  }
  if (filters.search) query.set('search', filters.search)
  if (filters.latestResult) query.set('latestResult', filters.latestResult)

  const feed = useBackendResource(`/admin/monthly-payouts?${query}`, empty, selectResponse)

  const loading = feed.status === 'loading'
  const ready = feed.status === 'ready'

  function applyFilters(event) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    setNotice('')
    setFilters({
      periodId: String(form.get('periodId')),
      status: String(form.get('status') ?? ''),
      search: String(form.get('search') ?? '').trim(),
      latestResult: String(form.get('latestResult') ?? ''),
      page: 1,
    })
  }

  function openGenerate() {
    setNotice('')
    setAction({
      type: 'generate',
      periodId: filters.periodId,
    })
  }

  function openResult(row, result) {
    setNotice('')
    setAction({
      type: 'result',
      row,
      result,
    })
  }

  function handleActionSaved() {
    setAction(null)
    setNotice(m('success'))
    setReportVersion(previous => previous + 1)
    feed.retry()
  }

  function changePage(offset) {
    setFilters(previous => ({
      ...previous,
      page: previous.page + offset,
    }))
  }

  return (
    <AdminLayout>
      <div className="page-admin min-w-0 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('hint')}</p>
          </div>

          <Button type="button" onClick={openGenerate}>
            {m('generate')} — {filters.periodId}
          </Button>
        </div>

        {notice && (
          <p role="status" className="mt-4 text-sm">
            {notice}
          </p>
        )}

        <Card className="mt-6">
          <form className="flex flex-wrap items-end gap-3" onSubmit={applyFilters}>
            <label className="w-full min-w-0 text-sm font-medium sm:min-w-48 sm:flex-1">
              {t('financeReports.searchPayout')}
              <Input
                className="mt-1 w-full"
                name="search"
                type="search"
                maxLength={100}
                placeholder={t('financeReports.searchPlaceholder')}
                defaultValue=""
              />
            </label>
            <label className="text-sm font-medium">
              {m('period')}
              <Input
                className="mt-1"
                name="periodId"
                type="month"
                required
                defaultValue={filters.periodId}
              />
            </label>

            <label className="text-sm font-medium">
              <span className="pr-2">{m('status')}</span>
              <Select className="mt-1" name="status" defaultValue="">
                <option value="">{m('all')}</option>
                <option value="pending">{m('pending')}</option>
                <option value="paid">{m('paid')}</option>
              </Select>
            </label>

            <label className="text-sm font-medium">
              <span className="pr-2">{m('latest')}</span>
              <Select className="mt-1" name="latestResult" defaultValue="">
                <option value="">{m('all')}</option>
                <option value="Failed">{t('financeReports.failedOnly')}</option>
              </Select>
            </label>
            <Button type="submit">{m('apply')}</Button>

            <Button type="button" variant="secondary" disabled={loading} onClick={feed.retry}>
              {m('reload')}
            </Button>
            <FinanceExportButton
              path={`/admin/monthly-payouts?${query}`}
              filename={`chi-tra-${filters.periodId}.csv`}
              disabled={!ready || feed.data.totalItems === 0}
              headers={['author', 'coins', 'money', 'bank', 'status', 'latest'].map(m)}
              mapRow={row => [
                row.displayName,
                row.amountCoins,
                row.payoutSlipAmountVnd,
                row.bankDetails
                  ? `${row.bankDetails.bankName} / ${row.bankDetails.accountNumber} / ${row.bankDetails.accountHolder}`
                  : m('missingBank'),
                m(row.status),
                row.latestResult
                  ? m(row.latestResult.result === 'Paid' ? 'paid' : 'failed')
                  : m('notAttempted'),
              ]}
            />
          </form>
          <p className="mt-3 text-xs text-muted">{t('financeReports.filterHint')}</p>
        </Card>

        <h2 className="mt-8 text-h2">{t('adminRevenue.payoutListTitle')}</h2>

        {ready && feed.data.summary && <PayoutSummary summary={feed.data.summary} />}

        {loading && (
          <p className="mt-6 text-muted" role="status">
            {m('loading')}
          </p>
        )}

        {!loading && !ready && (
          <Card className="mt-6">
            <p role="alert">{m('error')}</p>
            <Button type="button" className="mt-3" variant="secondary" onClick={feed.retry}>
              {m('reload')}
            </Button>
          </Card>
        )}

        {ready && (
          <Card className="mt-6 min-w-0 max-w-full">
            <p className="mb-3 text-xs text-muted">
              {t('financeReports.matchCount', { count: feed.data.totalItems })}
            </p>
            {feed.data.items.length === 0 ? (
              <p className="text-muted">{m('empty')}</p>
            ) : (
              <div
                className="relative isolate max-w-full overflow-x-auto overscroll-x-contain"
                role="region"
                aria-label={t('adminRevenue.payoutListTitle')}
                tabIndex={0}
              >
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      {columns.map(key => (
                        <th
                          key={key}
                          scope="col"
                          className={
                            key === 'actions'
                              ? 'sticky right-0 z-20 min-w-[12rem] border-l border-line bg-surface px-4 py-3 shadow-[-6px_0_12px_-10px_var(--text-primary)]'
                              : 'px-3 py-3'
                          }
                        >
                          {m(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {feed.data.items.map(row => (
                      <tr key={row.withdrawalId} className="border-b border-line align-top">
                        <td className="min-w-[10rem] px-3 py-4">
                          {row.displayName || row.accountId || '—'}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                          {formatNumber(row.amountCoins)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                          {formatNumber(row.payoutSlipAmountVnd)}
                        </td>

                        <td className="min-w-[12rem] px-3 py-4">
                          {row.bankDetails ? (
                            <>
                              <p>{row.bankDetails.bankName}</p>
                              <p>{row.bankDetails.accountNumber}</p>
                              <p className="mt-1 text-muted">{row.bankDetails.accountHolder}</p>
                            </>
                          ) : (
                            m('missingBank')
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">{m(row.status)}</td>

                        <td className="min-w-[10rem] max-w-xs break-words px-3 py-4">
                          {row.latestResult ? (
                            <>
                              <p>{m(row.latestResult.result === 'Paid' ? 'paid' : 'failed')}</p>
                              {row.latestResult.note && (
                                <p className="mt-1 text-muted">{row.latestResult.note}</p>
                              )}
                            </>
                          ) : (
                            m('notAttempted')
                          )}
                        </td>

                        <td className="sticky right-0 z-10 min-w-[12rem] border-l border-line bg-surface px-4 py-4 shadow-[-6px_0_12px_-10px_var(--text-primary)]">
                          {row.status === 'pending' ? (
                            <div className="flex flex-col items-stretch gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openResult(row, 'Paid')}
                              >
                                {m('simulatePaid')}
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => openResult(row, 'Failed')}
                              >
                                {m('simulateFailed')}
                              </Button>
                            </div>
                          ) : (
                            m('paid')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={filters.page === 1}
                onClick={() => changePage(-1)}
              >
                {m('previous')}
              </Button>

              <span className="text-sm text-muted">
                {t('adminPayouts.page', { page: filters.page })}
              </span>

              <Button
                type="button"
                variant="secondary"
                disabled={!feed.data.hasMore}
                onClick={() => changePage(1)}
              >
                {m('next')}
              </Button>
            </div>
          </Card>
        )}

        <AuthorRevenuePanel
          key={`${filters.periodId}:${reportVersion}`}
          periodId={filters.periodId}
        />
      </div>

      {action && (
        <PayoutActionDialog
          action={action}
          onClose={() => setAction(null)}
          onSaved={handleActionSaved}
        />
      )}
    </AdminLayout>
  )
}
