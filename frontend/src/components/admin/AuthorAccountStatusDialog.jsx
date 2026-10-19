import { useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, Modal } from '../ui'

export function AuthorAccountStatusDialog({ account, closeAccount = false, onClose, onChanged }) {
  const { t } = useLocale()
  const m = key => t(`authorAccountStatus.${key}`)
  const action = closeAccount ? 'close' : account.status === 'active' ? 'suspend' : 'restore'
  const expectedStatus = closeAccount ? 'anonymized' : action === 'suspend' ? 'suspended' : 'active'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const lock = useRef(false)
  return (
    <Modal open title={m(action)} onClose={() => !lock.current && onClose()}>
      <form
        onSubmit={async event => {
          event.preventDefault()
          event.stopPropagation()
          if (lock.current || error || !reason.trim() || (closeAccount && !confirmed)) return
          lock.current = true
          setBusy(true)
          try {
            const result = await apiRequest(`/admin/accounts/${account.id}/status`, {
              method: 'POST',
              body: { action, expectedVersion: account.version, reason: reason.trim() },
            })
            if (
              result?.account?.id !== account.id ||
              result.account.status !== expectedStatus ||
              !Number.isSafeInteger(result.account.version) ||
              result.account.version <= account.version
            )
              throw new Error(m('failed'))
            onChanged()
          } catch (failure) {
            setError(failure.message || m('failed'))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <p className="font-semibold break-words">{account.name}</p>
        <p className="mt-3 text-sm text-muted">{m(action + 'Hint')}</p>
        {closeAccount && (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || !!error}
              onChange={event => setConfirmed(event.target.checked)}
            />
            {m('closeConfirm')}
          </label>
        )}
        <label htmlFor="author-account-reason" className="mt-4 block text-sm font-medium">
          {m('reason')}
        </label>
        <textarea
          id="author-account-reason"
          className="mt-2 min-h-28 w-full rounded-3xl border border-line bg-surface p-4 text-ink"
          value={reason}
          maxLength={1000}
          required
          disabled={busy || !!error}
          onChange={event => setReason(event.target.value)}
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error} {m('reload')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {m('cancel')}
          </Button>
          <Button
            variant={closeAccount ? 'danger' : 'primary'}
            type="submit"
            disabled={busy || !!error || !reason.trim() || (closeAccount && !confirmed)}
          >
            {m(busy ? 'saving' : action)}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
