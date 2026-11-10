import { useState } from 'react'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Modal } from '../ui'
import { Pagination } from '../ui/Pagination'

const empty = { items: [], totalItems: 0, pageSize: 7, revenueCoins: 0 }
const time = value =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))

export function AuthorRevenueDetails({ author, periodId, onClose }) {
  const { t, formatNumber } = useLocale()
  const [page, setPage] = useState(1)
  const feed = useBackendDocument(
    `/admin/author-revenue/${author.accountId}?${new URLSearchParams({ periodId, page: String(page) })}`,
    empty,
  )
  const ready = feed.status === 'ready'
  return (
    <Modal
      open
      title={t('financeReports.detailTitle', { name: author.displayName })}
      onClose={onClose}
      className="max-w-6xl"
    >
      <p className="text-sm text-muted">{t('financeReports.detailHint', { period: periodId })}</p>
      {feed.status === 'loading' && (
        <p role="status" className="mt-4">
          {t('adminPayouts.loading')}
        </p>
      )}
      {!ready && feed.status !== 'loading' && (
        <div className="mt-4">
          <p role="alert">{t('financeReports.detailError')}</p>
          <Button className="mt-3" variant="secondary" onClick={feed.retry}>
            {t('adminPayouts.reload')}
          </Button>
        </div>
      )}
      {ready && (
        <>
          <p className="mt-4 font-semibold">
            {t('financeReports.detailTotal', {
              amount: formatNumber(feed.data.revenueCoins),
              count: feed.data.totalItems,
            })}
          </p>
          {feed.data.items.length === 0 ? (
            <p className="mt-4 text-muted">{t('financeReports.noTransactions')}</p>
          ) : (
            <div
              className="mt-4 overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label={t('financeReports.transactions')}
            >
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {[
                      'time',
                      'story',
                      'chapter',
                      'price',
                      'authorShare',
                      'platformShare',
                      'transactionId',
                    ].map(key => (
                      <th scope="col" key={key} className="px-3 py-3">
                        {t(`financeReports.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feed.data.items.map(row => (
                    <tr key={row.ledgerEntryId} className="border-b border-line align-top">
                      <td className="whitespace-nowrap px-3 py-4">{time(row.occurredAt)}</td>
                      <td className="px-3 py-4">
                        {row.storyTitle ?? t('financeReports.unavailable')}
                      </td>
                      <td className="px-3 py-4">
                        {row.chapterTitle ?? t('financeReports.unavailable')}
                      </td>
                      {[row.priceCoins, row.authorCoins, row.platformCoins].map((amount, index) => (
                        <td key={index} className="px-3 py-4 tabular-nums">
                          {amount === null ? '—' : formatNumber(amount)}
                        </td>
                      ))}
                      <td className="px-3 py-4">
                        <span className="block font-mono text-xs">{row.ledgerEntryId}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {t('financeReports.purchaseId')}: {row.purchaseId}
                        </span>
                      </td>
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
        </>
      )}
    </Modal>
  )
}
