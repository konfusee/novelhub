import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card } from '../ui'

const empty = { items: [], hasMore: false }
const select = response => {
  if (!Array.isArray(response?.items) || typeof response.hasMore !== 'boolean')
    throw new Error('Invalid orders')
  return response
}
export function PendingTopUps({ onOpen, revision }) {
  const { t, formatNumber, formatDate } = useLocale()
  const m = key => t(`walletFlow.${key}`)
  const [page, setPage] = useState(1)
  const feed = useBackendResource(`/reader/top-up-orders?page=${page}`, empty, select)
  // A new instance after creating/confirming an order refreshes server state.
  return (
    <Card className="min-w-0" data-revision={revision}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">{m('pendingTitle')}</h2>
        <Button variant="secondary" onClick={feed.retry} disabled={feed.status === 'loading'}>
          {m('reload')}
        </Button>
      </div>
      {feed.status === 'loading' ? (
        <p role="status" className="mt-4">
          {m('loading')}
        </p>
      ) : feed.status === 'error' ? (
        <p role="alert" className="mt-4">
          {m('error')}
        </p>
      ) : (
        <>
          {!feed.data.items.length && <p className="mt-4 text-sm text-muted">{m('noPending')}</p>}
          <ul className="mt-4 divide-y divide-line">
            {feed.data.items.map(order => (
              <li key={order.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {order.paymentCode} · {formatNumber(order.priceVnd)} VND
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {m(order.reviewState !== 'no-payment' ? order.reviewState : order.status)} ·{' '}
                    {formatDate(order.expiresAt)}
                  </p>
                  {order.reviewState !== 'no-payment' && (
                    <p className="mt-2 max-w-xl text-sm text-muted">{m('doNotRepay')}</p>
                  )}
                </div>
                <Button variant="secondary" onClick={() => onOpen(order.id)}>
                  {m('openOrder')}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(value => value - 1)}
            >
              {m('previous')}
            </Button>
            <span className="self-center">{page}</span>
            <Button
              variant="secondary"
              disabled={!feed.data.hasMore}
              onClick={() => setPage(value => value + 1)}
            >
              {m('next')}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
