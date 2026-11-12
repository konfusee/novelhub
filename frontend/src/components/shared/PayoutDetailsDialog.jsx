import { PayoutBankCorrectionForm } from '../admin/PayoutBankCorrectionForm'
import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Modal } from '../ui'

const empty = { items: [], hasMore: false }
const select = response => {
  if (!Array.isArray(response?.items) || typeof response.hasMore !== 'boolean')
    throw new Error('Invalid payout details')
  return response
}
export function PayoutDetailsDialog({ withdrawalId, role, onClose }) {
  const { t, formatNumber, formatDate } = useLocale()
  const m = key => t(`payoutDetails.${key}`)
  const [page, setPage] = useState(1)
  const path = role === 'admin' ? '/admin/monthly-payouts' : '/author/payouts'
  const feed = useBackendResource(`${path}/${withdrawalId}/history?page=${page}`, empty, select)
  return (
    <Modal open title={m('title')} onClose={onClose} className="sm:max-w-3xl">
      {feed.status === 'loading' ? (
        <p role="status">{m('loading')}</p>
      ) : feed.status === 'error' ? (
        <p role="alert">
          {m('error')}{' '}
          <Button variant="secondary" onClick={feed.retry}>
            {m('reload')}
          </Button>
        </p>
      ) : (
        <>
          <p>
            {feed.data.periodId} · {formatNumber(feed.data.amountCoins)} {t('wallet.coinUnit')} ·{' '}
            {t('adminPayouts.' + feed.data.status)}
          </p>
          {feed.data.bankDetails && (
            <p className="mt-2 text-sm text-muted">
              {feed.data.bankDetails.bankName} · {feed.data.bankDetails.accountNumber} ·{' '}
              {feed.data.bankDetails.accountHolder}
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-muted">{m('hint')}</p>
          <div className="mt-4 max-h-[55vh] overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {['date', 'result', 'actor', 'evidence'].map(key => (
                    <th key={key} scope="col" className="px-3 py-3">
                      {m(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feed.data.items.map(row => (
                  <tr key={row.id} className="border-b border-line align-top">
                    <td className="px-3 py-3">
                      <time dateTime={row.occurredAt}>{formatDate(row.occurredAt)}</time>
                    </td>
                    <td className="px-3 py-3">
                      {t('platformFinance.' + row.result)}
                      <p className="mt-1 text-xs text-muted">{t('platformFinance.' + row.mode)}</p>
                    </td>
                    <td className="px-3 py-3">
                      {row.actorName ?? m(row.actorType === 'system' ? 'system' : 'staff')}
                    </td>
                    <td className="max-w-xs break-words px-3 py-3">
                      <p className="break-all">{row.transferReference ?? '—'}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{row.note}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {role === 'admin' && feed.data.canCorrectBank && (
            <PayoutBankCorrectionForm
              withdrawalId={withdrawalId}
              version={feed.data.version}
              onSaved={feed.retry}
            />
          )}
          {!feed.data.items.length && <p className="mt-4 text-muted">{m('empty')}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(value => value - 1)}
            >
              {t('walletFlow.previous')}
            </Button>
            <span className="self-center">{page}</span>
            <Button
              variant="secondary"
              disabled={!feed.data.hasMore}
              onClick={() => setPage(value => value + 1)}
            >
              {t('walletFlow.next')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
