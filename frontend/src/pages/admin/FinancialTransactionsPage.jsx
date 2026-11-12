import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { BankResolutionDialog } from '../../components/admin/BankResolutionDialog'
import { Button, Card, Input, Select } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'
import { AdminLayout } from '../../layouts'

const empty = { items: [], hasMore: false }
const emptyStatistics = {
  registeredAccounts: 0,
  purchasedChapters: 0,
  unlockCoins: 0,
  unresolvedPayments: 0,
}
function selectTransactions(response) {
  if (
    !Array.isArray(response?.items) ||
    typeof response.hasMore !== 'boolean' ||
    response.items.some(
      row =>
        !row.id || !Number.isSafeInteger(row.amount) || !Number.isFinite(+new Date(row.occurredAt)),
    )
  )
    throw new Error('Invalid transaction response')
  return response
}
function selectStatistics(response) {
  if (
    !response ||
    Object.keys(emptyStatistics).some(
      key => !Number.isSafeInteger(response[key]) || response[key] < 0,
    )
  )
    throw new Error('Invalid financial statistics')
  return response
}
const statuses = ['matched', 'unmatched', 'amount-mismatch', 'expired', 'already-paid', 'resolved']

export function FinancialTransactionsPage() {
  const { t, formatNumber, formatDate } = useLocale()
  const m = key => t(`financialTransactions.${key}`)
  const [filters, setFilters] = useState({ source: 'ledger', search: '', status: '', page: 1 })
  const [draftSource, setDraftSource] = useState('ledger')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
  const feed = useBackendResource(`/admin/transactions?${query}`, empty, selectTransactions)
  const statistics = useBackendResource(
    `/admin/transactions/statistics?${query}`,
    emptyStatistics,
    selectStatistics,
  )
  const bank = filters.source === 'bank'
  function filter(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    if (values.source !== 'bank') delete values.status
    if (values.from) values.from = new Date(`${values.from}T00:00:00+07:00`).toISOString()
    if (values.to)
      values.to = new Date(+new Date(`${values.to}T00:00:00+07:00`) + 24 * 3600_000).toISOString()
    setFilters({ ...values, page: 1 })
  }
  return (
    <AdminLayout>
      <div className="page-admin min-w-0 py-6">
        <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
        <p className="mt-2 text-sm text-muted">{m('hint')}</p>
        {notice && (
          <p role="status" className="mt-4">
            {notice}
          </p>
        )}
        <section
          aria-label={m('statistics')}
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {statistics.status === 'ready' &&
            Object.keys(emptyStatistics).map(key => (
              <Card key={key}>
                <p className="text-sm text-muted">{m(key)}</p>
                <p className="mt-2 text-h2 tabular-nums">{formatNumber(statistics.data[key])}</p>
              </Card>
            ))}
          {statistics.status === 'error' && <p role="alert">{m('loadError')}</p>}
        </section>
        <Card className="mt-6 min-w-0">
          <form
            className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-6"
            onSubmit={filter}
          >
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium xl:col-span-2">
              {m('source')}
              <Select
                className="w-full"
                name="source"
                value={draftSource}
                onChange={event => setDraftSource(event.target.value)}
              >
                <option value="ledger">{m('ledger')}</option>
                <option value="bank">{m('bank')}</option>
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium xl:col-span-4">
              {m('search')}
              <Input className="w-full" type="search" name="search" maxLength={100} />
            </label>
            {draftSource === 'bank' && (
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium xl:col-span-2">
                {m('status')}
                <Select className="w-full" name="status" defaultValue="">
                  <option value="">{m('all')}</option>
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {m(status)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium xl:col-span-2">
              {m('from')}
              <Input
                className="w-full"
                type="date"
                name="from"
                value={fromDate}
                max={toDate || undefined}
                onChange={event => setFromDate(event.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium xl:col-span-2">
              {m('to')}
              <Input
                className="w-full"
                type="date"
                name="to"
                value={toDate}
                min={fromDate || undefined}
                onChange={event => setToDate(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-6">
              <Button type="submit">{m('apply')}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  feed.retry()
                  statistics.retry()
                }}
              >
                {m('reload')}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-xs leading-5 text-muted">{m('statisticsHint')}</p>
        </Card>
        <Card className="mt-6 min-w-0 max-w-full">
          <h2 className="text-h3">{m(bank ? 'bank' : 'ledger')}</h2>
          {feed.status === 'loading' ? (
            <p role="status" className="mt-6">
              {m('loading')}
            </p>
          ) : feed.status === 'error' ? (
            <p role="alert" className="mt-6">
              {m('loadError')}
            </p>
          ) : (
            <>
              <div
                className="relative isolate mt-4 max-w-full overflow-x-auto overscroll-x-contain"
                role="region"
                aria-label={m('title')}
                tabIndex={0}
              >
                <table className="w-full min-w-[950px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-36" />
                    <col className="w-40" />
                    <col className="w-72" />
                    <col className="w-36" />
                    <col className="w-52" />
                    {bank && <col className="w-32" />}
                  </colgroup>
                  <thead className="bg-elevated">
                    <tr className="border-b border-line">
                      {[
                        'date',
                        bank ? 'reference' : 'owner',
                        bank ? 'content' : 'type',
                        'amount',
                        bank ? 'status' : 'wallet',
                        ...(bank ? ['actions'] : []),
                      ].map(key => (
                        <th
                          key={key}
                          scope="col"
                          className={`px-3 py-3 whitespace-nowrap ${key === 'actions' ? 'sticky right-0 z-20 border-l border-line bg-elevated' : ''}`}
                        >
                          {m(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feed.data.items.map(row => (
                      <tr key={row.id} className="border-b border-line align-top">
                        <td className="px-3 py-4 whitespace-nowrap">
                          {formatDate(row.occurredAt)}
                        </td>
                        <td className="break-words px-3 py-4">
                          {bank ? row.reference : row.owner || m('platform')}
                        </td>
                        <td className="max-w-72 break-words px-3 py-4">
                          {bank ? (
                            row.content
                          ) : (
                            <>
                              {m(row.type)}
                              <p className="mt-1 text-xs leading-5 text-muted">{row.reason}</p>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap tabular-nums">
                          {!bank && (row.direction === 'debit' ? '−' : '+')}
                          {formatNumber(row.amount)} {m(bank ? 'vnd' : 'coin')}
                        </td>
                        <td className="px-3 py-4">
                          {bank ? (
                            <>
                              {m(row.status)}
                              <p className="mt-1 text-muted">{row.resolutionReason}</p>
                            </>
                          ) : (
                            <>
                              <p>{m(row.purpose)}</p>
                              <details className="mt-2 text-xs text-muted">
                                <summary className="cursor-pointer">{m('walletId')}</summary>
                                <code className="mt-1 block break-all">{row.walletId}</code>
                              </details>
                            </>
                          )}
                        </td>
                        {bank && (
                          <td className="sticky right-0 z-10 border-l border-line bg-surface px-3 py-4">
                            {row.canResolve && (
                              <Button type="button" size="sm" onClick={() => setAction(row)}>
                                {m('resolve')}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!feed.data.items.length && <p className="py-6 text-sm text-muted">{m('empty')}</p>}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  disabled={filters.page === 1}
                  onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}
                >
                  {m('previous')}
                </Button>
                <span>{filters.page}</span>
                <Button
                  variant="secondary"
                  disabled={!feed.data.hasMore}
                  onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}
                >
                  {m('next')}
                </Button>
              </div>
            </>
          )}
        </Card>
        {action && (
          <BankResolutionDialog
            row={action}
            onClose={() => setAction(null)}
            onSaved={() => {
              setAction(null)
              setNotice(m('saved'))
              feed.retry()
              statistics.retry()
            }}
          />
        )}
      </div>
    </AdminLayout>
  )
}
