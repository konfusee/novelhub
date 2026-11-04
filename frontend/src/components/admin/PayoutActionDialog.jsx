import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, Modal } from '../ui'

export function PayoutActionDialog({ action, onClose, onSaved }) {
  const { t, formatNumber } = useLocale()
  const m = key => t(`adminPayouts.${key}`)

  const generating = action.type === 'generate'
  const periodId = action.periodId

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState({
    status: 'loading',
    data: null,
  })

  const inFlight = useRef(false)
  const [resultEntryKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    if (!generating) return

    const controller = new AbortController()
    const query = new URLSearchParams({ periodId })

    apiRequest(`/admin/monthly-payouts/preview?${query}`, {
      signal: controller.signal,
    })
      .then(data => {
        if (controller.signal.aborted) return

        if (
          !Array.isArray(data?.items) ||
          typeof data.previewHash !== 'string'
        ) {
          throw new Error('Invalid payout preview response')
        }

        setPreview({ status: 'ready', data })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreview({ status: 'error', data: null })
        }
      })

    return () => controller.abort()
  }, [generating, periodId, attempt])

  function reloadPreview() {
    if (inFlight.current) return

    setError('')
    setStale(false)
    setPreview({ status: 'loading', data: null })
    setAttempt(previous => previous + 1)
  }

  const canConfirm =
    !busy &&
    (!generating ||
      (preview.status === 'ready' &&
        preview.data.items.length > 0 &&
        !stale))

  async function submit(event) {
    event.preventDefault()

    if (inFlight.current || !canConfirm) return

    inFlight.current = true
    setBusy(true)
    setError('')

    try {
      if (generating) {
        await apiRequest('/admin/monthly-payouts/generate', {
          method: 'POST',
          body: {
            periodId,
            previewHash: preview.data.previewHash,
          },
        })
      } else {
        await apiRequest(
          `/admin/monthly-payouts/${action.row.withdrawalId}/simulate-result`,
          {
            method: 'POST',
            body: {
              resultEntryKey,
              result: action.result,
            },
          },
        )
      }
    } catch (caught) {
      const errorKeys = {
        payout_period_not_due: 'notDue',
        payout_already_paid: 'alreadyPaid',
        payout_preview_changed: 'previewChanged',
        payout_preview_empty: 'previewEmpty',
        forbidden: 'forbidden',
      }

      if (
        caught.code === 'payout_preview_changed' ||
        caught.code === 'payout_preview_empty'
      ) {
        setStale(true)
      }

      setError(m(errorKeys[caught.code] ?? 'actionError'))
      return
    } finally {
      inFlight.current = false
      setBusy(false)
    }

    onSaved()
  }

  function close() {
    if (!inFlight.current) onClose()
  }

  return (
    <Modal
      open
      title={m(generating ? 'previewTitle' : 'confirmTitle')}
      onClose={close}
      className={generating ? 'sm:max-w-5xl' : undefined}
    >
      <form onSubmit={submit}>
        {generating ? (
          <>
            <p className="text-sm text-muted">
              {t('adminPayouts.previewHint', { period: periodId })}
            </p>

            {preview.status === 'loading' && (
              <p role="status" className="mt-4">
                {m('loading')}
              </p>
            )}

            {preview.status === 'error' && (
              <p role="alert" className="mt-4">
                {m('previewError')}
              </p>
            )}

            {preview.status === 'ready' && (
              <>
                <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-line p-4">
                  <p>
                    {m('eligibleCount')}:{' '}
                    <strong>
                      {formatNumber(preview.data.eligibleCount)}
                    </strong>
                  </p>

                  <p>
                    {m('totalExpected')}:{' '}
                    <strong>
                      {formatNumber(preview.data.totalVnd)} VND
                    </strong>
                  </p>
                </div>

                {preview.data.items.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">
                    {m('previewEmpty')}
                  </p>
                ) : (
                  <div className="mt-4 max-h-[45vh] overflow-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          {['author', 'coins', 'money', 'bank'].map(key => (
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
                        {preview.data.items.map(row => (
                          <tr
                            key={row.accountId}
                            className="border-b border-line align-top"
                          >
                            <td className="px-3 py-3">
                              {row.displayName || row.accountId}
                            </td>

                            <td className="px-3 py-3 tabular-nums">
                              {formatNumber(row.amountCoins)}
                            </td>

                            <td className="px-3 py-3 tabular-nums">
                              {formatNumber(row.payoutSlipAmountVnd)}
                            </td>

                            <td className="px-3 py-3">
                              <p>{row.bankDetails.bankName}</p>
                              <p>{row.bankDetails.accountNumber}</p>
                              <p className="text-muted">
                                {row.bankDetails.accountHolder}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <p className="mt-4 text-sm text-muted">
              {m('generateHint')}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm">
              {t(
                action.result === 'Paid'
                  ? 'adminPayouts.confirmPaid'
                  : 'adminPayouts.confirmFailed',
                {
                  author:
                    action.row.displayName || action.row.accountId,
                  amount: formatNumber(
                    action.row.payoutSlipAmountVnd,
                  ),
                },
              )}
            </p>

            <p className="mt-3 text-sm text-muted">
              {m('simulationHint')}
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {generating && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || preview.status === 'loading'}
              onClick={reloadPreview}
            >
              {m('reloadPreview')}
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={close}
          >
            {m('cancel')}
          </Button>

          <Button type="submit" disabled={!canConfirm}>
            {m(
              busy
                ? 'submitting'
                : generating
                  ? 'confirmCreate'
                  : 'confirm',
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}