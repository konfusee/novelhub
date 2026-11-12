import { useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, Input } from '../ui'

export function PayoutBankCorrectionForm({ withdrawalId, version, onSaved }) {
  const { t } = useLocale()
  const m = key => t(`payoutCorrection.${key}`)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const lock = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    lock.current = true
    setBusy(true)
    setFeedback('')
    try {
      await apiRequest(`/admin/monthly-payouts/${withdrawalId}/payment-details`, {
        method: 'PUT',
        body: {
          expectedVersion: version,
          reason: values.reason,
          bankDetails: {
            bankName: values.bankName,
            accountNumber: values.accountNumber,
            accountHolder: values.accountHolder,
          },
        },
      })
      setFeedback(m('saved'))
      onSaved()
    } catch (error) {
      setFeedback(m(error.status === 409 ? 'conflict' : 'error'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-5 border-t border-line pt-5">
      <h3 className="font-semibold">{m('title')}</h3>
      <p className="mt-2 text-sm text-muted">{m('hint')}</p>
      <fieldset disabled={busy} className="mt-4 grid gap-3 sm:grid-cols-2">
        {['bankName', 'accountNumber', 'accountHolder', 'reason'].map(key => (
          <label key={key} className="flex min-w-0 flex-col gap-2 text-sm">
            {key === 'reason' ? m('reason') : t(`authorFinance.bank.${key}`)}
            <Input
              name={key}
              required
              maxLength={key === 'reason' ? 1000 : key === 'accountNumber' ? 34 : 120}
              pattern={key === 'accountNumber' ? '[0-9]{6,34}' : undefined}
              inputMode={key === 'accountNumber' ? 'numeric' : undefined}
            />
          </label>
        ))}
        <Button type="submit" className="sm:col-span-2">
          {m(busy ? 'saving' : 'save')}
        </Button>
      </fieldset>
      {feedback && (
        <p role="status" className="mt-3 text-sm">
          {feedback}
        </p>
      )}
    </form>
  )
}
