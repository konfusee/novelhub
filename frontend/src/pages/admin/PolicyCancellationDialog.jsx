import { useId, useRef, useState } from 'react'
import { Button, Input, Modal } from '../../components/ui'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'

export function PolicyCancellationDialog({ policy, onClose, onSaved, onReload }) {
  const { t } = useLocale()
  const id = useId()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [failed, setFailed] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (busyRef.current || failed || !reason.trim() || !policy.future) return
    busyRef.current = true
    setBusy(true)
    try {
      const response = await apiRequest(`/admin/policy/${policy.id}/cancel`, {
        method: 'POST',
        body: { expectedVersion: policy.version, reason: reason.trim() },
      })
      if (response?.policyId !== policy.id || response?.version !== policy.version + 1)
        throw new Error('Invalid cancellation response')
      onSaved()
    } catch {
      setFailed(true)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return (
    <Modal open title={t('policyCancel.title')} onClose={() => !busy && onClose()}>
      <form onSubmit={submit}>
        <p className="text-sm text-muted">{t('policyCancel.description')}</p>
        <p className="mt-2 break-all text-caption text-muted">
          {t('policyHistory.identity', { id: policy.id })}
        </p>
        <label htmlFor={id} className="mt-4 block text-caption font-semibold">
          {t('policyCancel.reason')}
        </label>
        <Input
          id={id}
          className="mt-2"
          required
          maxLength={1000}
          value={reason}
          disabled={busy || failed}
          onChange={event => setReason(event.target.value)}
        />
        {failed && (
          <p role="alert" className="mt-3 text-caption text-rose-strong">
            {t('policyCancel.error')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t('policyCancel.close')}
          </Button>
          {failed ? (
            <Button type="button" onClick={onReload}>
              {t('policyCancel.reload')}
            </Button>
          ) : (
            <Button
              type="submit"
              variant="danger"
              disabled={busy || !reason.trim() || !policy.future}
            >
              {t(busy ? 'policyCancel.busy' : 'policyCancel.confirm')}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
