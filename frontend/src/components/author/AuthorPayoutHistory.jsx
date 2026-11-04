import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card } from '../ui'

const empty = {
  items: [],
  hasMore: false,
}

const columns = [
  'period',
  'coins',
  'money',
  'status',
  'latestResult',
  'processedAt',
]

function selectResponse(response) {
  if (
    !Array.isArray(response?.items) ||
    typeof response.hasMore !== 'boolean'
  ) {
    throw new Error('Invalid author payout history response')
  }

  return response
}

export function AuthorPayoutHistory() {
  const { t, formatNumber, formatDate } = useLocale()
  const m = key => t(`authorPayouts.${key}`)

  const [page, setPage] = useState(1)

  const feed = useBackendResource(
    `/author/payouts?page=${page}`,
    empty,
    selectResponse,
  )

  const loading = feed.status === 'loading'
  const ready = feed.status === 'ready'

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h3">{m('title')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            {m('hint')}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={feed.retry}
        >
          {m('reload')}
        </Button>
      </div>

      {loading && (
        <p role="status" className="mt-5 text-sm text-muted">
          {m('loading')}
        </p>
      )}

      {!loading && !ready && (
        <p role="alert" className="mt-5 text-sm">
          {m('error')}
        </p>
      )}

      {ready && (
        <>
          {feed.data.items.length === 0 ? (
            <p className="mt-5 text-sm text-muted">
              {m('empty')}
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {columns.map(key => (
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
                      key={row.withdrawalId}
                      className="border-b border-line align-top"
                    >
                      <td className="px-3 py-4">
                        {row.periodId}
                      </td>

                      <td className="px-3 py-4 tabular-nums">
                        {formatNumber(row.amountCoins)}
                      </td>

                      <td className="px-3 py-4 tabular-nums">
                        {formatNumber(row.payoutSlipAmountVnd)}
                      </td>

                      <td className="px-3 py-4">
                        {m(row.status)}
                      </td>

                      <td className="px-3 py-4">
                        {row.latestResult
                          ? m(
                              row.latestResult.result === 'Paid'
                                ? 'success'
                                : 'failed',
                            )
                          : m('notAttempted')}
                      </td>

                      <td className="px-3 py-4">
                        {row.latestResult ? (
                          <time dateTime={row.latestResult.occurredAt}>
                            {formatDate(row.latestResult.occurredAt)}
                          </time>
                        ) : (
                          '—'
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
              disabled={page === 1}
              onClick={() => setPage(previous => previous - 1)}
            >
              {m('previous')}
            </Button>

            <span className="text-sm text-muted">
              {t('authorPayouts.page', { page })}
            </span>

            <Button
              type="button"
              variant="secondary"
              disabled={!feed.data.hasMore}
              onClick={() => setPage(previous => previous + 1)}
            >
              {m('next')}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}