import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card, Input, Select } from '../ui'
import { Pagination } from '../ui/Pagination'
import { AuthorRevenueDetails } from './AuthorRevenueDetails'
import { AuthorRevenueTrend } from './AuthorRevenueTrend'
import { FinanceExportButton } from './FinanceExportButton'

const empty = {
  summary: {},
  topAuthors: [],
  trend: [],
  items: [],
  hasMore: false,
}

const metrics = [
  ['totalRevenueCoins', 'totalRevenue'],
  ['earningAuthors', 'earningAuthors'],
  ['totalAuthors', 'totalAuthors'],
]

function selectResponse(response) {
  if (
    !response?.summary ||
    !Array.isArray(response.items) ||
    !Array.isArray(response.topAuthors) ||
    !Array.isArray(response.trend) ||
    typeof response.hasMore !== 'boolean' ||
    metrics.some(
      ([key]) => !Number.isSafeInteger(response.summary[key]) || response.summary[key] < 0,
    )
  ) {
    throw new Error('Invalid author revenue response')
  }

  return response
}

export function AuthorRevenuePanel({ periodId }) {
  const { t, formatNumber } = useLocale()
  const m = key => t(`adminRevenue.${key}`)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', activity: 'all', sort: 'revenue' })
  const [selectedAuthor, setSelectedAuthor] = useState(null)

  const query = new URLSearchParams({
    periodId,
    page: String(page),
    ...filters,
  })

  const feed = useBackendResource(`/admin/author-revenue?${query}`, empty, selectResponse)

  const loading = feed.status === 'loading'
  const ready = feed.status === 'ready'

  function applyFilters(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      search: String(form.get('search') ?? '').trim(),
      activity: String(form.get('activity')),
      sort: String(form.get('sort')),
    })
    setPage(1)
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2">{m('title')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            {t('adminRevenue.hint', { period: periodId })}
          </p>
        </div>

        <Button type="button" variant="secondary" disabled={loading} onClick={feed.retry}>
          {t('adminPayouts.reload')}
        </Button>
      </div>

      <Card className="mt-5">
        <form className="flex flex-wrap items-end gap-3" onSubmit={applyFilters}>
          <label className="w-full min-w-0 text-sm font-medium sm:min-w-48 sm:flex-1">
            {t('financeReports.searchAuthor')}
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
            {t('financeReports.activity')}
            <Select className="mt-1" name="activity" defaultValue="all">
              <option value="all">{t('adminPayouts.all')}</option>
              <option value="earning">{t('financeReports.earningOnly')}</option>
            </Select>
          </label>
          <label className="text-sm font-medium">
            {t('financeReports.sort')}
            <Select className="mt-1" name="sort" defaultValue="revenue">
              {['revenue', 'balance', 'name'].map(value => (
                <option key={value} value={value}>
                  {t(`financeReports.sort_${value}`)}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit">{t('adminPayouts.apply')}</Button>
          <FinanceExportButton
            path={`/admin/author-revenue?${query}`}
            filename={`doanh-thu-tac-gia-${periodId}.csv`}
            disabled={!ready || feed.data.totalItems === 0}
            headers={['author', 'monthlyRevenue', 'balance', 'earningEvents'].map(m)}
            mapRow={row => [
              row.displayName,
              row.monthlyRevenueCoins,
              row.balanceCoins,
              row.earningEvents,
            ]}
          />
        </form>
        <p className="mt-3 text-xs text-muted">{t('financeReports.filterHint')}</p>
      </Card>

      {loading && (
        <p role="status" className="mt-4 text-muted">
          {t('adminPayouts.loading')}
        </p>
      )}

      {!loading && !ready && (
        <Card className="mt-4">
          <p role="alert">{m('error')}</p>
          <Button type="button" className="mt-3" variant="secondary" onClick={feed.retry}>
            {t('adminPayouts.reload')}
          </Button>
        </Card>
      )}

      {ready && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {metrics.map(([field, label]) => (
              <Card key={field}>
                <p className="text-sm text-muted">{m(label)}</p>
                <strong className="mt-3 block text-h2 tabular-nums">
                  {formatNumber(feed.data.summary[field])}
                </strong>
              </Card>
            ))}
          </div>

          <AuthorRevenueTrend items={feed.data.trend} />

          <div className="nh-grid-12 mt-5">
            <Card className="col-span-12 xl:col-span-8">
              <h3 className="text-h3">{m('tableTitle')}</h3>
              <p className="mt-2 text-xs text-muted">
                {t('financeReports.matchCount', { count: feed.data.totalItems })}
              </p>

              {feed.data.items.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{m('empty')}</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        {['author', 'monthlyRevenue', 'balance', 'earningEvents'].map(key => (
                          <th key={key} scope="col" className="px-3 py-3">
                            {m(key)}
                            {key === 'balance' && (
                              <p className="mt-1 text-xs font-normal text-muted">
                                {t('financeReports.balanceHint')}
                              </p>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {feed.data.items.map(row => (
                        <tr key={row.accountId} className="border-b border-line">
                          <td className="px-3 py-4">
                            <button
                              type="button"
                              className="text-left font-semibold text-brand underline-offset-4 hover:underline"
                              onClick={() => setSelectedAuthor(row)}
                            >
                              {row.displayName || row.accountId}
                            </button>
                          </td>

                          {['monthlyRevenueCoins', 'balanceCoins', 'earningEvents'].map(field => (
                            <td key={field} className="px-3 py-4 tabular-nums">
                              {formatNumber(row[field])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Pagination
                page={page}
                pageCount={Math.ceil(feed.data.totalItems / feed.data.pageSize)}
                onChange={setPage}
              />
            </Card>

            <Card className="col-span-12 xl:col-span-4">
              <h3 className="text-h3">{m('topTitle')}</h3>
              <p className="mt-2 text-sm text-muted">{m('topHint')}</p>

              {feed.data.topAuthors.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{m('emptyTop')}</p>
              ) : (
                <ol className="mt-4 divide-y divide-line">
                  {feed.data.topAuthors.map((author, index) => (
                    <li key={author.accountId} className="flex items-start gap-3 py-4">
                      <span className="font-semibold text-brand">{index + 1}</span>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="break-words text-left font-medium text-brand hover:underline"
                          onClick={() => setSelectedAuthor(author)}
                        >
                          {author.displayName || author.accountId}
                        </button>
                        <p className="mt-1 text-sm text-muted tabular-nums">
                          {t('adminRevenue.coinAmount', {
                            amount: formatNumber(author.monthlyRevenueCoins),
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </>
      )}
      {selectedAuthor && (
        <AuthorRevenueDetails
          key={`${selectedAuthor.accountId}:${periodId}`}
          author={selectedAuthor}
          periodId={periodId}
          onClose={() => setSelectedAuthor(null)}
        />
      )}
    </section>
  )
}
