import { useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, Input, Modal, Select } from '../ui'

export function BankResolutionDialog({ row, onClose, onSaved }) {
  const { t, formatNumber } = useLocale()
  const m = key => t(`financialTransactions.${key}`)
  const [mode, setMode] = useState('credit')
  const [search, setSearch] = useState('')
  const [wallets, setWallets] = useState([])
  const [walletId, setWalletId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function findWallets(event) {
    event.preventDefault()
    setSearching(true)
    setError('')
    try {
      const response = await apiRequest(
        `/admin/transactions/reader-wallets?${new URLSearchParams({ search })}`,
      )
      if (!Array.isArray(response?.items)) throw new Error('Invalid reader wallet response')
      setWallets(response.items)
      setWalletId('')
    } catch {
      setError(m('searchError'))
    } finally {
      setSearching(false)
    }
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/admin/transactions/${row.id}/resolve`, {
        method: 'POST',
        body: { reason, ...(mode === 'credit' ? { walletId } : {}) },
      })
      onSaved()
    } catch (caught) {
      setError(caught.status === 409 ? m('conflict') : m('saveError'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Modal open title={m('resolveTitle')} onClose={() => !busy && onClose()}>
      <p className="text-sm">
        {t('financialTransactions.resolveHint', {
          reference: row.reference,
          amount: formatNumber(row.amount),
        })}
      </p>
      <label className="mt-4 block text-sm">
        {m('resolutionMode')}
        <Select value={mode} disabled={busy} onChange={event => setMode(event.target.value)}>
          <option value="credit">{m('credit')}</option>
          <option value="close">{m('closeWithoutCredit')}</option>
        </Select>
      </label>
      {mode === 'credit' && (
        <form onSubmit={findWallets} className="mt-4 space-y-2">
          <label className="block text-sm">
            {m('readerSearch')}
            <Input
              type="search"
              minLength={2}
              maxLength={100}
              required
              disabled={busy || searching}
              value={search}
              onChange={event => {
                setSearch(event.target.value)
                setWalletId('')
                setWallets([])
              }}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={busy || searching}>
            {m('findReader')}
          </Button>
        </form>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4">
        {mode === 'credit' && (
          <label className="block text-sm">
            {m('recipient')}
            <Select
              required
              value={walletId}
              disabled={busy}
              onChange={event => setWalletId(event.target.value)}
            >
              <option value="">{m('chooseReader')}</option>
              {wallets.map(wallet => (
                <option key={wallet.walletId} value={wallet.walletId}>
                  {wallet.displayName} — {wallet.email}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="block text-sm">
          {m('reason')}
          <Input
            required
            maxLength={500}
            disabled={busy}
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
        </label>
        <p className="text-sm text-muted">
          {m(mode === 'credit' ? 'creditWarning' : 'closeWarning')}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {m('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={busy || searching || !reason.trim() || (mode === 'credit' && !walletId)}
          >
            {m(busy ? 'saving' : 'confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
