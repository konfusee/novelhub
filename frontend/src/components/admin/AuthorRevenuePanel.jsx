import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card } from '../ui'

const empty = {
  summary: {},
  topAuthors: [],
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
    typeof response.hasMore !== 'boolean' ||
    metrics.some(
      ([key]) =>
        !Number.isSafeInteger(response.summary[key]) ||
        response.summary[key] < 0,
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

  const query = new URLSearchParams({
    periodId,
    page: String(page),
  })

  const feed = useBackendResource(
    `/admin/author-revenue?${query}`,
    empty,
    selectResponse,
  )

  const loading = feed.status === 'loading'
  const ready = feed.status === 'ready'

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2">{m('title')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            {t('adminRevenue.hint', { period: periodId })}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={feed.retry}
        >
          {t('adminPayouts.reload')}
        </Button>
      </div>

      {loading && (
        <p role="status" className="mt-4 text-muted">
          {t('adminPayouts.loading')}
        </p>
      )}

      {!loading && !ready && (
        <Card className="mt-4">
          <p role="alert">{m('error')}</p>
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            onClick={feed.retry}
          >
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

          <div className="nh-grid-12 mt-5">
            <Card className="col-span-12 xl:col-span-8">
              <h3 className="text-h3">{m('tableTitle')}</h3>

              {feed.data.items.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  {m('empty')}
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        {[
                          'author',
                          'monthlyRevenue',
                          'balance',
                          'earningEvents',
                        ].map(key => (
                          <th
                            key={key}
                            scope="col"
                            className="px-3 py-3"
                          >
                            {m(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {feed.data.items.map(row => (
                        <tr
                          key={row.accountId}
                          className="border-b border-line"
                        >
                          <td className="px-3 py-4">
                            {row.displayName || row.accountId}
                          </td>

                          {[
                            'monthlyRevenueCoins',
                            'balanceCoins',
                            'earningEvents',
                          ].map(field => (
                            <td
                              key={field}
                              className="px-3 py-4 tabular-nums"
                            >
                              {formatNumber(row[field])}
                            </td>
                          ))}
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
                  disabled={page === 1}
                  onClick={() => setPage(previous => previous - 1)}
                >
                  {t('adminPayouts.previous')}
                </Button>

                <span className="text-sm text-muted">
                  {t('adminPayouts.page', { page })}
                </span>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={!feed.data.hasMore}
                  onClick={() => setPage(previous => previous + 1)}
                >
                  {t('adminPayouts.next')}
                </Button>
              </div>
            </Card>

            <Card className="col-span-12 xl:col-span-4">
              <h3 className="text-h3">{m('topTitle')}</h3>
              <p className="mt-2 text-sm text-muted">
                {m('topHint')}
              </p>

              {feed.data.topAuthors.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  {m('emptyTop')}
                </p>
              ) : (
                <ol className="mt-4 divide-y divide-line">
                  {feed.data.topAuthors.map((author, index) => (
                    <li
                      key={author.accountId}
                      className="flex items-start gap-3 py-4"
                    >
                      <span className="font-semibold text-brand">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium">
                          {author.displayName || author.accountId}
                        </p>
                        <p className="mt-1 text-sm text-muted tabular-nums">
                          {t('adminRevenue.coinAmount', {
                            amount: formatNumber(
                              author.monthlyRevenueCoins,
                            ),
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
    </section>
  )
}