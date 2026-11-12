import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Modal } from '../ui'

export function BankTransactionDetailsDialog({ id, onClose, onResolve }) {
  const { t, formatNumber, formatDate } = useLocale()
  const m = key => t(`financialTransactions.${key}`)
  const feed = useBackendDocument(`/admin/transactions/${id}/details`, null)
  const data = feed.data
  return (
    <Modal open title={m('detailTitle')} onClose={onClose} className="sm:max-w-2xl">
      {feed.status === 'loading' ? (
        <p role="status">{m('loading')}</p>
      ) : feed.status !== 'ready' || !data ? (
        <div>
          <p role="alert">{m('loadError')}</p>
          <Button onClick={feed.retry}>{m('reload')}</Button>
        </div>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ['reference', data.reference],
              ['amount', formatNumber(data.amount) + ' VND'],
              ['date', formatDate(data.occurredAt)],
              ['status', m(data.status)],
              ['originalStatus', m(data.originalStatus)],
              ['paymentCode', data.paymentCode ?? '—'],
              ['content', data.content],
              [
                'matchedOrder',
                data.order
                  ? `${data.order.paymentCode} · ${formatNumber(data.order.priceVnd)} VND · ${m(data.order.status)}`
                  : '—',
              ],
              ['reader', data.reader ? `${data.reader.displayName} · ${data.reader.email}` : '—'],
              ['reason', data.resolutionReason ?? '—'],
              [
                'adjustment',
                data.adjustment ? `${formatNumber(data.adjustment.amountCoins)} ${m('coin')}` : '—',
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-muted">{m(label)}</dt>
                <dd className="mt-1 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {data.canResolve && (
            <Button className="mt-5" onClick={() => onResolve(data)}>
              {m('resolve')}
            </Button>
          )}
        </>
      )}
    </Modal>
  )
}
